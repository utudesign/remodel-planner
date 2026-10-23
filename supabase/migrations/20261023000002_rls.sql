-- =============================================================================
-- 0002 Row Level Security.
-- Identity comes from the Clerk session token (Supabase third-party auth):
--   sub                    → Clerk user id
--   org_id  (v1 claims)    → Clerk organization id
--   o.id    (v2 claims)    → Clerk organization id
-- Roles are read from public.users (DB is the source of truth), never from the token.
-- =============================================================================

create or replace function private.clerk_org_id() returns text
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'org_id', auth.jwt() -> 'o' ->> 'id')
$$;

create or replace function private.company_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.id from public.companies c where c.clerk_org_id = private.clerk_org_id()
$$;

create or replace function private.user_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from public.users u
  where u.clerk_id = auth.jwt() ->> 'sub'
    and u.company_id = private.company_id()
    and u.active
$$;

create or replace function private.user_role() returns text
language sql stable security definer set search_path = ''
as $$
  select u.role from public.users u
  where u.clerk_id = auth.jwt() ->> 'sub'
    and u.company_id = private.company_id()
    and u.active
$$;

create or replace function private.is_member(p_company uuid) returns boolean
language sql stable
as $$ select p_company is not null and p_company = private.company_id() and private.user_role() is not null $$;

create or replace function private.is_admin(p_company uuid) returns boolean
language sql stable
as $$ select private.is_member(p_company) and private.user_role() = 'admin' $$;

-- Office = admin or designer (sales + money). Field users are excluded.
create or replace function private.is_office(p_company uuid) returns boolean
language sql stable
as $$ select private.is_member(p_company) and private.user_role() in ('admin', 'designer') $$;

create or replace function private.can_see_project(p_project uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and p.company_id = private.company_id()
      and (
        private.user_role() in ('admin', 'designer')
        or (private.user_role() = 'field' and exists (
              select 1 from public.project_members m
              where m.project_id = p.id and m.user_id = private.user_id()))
      )
  )
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'companies','users','pipeline_stages','follow_up_rules','lost_reasons','cost_categories',
    'milestone_definitions','payment_templates','payment_template_items','task_templates',
    'task_template_items','contacts','leads','quotes','projects','project_members','milestones',
    'tasks','change_orders','payments','costs','activities','meetings','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant usage, select on all sequences in schema public to authenticated;

-- companies: members read their own; admins rename.
create policy companies_select on public.companies for select to authenticated
  using (private.is_member(id));
create policy companies_update on public.companies for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

-- users: members read colleagues; admins manage roles. Inserts come from the webhook (service role).
create policy users_select on public.users for select to authenticated
  using (private.is_member(company_id));
create policy users_update on public.users for update to authenticated
  using (private.is_admin(company_id)) with check (private.is_admin(company_id));

-- Settings tables: everyone in the company reads, admins write.
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_stages','follow_up_rules','lost_reasons','cost_categories','milestone_definitions',
    'payment_templates','payment_template_items','task_templates','task_template_items'
  ] loop
    execute format($f$create policy %1$s_select on public.%1$I for select to authenticated
                      using (private.is_member(company_id))$f$, t);
    execute format($f$create policy %1$s_write on public.%1$I for all to authenticated
                      using (private.is_admin(company_id)) with check (private.is_admin(company_id))$f$, t);
  end loop;
end $$;

-- Sales tables: office only (admin + designer).
do $$
declare t text;
begin
  foreach t in array array['leads','quotes'] loop
    execute format($f$create policy %1$s_office on public.%1$I for all to authenticated
                      using (private.is_office(company_id)) with check (private.is_office(company_id))$f$, t);
  end loop;
end $$;

-- contacts: office full access; field can read the client of a project they're on.
create policy contacts_office on public.contacts for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));
create policy contacts_field_select on public.contacts for select to authenticated
  using (private.is_member(company_id) and exists (
    select 1 from public.projects p where p.contact_id = contacts.id and private.can_see_project(p.id)));

-- projects
create policy projects_select on public.projects for select to authenticated
  using (private.can_see_project(id));
create policy projects_office_write on public.projects for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));

create policy project_members_select on public.project_members for select to authenticated
  using (private.can_see_project(project_id));
create policy project_members_office_write on public.project_members for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));

-- milestones: visible with the project; office edits dates.
create policy milestones_select on public.milestones for select to authenticated
  using (private.can_see_project(project_id));
create policy milestones_office_write on public.milestones for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));

-- tasks: visible with the project; office full; field can update tasks on their projects.
create policy tasks_select on public.tasks for select to authenticated
  using (private.can_see_project(project_id));
create policy tasks_office_write on public.tasks for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));
create policy tasks_field_update on public.tasks for update to authenticated
  using (private.user_role() = 'field' and private.can_see_project(project_id))
  with check (private.user_role() = 'field' and private.can_see_project(project_id));

-- Money tables: office only.
do $$
declare t text;
begin
  foreach t in array array['payments','costs','change_orders'] loop
    execute format($f$create policy %1$s_office on public.%1$I for all to authenticated
                      using (private.is_office(company_id)) with check (private.is_office(company_id))$f$, t);
  end loop;
end $$;

-- activities / meetings: office sees all; field sees project-linked rows for their projects.
create policy activities_office on public.activities for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));
create policy activities_field_select on public.activities for select to authenticated
  using (project_id is not null and private.can_see_project(project_id));
create policy activities_field_insert on public.activities for insert to authenticated
  with check (project_id is not null and lead_id is null and private.can_see_project(project_id)
              and private.is_member(company_id));

create policy meetings_office on public.meetings for all to authenticated
  using (private.is_office(company_id)) with check (private.is_office(company_id));
create policy meetings_field_select on public.meetings for select to authenticated
  using (project_id is not null and private.can_see_project(project_id));

-- audit_log: admins read. Rows are written only by security-definer triggers.
create policy audit_log_select on public.audit_log for select to authenticated
  using (private.is_admin(company_id));
revoke insert, update, delete on public.audit_log from authenticated;
