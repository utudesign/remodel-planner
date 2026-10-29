-- =====================================================================
-- 0016_workspaces.sql — separate workspaces + sharing (Tugu, 2026-10-29; docs/DECISIONS.md).
-- Crystal gets her own admin workspace (RenoDesign). Her data is hers: Tugu can't see it,
-- and she can't see his. A deal shows in another workspace only when its home workspace
-- shares it ("Share"), and then that workspace can edit it fully. Sharing works both ways.
--   1. workspaces; users / deals / contacts / lead links / invites belong to one
--   2. deal_shares + can_see_deal(): RLS on every deal-related table now checks the workspace
--   3. workspace admins (the owner, Crystal) invite people into their own workspace
--   4. create_workspace_for(): the owner gives a teammate her own workspace
-- Company-wide (shared by every workspace): settings, stages, texts, price list, templates.
-- No applied migration is edited; earlier policies are dropped and replaced here.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Workspaces
-- ---------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now()
);
create index workspaces_company on public.workspaces (company_id, created_at);

alter table public.users
  add column if not exists workspace_id uuid references public.workspaces (id),
  add column if not exists workspace_admin boolean not null default false;
alter table public.deals        add column if not exists workspace_id uuid references public.workspaces (id);
alter table public.contacts     add column if not exists workspace_id uuid references public.workspaces (id);
alter table public.lead_links
  add column if not exists workspace_id uuid references public.workspaces (id),
  add column if not exists user_id uuid references public.users (id);
alter table public.team_invites add column if not exists workspace_id uuid references public.workspaces (id);

-- Every existing company gets one workspace (named after its default owner) holding all its data.
insert into public.workspaces (company_id, name)
select c.id, coalesce(nullif(split_part(btrim(u.name), ' ', 1), ''), c.name)
  from public.companies c
  left join public.users u on u.company_id = c.id and u.is_default_owner
 where not exists (select 1 from public.workspaces w where w.company_id = c.id);

create or replace function private.first_workspace(p_company uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.workspaces where company_id = p_company order by created_at, id limit 1
$$;

update public.users u set workspace_id = private.first_workspace(u.company_id) where workspace_id is null;
update public.users set workspace_admin = true where role = 'owner';
update public.deals d set workspace_id = private.first_workspace(d.company_id) where workspace_id is null;
update public.contacts c set workspace_id = private.first_workspace(c.company_id) where workspace_id is null;
update public.lead_links l
   set workspace_id = private.first_workspace(l.company_id),
       user_id = (select u.id from public.users u where u.company_id = l.company_id and u.is_default_owner limit 1)
 where workspace_id is null;
update public.team_invites t set workspace_id = private.first_workspace(t.company_id) where workspace_id is null;

create index if not exists deals_workspace on public.deals (workspace_id);
create index if not exists contacts_workspace on public.contacts (workspace_id);

-- New companies get a workspace first (before the lead link and seeds run: triggers fire by name).
create or replace function private.companies_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspaces (company_id, name) values (new.id, new.name);
  return null;
end $$;
create trigger companies_aa_workspace after insert on public.companies
  for each row execute function private.companies_workspace();

-- ---------------------------------------------------------------------
-- 2. Who am I, and can I see this deal?
-- ---------------------------------------------------------------------
create or replace function public.current_workspace_id()
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and active limit 1
$$;

create or replace function public.is_ws_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'owner' or workspace_admin from public.users
                    where clerk_id = (auth.jwt() ->> 'sub') and active limit 1), false)
$$;

