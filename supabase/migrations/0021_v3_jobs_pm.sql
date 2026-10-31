-- =====================================================================
-- 0021_v3_jobs_pm.sql — change request v3, batch F2 (items 13 + 15)
--   1. trades: installer, plumber, electrician, countertop, flooring, other (Settings-editable)
--   2. job_phase_templates: the phases a job runs through (Demo → … → Punch list), with trade, start offset, length
--   3. tasks: phase, trade, planned start/end (+ optional times), % complete, status todo/doing/blocked/done, order
--      Every new job gets one task per phase (trigger); existing jobs are backfilled.
--   4. task_comments (+ an optional photo filed in the deal's Photos)
--   5. site_rules: on-site work rules per deal (hours per weekday, no loud work after, off site by, building type, notes)
--   6. move_job_to_phase(): the Board's drag — earlier phases done, this one "doing"
-- Business checkpoints (contract, deposit, ordered, paid …) stay in job_milestones (PLAN v3 Q10).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Trades
-- ---------------------------------------------------------------------
create table public.trades (
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,30}$'),
  label       text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  primary key (company_id, key)
);
alter table public.trades enable row level security;
create policy trades_read on public.trades for select to authenticated
  using (company_id = public.current_company_id());
create policy trades_owner on public.trades for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- 2. Phase template
-- ---------------------------------------------------------------------
create table public.job_phase_templates (
  company_id         uuid not null references public.companies (id) on delete cascade,
  key                text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label              text not null check (length(btrim(label)) between 1 and 60),
  trade_key          text,
  start_offset_days  int not null default 0 check (start_offset_days between 0 and 365),
  duration_days      int not null default 1 check (duration_days between 1 and 120),
  sort_order         int not null default 0,
  active             boolean not null default true,
  primary key (company_id, key)
);
alter table public.job_phase_templates enable row level security;
create policy job_phase_templates_read on public.job_phase_templates for select to authenticated
  using (company_id = public.current_company_id());
create policy job_phase_templates_owner on public.job_phase_templates for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- 3. Tasks (0001 table; additive columns)
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists company_id  uuid references public.companies (id) on delete cascade,
  add column if not exists phase_key   text,
  add column if not exists trade_key   text,
  add column if not exists start_on    date,
  add column if not exists end_on      date,
  add column if not exists start_time  time,
  add column if not exists end_time    time,
  add column if not exists pct         int not null default 0 check (pct between 0 and 100),
  add column if not exists sort_order  int not null default 0,
  add column if not exists notes       text check (notes is null or length(notes) <= 2000),
  add column if not exists done_at     timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

update public.tasks t set company_id = p.company_id from public.projects p where p.id = t.project_id and t.company_id is null;
update public.tasks set status = 'todo' where status is null or status not in ('todo', 'doing', 'blocked', 'done');
alter table public.tasks
  alter column status set default 'todo',
  alter column status set not null,
  add constraint tasks_status_chk check (status in ('todo', 'doing', 'blocked', 'done')),
  add constraint tasks_dates_chk check (end_on is null or start_on is null or end_on >= start_on);
create index if not exists tasks_project_order on public.tasks (project_id, sort_order);
create index if not exists tasks_assignee_dates on public.tasks (assignee_id, start_on) where status <> 'done';

-- Keep status, % and done_at consistent; fill company_id; mirror the old due_date from end_on.
create or replace function public.tasks_normalize()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.company_id is null then
    select company_id into new.company_id from public.projects where id = new.project_id;
  end if;
  if tg_op = 'UPDATE' and new.pct is distinct from old.pct and new.status is not distinct from old.status then
    new.status := case when new.pct >= 100 then 'done'
                       when new.pct > 0 and old.status in ('todo', 'done') then 'doing'
                       when new.pct < 100 and old.status = 'done' then 'doing'
                       else old.status end;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'done' then new.pct := 100;
    elsif old.status = 'done' and new.pct = 100 then new.pct := 90;
    end if;
  elsif tg_op = 'INSERT' then
    if new.status = 'done' then new.pct := 100; elsif new.pct >= 100 then new.status := 'done'; end if;
  end if;
  new.done_at := case when new.status = 'done' then coalesce(new.done_at, now()) else null end;
  new.due_date := coalesce(new.end_on, new.due_date);
  new.updated_at := now();
  return new;
end $$;
create trigger tasks_normalize before insert or update on public.tasks
  for each row execute function public.tasks_normalize();

-- ---------------------------------------------------------------------
-- 4. Comments (+ photo)
-- ---------------------------------------------------------------------
create table public.task_comments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  body        text not null default '' check (length(body) <= 2000),
  file_id     uuid references public.deal_files (id) on delete set null,
  author_id   uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (length(btrim(body)) > 0 or file_id is not null)
);
create index task_comments_task on public.task_comments (task_id, created_at);

