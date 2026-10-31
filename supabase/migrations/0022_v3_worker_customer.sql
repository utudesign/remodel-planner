-- =====================================================================
-- 0022 — change request v3, batch F1: worker (crew) + customer logins, money-free reads
-- (PLAN v3 items 14 and 18)
--
--   1. users.role gets 'customer'; users.trade_key (crew) and users.contact_id (customer)
--   2. invites carry the role (team / crew / customer), trade and the customer's contact
--   3. crew lose direct SELECT on deals and projects (they carried sold price, estimated
--      value, contract value, notes). Crew and customers read only these views:
--        job_worker_view   one row per job a worker is on: address, client, dates, %, phase, rules
--        job_worker_tasks  the tasks of those jobs (+ assignee name); no money exists on tasks
--        job_worker_visit  walls, appliances, ceiling, visit notes; no ballpark
--        job_customer_view / job_customer_tasks  the customer's own job: progress + schedule
--      Views run as their owner with an explicit filter (security_barrier), so RLS on the
--      base tables stays team-only.
--   4. crew: read site rules + task comments of their jobs, comment, and change % / status
--      of their own tasks through worker_update_task() (no other task columns)
--   5. storage upload for crew no longer needs to read deals (path → deal via a definer helper)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('owner', 'partner', 'team', 'crew', 'customer'));
alter table public.users
  add column if not exists trade_key text check (trade_key is null or trade_key ~ '^[a-z0-9_]{2,40}$'),
  add column if not exists contact_id uuid references public.contacts (id) on delete set null;
alter table public.users add constraint users_customer_contact
  check (role <> 'customer' or contact_id is not null) not valid;

create or replace function public.is_customer()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() = 'customer', false)
$$;

create or replace function public.current_contact_id()
returns uuid language sql stable security definer set search_path = public as $$
  select contact_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and active and role = 'customer' limit 1
$$;

-- The customer's own jobs: the job's deal is for their contact.
create or replace function public.is_customer_of_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_contact_id() is not null and exists (
    select 1 from public.projects p join public.deals d on d.id = p.deal_id
     where p.id = p_project and p.company_id = public.current_company_id()
       and d.contact_id = public.current_contact_id() and d.deleted_at is null)
$$;

-- A worker is on a job if they manage it or any task is theirs (0002 rule) — and they're crew.
create or replace function public.is_worker_on_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'crew' and public.is_assigned_to_project(p_project)
$$;

revoke execute on function public.current_contact_id(), public.is_customer_of_project(uuid),
  public.is_worker_on_project(uuid) from public, anon;
grant execute on function public.current_contact_id(), public.is_customer_of_project(uuid),
  public.is_worker_on_project(uuid), public.is_customer() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Invites carry the role
-- ---------------------------------------------------------------------
alter table public.team_invites
  add column if not exists role text not null default 'team' check (role in ('team', 'crew', 'customer')),
  add column if not exists trade_key text check (trade_key is null or trade_key ~ '^[a-z0-9_]{2,40}$'),
  add column if not exists contact_id uuid references public.contacts (id) on delete cascade;
alter table public.team_invites add constraint team_invites_customer_contact
  check (role <> 'customer' or contact_id is not null);