create table public.deal_shares (
  deal_id       uuid not null references public.deals (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  company_id    uuid not null references public.companies (id) on delete cascade,
  shared_by     uuid references public.users (id),
  shared_at     timestamptz not null default now(),
  primary key (deal_id, workspace_id)
);
create index deal_shares_workspace on public.deal_shares (workspace_id);

create or replace function public.deal_shared_to_me(p_deal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.deal_shares s
                  where s.deal_id = p_deal and s.workspace_id = public.current_workspace_id())
$$;

create or replace function public.can_see_deal(p_deal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.deals d
     where d.id = p_deal and d.company_id = public.current_company_id()
       and (d.workspace_id = public.current_workspace_id() or public.deal_shared_to_me(d.id)))
$$;

create or replace function public.deal_is_home(p_deal uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.deals d where d.id = p_deal and d.company_id = public.current_company_id()
                    and d.workspace_id = public.current_workspace_id())
$$;

create or replace function public.can_see_project(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p
                  where p.id = p_project and p.company_id = public.current_company_id()
                    and (p.deal_id is null or public.can_see_deal(p.deal_id)))
$$;

create or replace function public.can_see_quote(p_quote uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quotes q
                  where q.id = p_quote and q.company_id = public.current_company_id() and public.can_see_deal(q.deal_id))
$$;

create or replace function public.can_see_contact(p_contact uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contacts c where c.id = p_contact and c.company_id = public.current_company_id()
                    and c.workspace_id = public.current_workspace_id())
      or exists (select 1 from public.deals d where d.contact_id = p_contact and public.deal_shared_to_me(d.id))
$$;

revoke execute on function public.current_workspace_id(), public.is_ws_admin(), public.deal_shared_to_me(uuid),
  public.can_see_deal(uuid), public.deal_is_home(uuid), public.can_see_project(uuid), public.can_see_quote(uuid),
  public.can_see_contact(uuid) from public, anon;
grant execute on function public.current_workspace_id(), public.is_ws_admin(), public.deal_shared_to_me(uuid),
  public.can_see_deal(uuid), public.deal_is_home(uuid), public.can_see_project(uuid), public.can_see_quote(uuid),
  public.can_see_contact(uuid) to authenticated, service_role;

-- New rows land in the creator's workspace (public forms set it explicitly); it never moves.
create or replace function private.workspace_default() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.workspace_id := coalesce(new.workspace_id, public.current_workspace_id(), private.first_workspace(new.company_id));
    if (select company_id from public.workspaces where id = new.workspace_id) is distinct from new.company_id then
      raise exception 'Workspace belongs to another company' using errcode = 'check_violation';
    end if;
  elsif new.workspace_id is distinct from old.workspace_id and not private.is_system() then
    raise exception 'A record can''t move to another workspace' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger deals_ab_workspace before insert or update on public.deals
  for each row execute function private.workspace_default();
create trigger contacts_ab_workspace before insert or update on public.contacts
  for each row execute function private.workspace_default();

-- A deal without an owner goes to its workspace's admin (deals_guard's company default comes after).
create or replace function private.deals_workspace_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is null then
    select u.id into new.owner_id from public.users u
     where u.workspace_id = new.workspace_id and u.active and u.workspace_admin
     order by (u.role = 'owner') desc, u.created_at limit 1;
  end if;
  return new;
end $$;
create trigger deals_ac_owner before insert on public.deals
  for each row execute function private.deals_workspace_owner();

-- Users, lead links and invites default to the company's first workspace; owners admin theirs.
create or replace function private.users_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.workspace_id := coalesce(new.workspace_id, private.first_workspace(new.company_id));
  if new.role = 'owner' then new.workspace_admin := true; end if;
  return new;
end $$;
create trigger users_aa_workspace before insert on public.users
  for each row execute function private.users_workspace();

create or replace function private.lead_links_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.workspace_id := coalesce(new.workspace_id, public.current_workspace_id(), private.first_workspace(new.company_id));
  return new;
end $$;
create trigger lead_links_aa_workspace before insert on public.lead_links
  for each row execute function private.lead_links_workspace();
create trigger team_invites_aa_workspace before insert on public.team_invites
  for each row execute function private.lead_links_workspace();

-- ---------------------------------------------------------------------
-- 3. Row level security: workspace + shares on every deal-related table
-- ---------------------------------------------------------------------
drop policy if exists deals_team on public.deals;
create policy deals_ws on public.deals for all to authenticated
  using (company_id = public.current_company_id() and public.is_team()
         and (workspace_id = public.current_workspace_id() or public.deal_shared_to_me(id)))
  with check (company_id = public.current_company_id() and public.is_team()
              and (workspace_id = public.current_workspace_id() or public.deal_shared_to_me(id)));