create or replace function public.task_comments_fill()
returns trigger language plpgsql set search_path = public as $$
begin
  select company_id into new.company_id from public.tasks where id = new.task_id;
  new.author_id := coalesce(public.current_user_id(), new.author_id);
  return new;
end $$;
create trigger task_comments_fill before insert on public.task_comments
  for each row execute function public.task_comments_fill();

create or replace function public.can_see_task(p_task uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tasks t where t.id = p_task and public.can_see_project(t.project_id))
$$;

alter table public.task_comments enable row level security;
create policy task_comments_team on public.task_comments for select to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_task(task_id));
create policy task_comments_team_insert on public.task_comments for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_task(task_id));
create policy task_comments_own_delete on public.task_comments for delete to authenticated
  using (company_id = public.current_company_id() and (author_id = public.current_user_id() or public.is_owner()));

-- ---------------------------------------------------------------------
-- 5. Site rules (one per deal; the job reads the deal's)
-- ---------------------------------------------------------------------
create table public.site_rules (
  deal_id        uuid primary key references public.deals (id) on delete cascade,
  company_id     uuid not null references public.companies (id) on delete cascade,
  building_type  text check (building_type in ('house', 'condo', 'townhouse', 'apartment', 'other')),
  -- {"mon": {"start": "08:00", "end": "21:00"}, …}; a missing day = no work that day
  hours          jsonb not null default
                   '{"mon":{"start":"08:00","end":"18:00"},"tue":{"start":"08:00","end":"18:00"},"wed":{"start":"08:00","end":"18:00"},"thu":{"start":"08:00","end":"18:00"},"fri":{"start":"08:00","end":"18:00"},"sat":{"start":"09:00","end":"16:00"}}'::jsonb,
  loud_until     time,          -- no loud work after this time
  hoa_contact    text check (hoa_contact is null or length(hoa_contact) <= 300),
  elevator       text check (elevator is null or length(elevator) <= 300),
  parking        text check (parking is null or length(parking) <= 300),
  debris         text check (debris is null or length(debris) <= 300),
  gate_code      text check (gate_code is null or length(gate_code) <= 100),
  pets           text check (pets is null or length(pets) <= 300),
  notes          text check (notes is null or length(notes) <= 1000),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.users (id) on delete set null
);

create or replace function public.site_rules_fill()
returns trigger language plpgsql set search_path = public as $$
begin
  select company_id into new.company_id from public.deals where id = new.deal_id;
  new.updated_at := now();
  new.updated_by := coalesce(public.current_user_id(), new.updated_by);
  return new;
end $$;
create trigger site_rules_fill before insert or update on public.site_rules
  for each row execute function public.site_rules_fill();

alter table public.site_rules enable row level security;
create policy site_rules_team on public.site_rules for all to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));

-- History (0018) for the new job pieces.
create trigger zz_audit after insert or update or delete on public.task_comments
  for each row execute function private.audit_row('deal_id_via_task');
create trigger zz_audit after insert or update on public.site_rules
  for each row execute function private.audit_row('deal_id');

-- audit_row() learns one more way to find the deal: a comment → its task → its project → deal.
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row  jsonb := coalesce(v_new, v_old);
  v_skip text[] := private.audit_skip_cols();
  v_before jsonb := '{}';
  v_after  jsonb := '{}';
  v_key  text;
  v_company uuid := nullif(v_row ->> 'company_id', '')::uuid;
  v_deal uuid;
  v_deals uuid[];
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any (v_skip) then continue; end if;
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
        v_after  := v_after  || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end loop;
    if v_after = '{}'::jsonb then return null; end if;
  elsif tg_op = 'INSERT' then
    v_after := v_new - v_skip;
  else
    v_before := v_old - v_skip;
  end if;

  case tg_argv[0]
    when 'self' then v_deals := array[(v_row ->> 'id')::uuid];
    when 'deal_id' then v_deals := array[(v_row ->> 'deal_id')::uuid];
    when 'contact' then
      select array_agg(d.id) into v_deals from public.deals d where d.contact_id = (v_row ->> 'id')::uuid;
    when 'quote' then
      select array[q.deal_id] into v_deals from public.quotes q where q.id = (v_row ->> 'quote_id')::uuid;
    when 'project' then
      select array[p.deal_id] into v_deals from public.projects p where p.id = (v_row ->> 'project_id')::uuid;
    when 'deal_id_via_task' then
      select array[p.deal_id] into v_deals from public.tasks t join public.projects p on p.id = t.project_id
       where t.id = (v_row ->> 'task_id')::uuid;
    else v_deals := null;
  end case;
  if v_deals is null then return null; end if;

  foreach v_deal in array v_deals loop
    if v_deal is null then continue; end if;
    begin
      insert into public.audit_log (company_id, actor_id, table_name, record_id, action, before, after, deal_id)
      select coalesce(v_company, d.company_id), public.current_user_id(), tg_table_name,
             nullif(v_row ->> 'id', '')::uuid, lower(tg_op),
             nullif(v_before, '{}'::jsonb), nullif(v_after, '{}'::jsonb), d.id
        from public.deals d where d.id = v_deal;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- 6. Phase tasks for every job
