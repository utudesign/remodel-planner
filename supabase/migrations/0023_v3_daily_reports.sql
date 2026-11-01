-- =====================================================================
-- 0023 — change request v3, batch F3: the 60-second daily report (PLAN v3 item 14)
--
--   Worker picks a job → sets % on today's tasks → adds issues (type, note, photo, needs re-order)
--   → tomorrow's plan → Submit. submit_daily_report() does it in one transaction:
--     * updates task % (own tasks; the job's manager: any) — the tasks trigger keeps status in step
--     * one report per job, person and day (re-submitting replaces it)
--     * notifies the deal owner + job manager (issues that need a re-order are flagged)
--   Reports and issues show on the Job tab, in Today and in the deal's History (0018 audit trigger).
--   No money anywhere. Issue types live in the database (job_issue_types, Settings).
-- =====================================================================

create table public.job_issue_types (
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null check (length(btrim(label)) between 1 and 60),
  sort_order  int not null default 0,
  active      boolean not null default true,
  primary key (company_id, key)
);
alter table public.job_issue_types enable row level security;
create policy job_issue_types_read on public.job_issue_types for select to authenticated
  using (company_id = public.current_company_id());
create policy job_issue_types_owner on public.job_issue_types for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create table public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  author_id     uuid not null references public.users (id) on delete cascade,
  report_date   date not null,                -- the work day in the company's time zone
  tomorrow_plan text check (tomorrow_plan is null or length(tomorrow_plan) <= 1000),
  note          text check (note is null or length(note) <= 2000),
  -- [{task_id, title, pct_before, pct_after}] as submitted (the tasks themselves hold the live %)
  progress      jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (project_id, author_id, report_date)
);
create index daily_reports_project on public.daily_reports (project_id, report_date desc);
create index daily_reports_company_day on public.daily_reports (company_id, report_date desc);

create table public.daily_report_issues (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  report_id      uuid not null references public.daily_reports (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  type_key       text not null,
  note           text not null default '' check (length(note) <= 1000),
  file_id        uuid references public.deal_files (id) on delete set null,
  needs_reorder  boolean not null default false,
  resolved_at    timestamptz,
  resolved_by    uuid references public.users (id) on delete set null,
  created_at     timestamptz not null default now(),
  check (length(btrim(note)) > 0 or file_id is not null)
);
create index daily_report_issues_open on public.daily_report_issues (company_id, created_at desc) where resolved_at is null;

alter table public.daily_reports enable row level security;
alter table public.daily_report_issues enable row level security;
-- Read: the team (workspace rules) and the workers on that job. Writes: submit_daily_report() only;
-- the team marks issues resolved.
create policy daily_reports_read on public.daily_reports for select to authenticated
  using (company_id = public.current_company_id()
         and ((public.is_team() and public.can_see_project(project_id)) or public.is_worker_on_project(project_id)));
create policy daily_report_issues_read on public.daily_report_issues for select to authenticated
  using (company_id = public.current_company_id()
         and ((public.is_team() and public.can_see_project(project_id)) or public.is_worker_on_project(project_id)));
create policy daily_report_issues_resolve on public.daily_report_issues for update to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_project(project_id));

create or replace function private.daily_report_issues_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- the team may only resolve / reopen
  if (new.company_id, new.report_id, new.project_id, new.type_key, new.note, new.file_id, new.needs_reorder, new.created_at)
     is distinct from
     (old.company_id, old.report_id, old.project_id, old.type_key, old.note, old.file_id, old.needs_reorder, old.created_at) then
    raise exception 'Only resolving an issue can change it' using errcode = 'check_violation';
  end if;
  new.resolved_by := case when new.resolved_at is null then null else public.current_user_id() end;
  return new;
end $$;
create trigger daily_report_issues_guard before update on public.daily_report_issues
  for each row execute function private.daily_report_issues_guard();

create trigger zz_audit after insert or update on public.daily_reports
  for each row execute function private.audit_row('project');
create trigger zz_audit after insert or update or delete on public.daily_report_issues
  for each row execute function private.audit_row('project');