create or replace function public.accept_team_invite(p_clerk_user_id text, p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.team_invites%rowtype; v_user uuid;
begin
  select * into v_inv from public.team_invites
   where email = lower(p_email) and accepted_at is null
   order by invited_at desc limit 1;
  if not found then return null; end if;
  insert into public.users (company_id, workspace_id, clerk_id, name, email, role, trade_key, contact_id)
  values (v_inv.company_id, coalesce(v_inv.workspace_id, private.first_workspace(v_inv.company_id)),
          p_clerk_user_id, coalesce(nullif(p_name, ''), v_inv.name), lower(p_email), v_inv.role,
          case when v_inv.role = 'crew' then v_inv.trade_key end,
          case when v_inv.role = 'customer' then v_inv.contact_id end)
  on conflict (clerk_id) do update set active = true
  returning id into v_user;
  update public.team_invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_user;
end $$;
revoke execute on function public.accept_team_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.accept_team_invite(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 3. No direct money reads for crew; money-free views
-- ---------------------------------------------------------------------
drop policy if exists deals_crew_read on public.deals;
drop policy if exists projects_crew_read on public.projects;

-- The worker sees their team mates' names on the job (not the users table).
create or replace view public.job_worker_view with (security_barrier) as
select p.id                                  as project_id,
       p.deal_id,
       d.deal_number,
       d.deal_year,
       coalesce(p.name, d.title)             as name,
       c.name                                as client_name,
       c.phone                               as client_phone,
       c.address, c.city, c.zip,
       p.start_date,
       p.status,
       (select round(avg(t.pct))::int from public.tasks t where t.project_id = p.id and t.phase_key is not null) as pct,
       (select t.phase_key from public.tasks t where t.project_id = p.id and t.phase_key is not null and t.status <> 'done'
         order by t.sort_order limit 1)      as current_phase,
       pm.name                               as manager_name
  from public.projects p
  join public.deals d on d.id = p.deal_id
  left join public.contacts c on c.id = d.contact_id
  left join public.users pm on pm.id = p.project_manager_id
 where p.company_id = public.current_company_id()
   and p.closed_at is null
   and public.is_worker_on_project(p.id);

create or replace view public.job_worker_tasks with (security_barrier) as
select t.id, t.project_id, t.title, t.phase_key, t.trade_key, t.status, t.pct,
       t.start_on, t.end_on, t.start_time, t.end_time, t.sort_order, t.notes, t.done_at,
       t.assignee_id, u.name as assignee_name,
       coalesce(t.assignee_id = public.current_user_id(), false) as mine
  from public.tasks t
  left join public.users u on u.id = t.assignee_id
 where t.company_id = public.current_company_id()
   and public.is_worker_on_project(t.project_id);

create or replace view public.job_worker_visit with (security_barrier) as
select p.id as project_id, v.id as visit_id, v.visited_at, v.walls, v.appliances, v.ceiling_in, v.notes
  from public.projects p
  join public.site_visits v on v.deal_id = p.deal_id and v.status = 'done'
 where p.company_id = public.current_company_id()
   and public.is_worker_on_project(p.id);

create or replace view public.job_customer_view with (security_barrier) as
select p.id                                  as project_id,
       d.deal_number,
       coalesce(p.name, d.title)             as name,
       c.address, c.city,
       p.start_date,
       p.status,
       p.closed_at,
       (select round(avg(t.pct))::int from public.tasks t where t.project_id = p.id and t.phase_key is not null) as pct,
       (select t.title from public.tasks t where t.project_id = p.id and t.phase_key is not null and t.status <> 'done'
         order by t.sort_order limit 1)      as current_step,
       pm.name                               as manager_name,
       pm.phone                              as manager_phone
  from public.projects p
  join public.deals d on d.id = p.deal_id
  left join public.contacts c on c.id = d.contact_id
  left join public.users pm on pm.id = p.project_manager_id
 where public.is_customer_of_project(p.id);

-- Schedule only: no assignee, no internal notes.
create or replace view public.job_customer_tasks with (security_barrier) as
select t.id, t.project_id, t.title, t.phase_key, t.status, t.pct, t.start_on, t.end_on, t.sort_order
  from public.tasks t
 where t.phase_key is not null
   and public.is_customer_of_project(t.project_id);

revoke all on public.job_worker_view, public.job_worker_tasks, public.job_worker_visit,
  public.job_customer_view, public.job_customer_tasks from public, anon;
grant select on public.job_worker_view, public.job_worker_tasks, public.job_worker_visit,
  public.job_customer_view, public.job_customer_tasks to authenticated;

-- ---------------------------------------------------------------------
-- 4. Crew: site rules, comments, own task progress
-- ---------------------------------------------------------------------
create or replace function public.is_worker_on_deal(p_deal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_app_role() = 'crew' and exists (
    select 1 from public.projects p where p.deal_id = p_deal and public.is_assigned_to_project(p.id))
$$;
revoke execute on function public.is_worker_on_deal(uuid) from public, anon;
grant execute on function public.is_worker_on_deal(uuid) to authenticated;
create policy site_rules_crew_read on public.site_rules for select to authenticated
  using (company_id = public.current_company_id() and public.is_worker_on_deal(deal_id));

create or replace function public.can_see_task_as_worker(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and public.is_worker_on_project(t.project_id))
$$;
revoke execute on function public.can_see_task_as_worker(uuid) from public, anon;
grant execute on function public.can_see_task_as_worker(uuid) to authenticated;

create policy task_comments_crew on public.task_comments for select to authenticated
  using (company_id = public.current_company_id() and public.can_see_task_as_worker(task_id));
create policy task_comments_crew_insert on public.task_comments for insert to authenticated
  with check (company_id = public.current_company_id() and public.can_see_task_as_worker(task_id)
              and author_id = public.current_user_id());

-- The fill trigger reads tasks (not readable by crew): make it a definer.
create or replace function public.task_comments_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select company_id into new.company_id from public.tasks where id = new.task_id;
  new.author_id := coalesce(public.current_user_id(), new.author_id);
  return new;
end $$;

-- Crew change % and status of their own tasks (the job's manager: any task on it). Nothing else.
create or replace function public.worker_update_task(p_task uuid, p_pct int default null, p_status text default null)
returns void language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select tk.id, tk.assignee_id, tk.project_id, p.project_manager_id into t
    from public.tasks tk join public.projects p on p.id = tk.project_id
   where tk.id = p_task and tk.company_id = public.current_company_id();
  if not found or not public.is_worker_on_project(t.project_id)
     or (t.assignee_id is distinct from public.current_user_id() and t.project_manager_id is distinct from public.current_user_id()) then
    raise exception 'Not your task' using errcode = '42501';
  end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 100) then raise exception 'Percent is 0–100' using errcode = 'check_violation'; end if;
  if p_status is not null and p_status not in ('todo', 'doing', 'blocked', 'done') then
    raise exception 'Unknown status' using errcode = 'check_violation';
  end if;
  update public.tasks set pct = coalesce(p_pct, pct), status = coalesce(p_status, status) where id = p_task;
end $$;
revoke execute on function public.worker_update_task(uuid, int, text) from public, anon;
grant execute on function public.worker_update_task(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Storage upload: crew add photos to their jobs without reading deals
-- ---------------------------------------------------------------------
create or replace function public.can_upload_deal_path(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deals d
     where d.company_id = public.current_company_id()
       and d.deal_year::text = split_part(p_name, '/', 2)
       and d.deal_number = split_part(p_name, '/', 3)
       and ((public.is_team() and public.can_see_deal(d.id))
            or (split_part(p_name, '/', 4) = 'photos' and public.is_worker_on_deal(d.id))))
$$;
revoke execute on function public.can_upload_deal_path(text) from public, anon;
grant execute on function public.can_upload_deal_path(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'deal_files_storage_insert') then
    drop policy deal_files_storage_insert on storage.objects;
    create policy deal_files_storage_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'deal-files'
                  and (storage.foldername(name))[1] = public.current_company_id()::text
                  and public.can_upload_deal_path(name));
  end if;
end $$;

-- Crew photo rows: only on their jobs (0004 used is_assigned_to_deal, which also matched a team PM).
drop policy if exists deal_files_crew_insert on public.deal_files;
create policy deal_files_crew_insert on public.deal_files for insert to authenticated
  with check (company_id = public.current_company_id() and folder = 'photos' and public.is_worker_on_deal(deal_id));

-- The row trigger reads the deal to check the path; crew can't read deals any more, so it runs as definer
-- (same body as 0004; RLS on deal_files still decides who may insert).
create or replace function public.deal_files_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.deals%rowtype;
begin
  select * into d from public.deals where id = new.deal_id;
  if not found then raise exception 'Deal % not found', new.deal_id; end if;
  new.company_id := d.company_id;
  if new.storage_path not like d.company_id::text || '/' || d.deal_year || '/' || d.deal_number
                               || '/' || new.folder || '/%' then
    raise exception 'storage_path must start with %/%/%/%/', d.company_id, d.deal_year, d.deal_number, new.folder
      using errcode = 'check_violation';
  end if;
  new.crew_visible := coalesce(new.crew_visible, new.folder in ('photos','design'));
  new.uploaded_by := coalesce(new.uploaded_by, public.current_user_id());
  return new;
end $$;

notify pgrst, 'reload schema';