drop policy if exists contacts_team on public.contacts;
create policy contacts_ws on public.contacts for all to authenticated
  using (company_id = public.current_company_id() and public.is_team()
         and (workspace_id = public.current_workspace_id() or public.can_see_contact(id)))
  with check (company_id = public.current_company_id() and public.is_team()
              and (workspace_id = public.current_workspace_id() or public.can_see_contact(id)));

do $$
declare t text;
begin
  foreach t in array array['site_visits', 'activities', 'meetings', 'quotes', 'text_sends'] loop
    execute format('drop policy if exists %1$s_team on public.%1$s', t);
    execute format($f$create policy %1$s_ws on public.%1$s for all to authenticated
                      using (company_id = public.current_company_id() and public.is_team()
                             and (deal_id is null or public.can_see_deal(deal_id)))
                      with check (company_id = public.current_company_id() and public.is_team()
                                  and (deal_id is null or public.can_see_deal(deal_id)))$f$, t);
  end loop;
end $$;
drop policy if exists text_sends_owner on public.text_sends;
drop policy if exists deal_intake_owner on public.deal_intake;
drop policy if exists deal_intake_team_read on public.deal_intake;
-- Form answers: the team reads them; workspace admins edit (as the owner did before).
create policy deal_intake_ws_read on public.deal_intake for select to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));
create policy deal_intake_ws_admin on public.deal_intake for all to authenticated
  using (company_id = public.current_company_id() and public.is_ws_admin() and public.can_see_deal(deal_id))
  with check (company_id = public.current_company_id() and public.is_ws_admin() and public.can_see_deal(deal_id));

drop policy if exists projects_team on public.projects;
create policy projects_ws on public.projects for all to authenticated
  using (company_id = public.current_company_id() and public.is_team()
         and (deal_id is null or public.can_see_deal(deal_id)))
  with check (company_id = public.current_company_id() and public.is_team()
              and (deal_id is null or public.can_see_deal(deal_id)));

do $$
declare t text;
begin
  foreach t in array array['tasks', 'costs', 'payments', 'change_orders'] loop
    execute format('drop policy if exists %1$s_team on public.%1$s', t);
    execute format($f$create policy %1$s_ws on public.%1$s for all to authenticated
                      using (public.is_team() and public.can_see_project(project_id))
                      with check (public.is_team() and public.can_see_project(project_id))$f$, t);
  end loop;
end $$;

drop policy if exists job_milestones_team on public.job_milestones;
create policy job_milestones_ws on public.job_milestones for all to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id));

drop policy if exists materials_team on public.project_materials;
create policy materials_ws on public.project_materials for all to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id));

drop policy if exists quote_lines_team on public.quote_line_items;
create policy quote_lines_ws on public.quote_line_items for all to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_quote(quote_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_quote(quote_id));

drop policy if exists deal_files_team_read on public.deal_files;
drop policy if exists deal_files_team_insert on public.deal_files;
drop policy if exists deal_files_team_update on public.deal_files;
create policy deal_files_ws_read on public.deal_files for select to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));
create policy deal_files_ws_insert on public.deal_files for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));
create policy deal_files_ws_update on public.deal_files for update to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));

-- Storage: the file's deal must be visible (path {company}/{year}/{number}/{folder}/{file}).
drop policy if exists deal_files_storage_read on storage.objects;
drop policy if exists deal_files_storage_insert on storage.objects;
create policy deal_files_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'deal-files'
         and (storage.foldername(name))[1] = public.current_company_id()::text
         and exists (select 1 from public.deal_files f
                      where f.storage_path = storage.objects.name and f.deleted_at is null
                        and ((public.is_team() and public.can_see_deal(f.deal_id))
                             or (f.crew_visible and public.is_assigned_to_deal(f.deal_id)))));
create policy deal_files_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-files'
              and (storage.foldername(name))[1] = public.current_company_id()::text
              and exists (select 1 from public.deals d
                           where d.company_id = public.current_company_id()
                             and d.deal_year::text = (storage.foldername(name))[2]
                             and d.deal_number = (storage.foldername(name))[3]
                             and ((public.is_team() and public.can_see_deal(d.id))
                                  or ((storage.foldername(name))[4] = 'photos' and public.is_assigned_to_deal(d.id)))));