-- ---------------------------------------------------------------------
-- Submit
-- p_progress: [{"task_id": "...", "pct": 60}]   p_issues: [{"type": "missing_material", "note": "...",
--             "file_id": null, "needs_reorder": true}]
-- ---------------------------------------------------------------------
create or replace function public.submit_daily_report(
  p_project uuid, p_progress jsonb, p_issues jsonb, p_tomorrow text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := public.current_user_id();
  v_company uuid := public.current_company_id();
  v_tz text;
  v_day date;
  v_proj record;
  v_report uuid;
  v_item jsonb;
  v_task record;
  v_pct int;
  v_log jsonb := '[]'::jsonb;
  v_issue jsonb;
  v_reorder int := 0;
  v_issues int := 0;
  v_who text;
  v_notify uuid;
begin
  select p.id, p.company_id, p.project_manager_id, p.deal_id, d.owner_id, d.deal_number, coalesce(p.name, d.title) as name
    into v_proj
    from public.projects p join public.deals d on d.id = p.deal_id
   where p.id = p_project and p.company_id = v_company;
  if not found or not (public.is_worker_on_project(p_project) or (public.is_team() and public.can_see_project(p_project))) then
    raise exception 'Not your job' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_progress, '[]')) <> 'array' or jsonb_typeof(coalesce(p_issues, '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_progress, '[]')) > 60 or jsonb_array_length(coalesce(p_issues, '[]')) > 10 then
    raise exception 'Bad report' using errcode = 'check_violation';
  end if;
  select timezone into v_tz from public.companies where id = v_company;
  v_day := (now() at time zone coalesce(v_tz, 'America/New_York'))::date;

  for v_item in select * from jsonb_array_elements(coalesce(p_progress, '[]')) loop
    v_pct := (v_item ->> 'pct')::int;
    if v_pct is null or v_pct < 0 or v_pct > 100 then raise exception 'Percent is 0–100' using errcode = 'check_violation'; end if;
    select id, title, pct, assignee_id into v_task from public.tasks
     where id = (v_item ->> 'task_id')::uuid and project_id = p_project;
    if not found then raise exception 'That task is not on this job' using errcode = 'check_violation'; end if;
    if public.current_app_role() = 'crew' and v_task.assignee_id is distinct from v_me
       and v_proj.project_manager_id is distinct from v_me then
      raise exception 'Not your task: %', v_task.title using errcode = '42501';
    end if;
    v_log := v_log || jsonb_build_object('task_id', v_task.id, 'title', v_task.title, 'pct_before', v_task.pct, 'pct_after', v_pct);
    if v_pct <> v_task.pct then update public.tasks set pct = v_pct where id = v_task.id; end if;
  end loop;

  insert into public.daily_reports (company_id, project_id, author_id, report_date, tomorrow_plan, note, progress)
  values (v_company, p_project, v_me, v_day, nullif(btrim(coalesce(p_tomorrow, '')), ''), nullif(btrim(coalesce(p_note, '')), ''), v_log)
  on conflict (project_id, author_id, report_date) do update
     set tomorrow_plan = excluded.tomorrow_plan, note = excluded.note, progress = excluded.progress, updated_at = now()
  returning id into v_report;

  delete from public.daily_report_issues where report_id = v_report and resolved_at is null;
  for v_issue in select * from jsonb_array_elements(coalesce(p_issues, '[]')) loop
    if not exists (select 1 from public.job_issue_types where company_id = v_company and key = v_issue ->> 'type' and active) then
      raise exception 'Pick an issue type' using errcode = 'check_violation';
    end if;
    if nullif(v_issue ->> 'file_id', '') is not null and not exists (
         select 1 from public.deal_files f where f.id = (v_issue ->> 'file_id')::uuid and f.deal_id = v_proj.deal_id
            and f.folder = 'photos' and f.deleted_at is null) then
      raise exception 'That photo is not on this job' using errcode = 'check_violation';
    end if;
    insert into public.daily_report_issues (company_id, report_id, project_id, type_key, note, file_id, needs_reorder)
    values (v_company, v_report, p_project, v_issue ->> 'type', btrim(coalesce(v_issue ->> 'note', '')),
            nullif(v_issue ->> 'file_id', '')::uuid, coalesce((v_issue ->> 'needs_reorder')::boolean, false));
    v_issues := v_issues + 1;
    if coalesce((v_issue ->> 'needs_reorder')::boolean, false) then v_reorder := v_reorder + 1; end if;
  end loop;

  -- Tell the office: deal owner + job manager (not the author, not crew).
  select coalesce(name, 'A worker') into v_who from public.users where id = v_me;
  for v_notify in
    select distinct u.id from public.users u
     where u.id in (v_proj.owner_id, v_proj.project_manager_id) and u.id <> v_me and u.active and u.role in ('owner', 'team', 'partner')
  loop
    insert into public.notifications (company_id, user_id, kind, title, body, url, deal_id)
    values (v_company, v_notify, case when v_reorder > 0 then 'job_issue' else 'daily_report' end,
            case when v_reorder > 0 then 'Re-order needed · #' || v_proj.deal_number
                 when v_issues > 0 then 'Issue on #' || v_proj.deal_number
                 else 'Daily report · #' || v_proj.deal_number end,
            v_who || ': ' || jsonb_array_length(v_log) || ' task(s) updated'
              || case when v_issues > 0 then ', ' || v_issues || ' issue(s)' else '' end,
            '/deals/' || v_proj.deal_number || '?tab=job', v_proj.deal_id);
  end loop;
  return v_report;
end $$;
revoke execute on function public.submit_daily_report(uuid, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.submit_daily_report(uuid, jsonb, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------
create or replace function public.seed_daily_reports_v3(p_company uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.job_issue_types (company_id, key, label, sort_order) values
    (p_company, 'missing_material', 'Missing / wrong material', 1),
    (p_company, 'damage', 'Damaged item', 2),
    (p_company, 'site_problem', 'Site problem (wall, plumbing, electric)', 3),
    (p_company, 'client_request', 'Client asked for a change', 4),
    (p_company, 'access', 'Couldn''t get in / access', 5),
    (p_company, 'safety', 'Safety', 6),
    (p_company, 'other', 'Other', 7)
  on conflict do nothing
$$;
revoke execute on function public.seed_daily_reports_v3(uuid) from public, anon, authenticated;

create or replace function private.companies_seed_daily_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_daily_reports_v3(new.id);
  return new;
end $$;
create trigger companies_zz_daily_reports after insert on public.companies
  for each row execute function private.companies_seed_daily_reports();

select public.seed_daily_reports_v3(id) from public.companies;

notify pgrst, 'reload schema';