-- ---------------------------------------------------------------------
create or replace function public.add_phase_tasks(p_project uuid, p_from date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.tasks (project_id, company_id, title, phase_key, trade_key, start_on, end_on, status, sort_order)
  select p.id, p.company_id, t.label, t.key, t.trade_key,
         p_from + t.start_offset_days, p_from + t.start_offset_days + t.duration_days - 1, 'todo', t.sort_order * 10
    from public.projects p
    join public.job_phase_templates t on t.company_id = p.company_id and t.active
   where p.id = p_project
     and not exists (select 1 from public.tasks x where x.project_id = p.id and x.phase_key = t.key);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.add_phase_tasks(uuid, date) from public, anon, authenticated;

create or replace function private.projects_phase_tasks() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.add_phase_tasks(new.id, coalesce(new.start_date, current_date));
  return new;
end $$;
create trigger projects_zz_phase_tasks after insert on public.projects
  for each row execute function private.projects_phase_tasks();

-- Board drag: the job is now in this phase. Earlier phases → done, this one → doing (unless done),
-- later ones untouched; moving back reopens this phase and the ones after it that were done.
create or replace function public.move_job_to_phase(p_project uuid, p_phase text)
returns void language plpgsql security invoker set search_path = public as $$
declare v_sort int;
begin
  if not public.is_team() or not public.can_see_project(p_project) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select min(sort_order) into v_sort from public.tasks where project_id = p_project and phase_key = p_phase;
  if v_sort is null then raise exception 'This job has no % phase', p_phase; end if;
  update public.tasks set status = 'done'
   where project_id = p_project and sort_order < v_sort and phase_key is not null and status <> 'done';
  update public.tasks set status = 'doing'
   where project_id = p_project and phase_key = p_phase and status in ('todo', 'done');
  update public.tasks set status = 'todo'
   where project_id = p_project and sort_order > v_sort and phase_key is not null and status = 'done';
end $$;
revoke execute on function public.move_job_to_phase(uuid, text) from public, anon;
grant execute on function public.move_job_to_phase(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Defaults + backfill
-- ---------------------------------------------------------------------
create or replace function public.seed_jobs_v3(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.trades (company_id, key, label, sort_order) values
    (p_company, 'installer',   'Installer',   1),
    (p_company, 'plumber',     'Plumber',     2),
    (p_company, 'electrician', 'Electrician', 3),
    (p_company, 'countertop',  'Countertop',  4),
    (p_company, 'flooring',    'Flooring',    5),
    (p_company, 'other',       'Other',       9)
  on conflict do nothing;
  insert into public.job_phase_templates (company_id, key, label, trade_key, start_offset_days, duration_days, sort_order) values
    (p_company, 'demo',                'Demo',                     'installer',    0, 1, 1),
    (p_company, 'floor',               'Floor',                    'flooring',     1, 2, 2),
    (p_company, 'cabinet_install',     'Cabinet install',          'installer',    3, 3, 3),
    (p_company, 'plumbing',            'Plumbing',                 'plumber',      6, 1, 4),
    (p_company, 'electrical',          'Electrical',               'electrician',  6, 1, 5),
    (p_company, 'countertop_template', 'Countertop template',      'countertop',   7, 1, 6),
    (p_company, 'countertop_install',  'Countertop install',       'countertop',  17, 1, 7),
    (p_company, 'backsplash',          'Backsplash',               'installer',   18, 2, 8),
    (p_company, 'punch_list',          'Final touch / punch list', 'installer',   20, 1, 9)
  on conflict do nothing;
end $$;
revoke execute on function public.seed_jobs_v3(uuid) from public, anon, authenticated;

create or replace function private.companies_seed_jobs_v3() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_jobs_v3(new.id);
  return new;
end $$;
create trigger companies_zz_jobs_v3 after insert on public.companies
  for each row execute function private.companies_seed_jobs_v3();

do $$
declare c uuid; p record;
begin
  for c in select id from public.companies loop perform public.seed_jobs_v3(c); end loop;
  -- Existing jobs get their phase tasks, planned from the job's start (or the day it was created).
  for p in select id, coalesce(start_date, created_at::date) as from_day from public.projects loop
    perform public.add_phase_tasks(p.id, p.from_day);
  end loop;
end $$;