-- Workspaces: everyone in the company sees the names (to share with them); the owner creates
-- them; a workspace's admin renames it.
alter table public.workspaces  enable row level security;
alter table public.deal_shares enable row level security;
create policy workspaces_read on public.workspaces for select to authenticated
  using (company_id = public.current_company_id());
create policy workspaces_rename on public.workspaces for update to authenticated
  using (company_id = public.current_company_id() and public.is_ws_admin() and id = public.current_workspace_id())
  with check (company_id = public.current_company_id() and id = public.current_workspace_id());

-- Shares: both sides read them; only the deal's home workspace adds or removes them.
create policy deal_shares_read on public.deal_shares for select to authenticated
  using (company_id = public.current_company_id() and public.is_team()
         and (workspace_id = public.current_workspace_id() or public.deal_is_home(deal_id)));
create policy deal_shares_write on public.deal_shares for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_team() and public.deal_is_home(deal_id)
              and workspace_id <> public.current_workspace_id()
              and exists (select 1 from public.workspaces w where w.id = deal_shares.workspace_id and w.company_id = deal_shares.company_id));
create policy deal_shares_delete on public.deal_shares for delete to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.deal_is_home(deal_id));

-- Lead links and invites: each workspace admin manages their own.
drop policy if exists lead_links_owner on public.lead_links;
create policy lead_links_ws on public.lead_links for all to authenticated
  using (company_id = public.current_company_id() and public.is_ws_admin() and workspace_id = public.current_workspace_id())
  with check (company_id = public.current_company_id() and public.is_ws_admin() and workspace_id = public.current_workspace_id());
drop policy if exists team_invites_owner on public.team_invites;
create policy team_invites_ws on public.team_invites for all to authenticated
  using (company_id = public.current_company_id() and public.is_ws_admin() and workspace_id = public.current_workspace_id())
  with check (company_id = public.current_company_id() and public.is_ws_admin() and workspace_id = public.current_workspace_id());

-- A workspace admin turns logins in their own workspace on/off (the owner: anyone, 0001).
create policy users_ws_admin_write on public.users for update to authenticated
  using (company_id = public.current_company_id() and public.is_ws_admin() and workspace_id = public.current_workspace_id())
  with check (company_id = public.current_company_id() and workspace_id = public.current_workspace_id());

-- Users can't change their own workspace or admin flag; only create_workspace_for() moves people.
create or replace function private.users_guard_workspace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.workspace_id, new.workspace_admin, new.role) is distinct from (old.workspace_id, old.workspace_admin, old.role)
     and not private.is_system() and not coalesce(current_setting('app.moving_user', true), '') = '1' then
    if not public.is_owner() then
      raise exception 'Only the owner changes workspaces and roles' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
create trigger users_guard_workspace before update on public.users
  for each row execute function private.users_guard_workspace();

-- ---------------------------------------------------------------------
-- 4. Functions: share, unshare, give someone their own workspace, invites
-- ---------------------------------------------------------------------
create or replace function public.share_deal(p_deal uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d record; v_from text;
begin
  if not public.is_team() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select id, company_id, workspace_id, deal_number into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null;
  if not found or d.workspace_id is distinct from public.current_workspace_id() then
    raise exception 'Only the deal''s own workspace can share it' using errcode = '42501';
  end if;
  if p_workspace = d.workspace_id or not exists (
       select 1 from public.workspaces w where w.id = p_workspace and w.company_id = d.company_id) then
    raise exception 'Pick another workspace' using errcode = 'check_violation';
  end if;
  insert into public.deal_shares (deal_id, workspace_id, company_id, shared_by)
  values (d.id, p_workspace, d.company_id, public.current_user_id())
  on conflict (deal_id, workspace_id) do nothing;
  if found then
    select name into v_from from public.workspaces where id = d.workspace_id;
    insert into public.notifications (company_id, user_id, kind, title, body, url, deal_id)
    select d.company_id, u.id, 'share', v_from || ' shared #' || d.deal_number || ' with you',
           'You can see and edit it now.', '/deals/' || d.deal_number, d.id
      from public.users u where u.workspace_id = p_workspace and u.active;
    insert into public.activities (company_id, deal_id, type, summary, created_by)
    values (d.company_id, d.id, 'system',
            'Shared with ' || (select name from public.workspaces where id = p_workspace), public.current_user_id());
  end if;
end $$;

create or replace function public.unshare_deal(p_deal uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  if not public.is_team() or not public.deal_is_home(p_deal) then
    raise exception 'Only the deal''s own workspace can stop sharing it' using errcode = '42501';
  end if;
  select id, company_id into d from public.deals where id = p_deal;
  delete from public.deal_shares where deal_id = p_deal and workspace_id = p_workspace;
  if found then
    insert into public.activities (company_id, deal_id, type, summary, created_by)
    values (d.company_id, d.id, 'system',
            'Stopped sharing with ' || (select name from public.workspaces where id = p_workspace), public.current_user_id());
  end if;
end $$;

-- The owner gives a teammate her own workspace (she becomes its admin). Her deals stay where
-- they are, handed to the workspace's admin; nothing is copied or deleted.
create or replace function public.create_workspace_for(p_user uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u record; v_ws uuid; v_admin uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner creates workspaces' using errcode = '42501'; end if;
  select id, company_id, workspace_id, role into u from public.users
   where id = p_user and company_id = public.current_company_id() and active;
  if not found then raise exception 'Teammate not found'; end if;
  if u.role = 'owner' then raise exception 'The owner keeps their workspace' using errcode = 'check_violation'; end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Name the workspace' using errcode = 'check_violation'; end if;
  insert into public.workspaces (company_id, name) values (u.company_id, btrim(p_name)) returning id into v_ws;
  perform set_config('app.moving_user', '1', true);
  update public.users set workspace_id = v_ws, workspace_admin = true where id = u.id;
  perform set_config('app.moving_user', '', true);
  select id into v_admin from public.users
   where workspace_id = u.workspace_id and active and workspace_admin and id <> u.id
   order by (role = 'owner') desc limit 1;
  update public.deals set owner_id = v_admin where owner_id = u.id and workspace_id = u.workspace_id;
  -- her own free-estimate link
  insert into public.lead_links (company_id, workspace_id, user_id, slug)
  values (u.company_id, v_ws, u.id,
          left(coalesce(nullif(trim(both '-' from regexp_replace(lower(split_part(btrim(p_name), ' ', 1)), '[^a-z0-9]+', '-', 'g')), ''), 'kitchen'), 20)
          || '-' || substr(md5(gen_random_uuid()::text), 1, 4));
  return v_ws;
end $$;

-- The owner moves a teammate into another existing workspace (e.g. Ahn joins Crystal's) as a member.
create or replace function public.move_to_workspace(p_user uuid, p_workspace uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare u record; v_admin uuid;
begin
  if not public.is_owner() then raise exception 'Only the owner moves people between workspaces' using errcode = '42501'; end if;
  select id, company_id, workspace_id, role into u from public.users
   where id = p_user and company_id = public.current_company_id();
  if not found then raise exception 'Teammate not found'; end if;
  if u.role = 'owner' then raise exception 'The owner keeps their workspace' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.workspaces where id = p_workspace and company_id = u.company_id) then
    raise exception 'Pick a workspace' using errcode = 'check_violation';
  end if;
  if p_workspace = u.workspace_id then return; end if;
  perform set_config('app.moving_user', '1', true);
  update public.users set workspace_id = p_workspace, workspace_admin = false where id = u.id;
  perform set_config('app.moving_user', '', true);
  select id into v_admin from public.users
   where workspace_id = u.workspace_id and active and workspace_admin and id <> u.id
   order by (role = 'owner') desc limit 1;
  update public.deals set owner_id = v_admin where owner_id = u.id and workspace_id = u.workspace_id;
end $$;

revoke execute on function public.share_deal(uuid, uuid), public.unshare_deal(uuid, uuid),
  public.create_workspace_for(uuid, text), public.move_to_workspace(uuid, uuid) from public, anon;
grant execute on function public.share_deal(uuid, uuid), public.unshare_deal(uuid, uuid),
  public.create_workspace_for(uuid, text), public.move_to_workspace(uuid, uuid) to authenticated;

-- Invites join the inviting workspace (0015 body + workspace).
create or replace function public.accept_team_invite(p_clerk_user_id text, p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.team_invites%rowtype; v_user uuid;
begin
  select * into v_inv from public.team_invites
   where email = lower(p_email) and accepted_at is null
   order by invited_at desc limit 1;
  if not found then return null; end if;
  insert into public.users (company_id, workspace_id, clerk_id, name, email, role)
  values (v_inv.company_id, coalesce(v_inv.workspace_id, private.first_workspace(v_inv.company_id)),
          p_clerk_user_id, coalesce(nullif(p_name, ''), v_inv.name), lower(p_email), 'team')
  on conflict (clerk_id) do update set active = true
  returning id into v_user;
  update public.team_invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_user;
end $$;
revoke execute on function public.accept_team_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.accept_team_invite(text, text, text) to service_role;

-- Jobs: the deal must be visible to the caller (0015 bodies + can_see_deal).
create or replace function public.start_job(p_deal uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_project uuid;
begin
  if not public.is_team() then
    raise exception 'Only the team can start a job' using errcode = '42501';
  end if;
  select id, company_id, origin, handed_off_at, sold_at, job_status, title, contact_id,
         coalesce(sold_price_cents, 0) + change_orders_cents as value
    into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null
     and public.can_see_deal(id);
  if not found then raise exception 'Deal not found'; end if;
  if d.sold_at is null and d.handed_off_at is null
     and not (d.origin = 'partner' and d.job_status <> 'not_started') then
    raise exception 'Mark the deal sold first' using errcode = 'check_violation';
  end if;
  select id into v_project from public.projects where deal_id = p_deal;
  if v_project is null then
    insert into public.projects (company_id, deal_id, contact_id, name, status, contract_value)
    values (d.company_id, d.id, d.contact_id, d.title, 'active', nullif(d.value, 0))
    returning id into v_project;
    insert into public.job_milestones (company_id, project_id, key, label, sort_order, planned_on)
    select d.company_id, v_project, t.key, t.label, t.sort_order, current_date + t.plan_days
      from public.job_milestone_templates t
     where t.company_id = d.company_id and t.active
    on conflict (project_id, key) do nothing;
  end if;
  return v_project;
end $$;

create or replace function public.mark_sold(p_deal uuid, p_price_cents bigint,
                                            p_signed_on date default null, p_deposit_on date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_missing text; v_sold text; v_project uuid; v_tz text;
begin
  if not public.is_team() then
    raise exception 'Only the team can mark a deal sold' using errcode = '42501';
  end if;
  select id, company_id, sold_at into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null
     and public.can_see_deal(id)
   for update;
  if not found then raise exception 'Deal not found'; end if;
  if coalesce(p_price_cents, 0) <= 0 then
    raise exception 'Enter the sold price' using errcode = 'check_violation';
  end if;
  select string_agg(m, ', ') into v_missing from public.deal_gate_missing(p_deal, 'before_handoff') m;
  if v_missing is not null then
    raise exception 'Job-ready checklist is missing: %', v_missing using errcode = 'check_violation';
  end if;
  select s.key into v_sold from public.pipeline_stages s
   where s.company_id = d.company_id and s.kind = 'handed_off' and s.active
   order by s.sort_order limit 1;
  if v_sold is null then
    raise exception 'Add a Sold stage in Settings → Pipeline' using errcode = 'check_violation';
  end if;
  select timezone into v_tz from public.companies where id = d.company_id;
  update public.deals
     set sold_price_cents    = p_price_cents,
         sold_at             = coalesce(sold_at, now()),
         job_status          = case when job_status = 'not_started' then 'signed' else job_status end,
         deposit_received_at = coalesce(deposit_received_at,
                                 case when p_deposit_on is not null
                                      then (p_deposit_on + time '12:00') at time zone v_tz end),
         stage               = v_sold
   where id = p_deal;
  v_project := public.start_job(p_deal);
  update public.projects set contract_value = p_price_cents where id = v_project;
  update public.job_milestones
     set done_on = coalesce(done_on, p_signed_on, (now() at time zone v_tz)::date)
   where project_id = v_project and key = 'contract_signed';
  if p_deposit_on is not null then
    update public.job_milestones set done_on = coalesce(done_on, p_deposit_on)
     where project_id = v_project and key = 'deposit';
  end if;
  return v_project;
end $$;

