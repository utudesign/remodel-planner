-- =============================================================================
-- 0004 Team engine (CONTEXT §4–§5, FIELD-AND-OFFICE §3, §7, §9)
--   * work windows, quiet hours, lead routing columns, response clock
--   * events (activity feed) written by triggers in the same transaction as the change
--   * comments + @mentions, notifications fan-out, push subscriptions, unread tracking
--   * shift handoffs / morning brief, scheduled client messages
--   * crew lockdown: crew never reads money (projects via crew_projects view)
--   * tables for later phases (site visits, design queue, info requests, issues, files) — no UI yet
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Columns on existing tables
-- ---------------------------------------------------------------------------
alter table public.users
  add column avatar_url   text,
  add column notify_prefs jsonb not null default '{}'::jsonb;   -- {"mute": ["new_lead", ...]}

alter table public.leads
  add column first_response_at timestamptz,                    -- first outbound touch (response clock)
  add column waiting_for_live  boolean not null default false; -- arrived when nobody was live

alter table public.meetings
  add column confirmed_at timestamptz;                          -- client confirmation sent

-- ---------------------------------------------------------------------------
-- Work windows (ET wall-clock; weekday 0 = Sunday … 6 = Saturday)
-- ---------------------------------------------------------------------------
create table public.work_windows (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,                    -- may be < start_time: window runs past midnight
  kind        text not null check (kind in ('live', 'back_office', 'field')),
  check (start_time <> end_time)
);
create index work_windows_company_idx on public.work_windows (company_id, weekday);

-- ---------------------------------------------------------------------------
-- Activity feed
-- ---------------------------------------------------------------------------
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  actor_id      uuid references public.users (id) on delete set null,
  entity_type   text not null,          -- lead | project | task | payment | comment | meeting | handoff | …
  entity_id     uuid,
  lead_id       uuid references public.leads (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete cascade,
  verb          text not null,          -- lead.created, payment.received, …
  summary       text not null,
  has_money     boolean not null default false,
  pinned_until  timestamptz,
  publish_at    timestamptz not null default now(),   -- morning brief posts ahead of time
  created_at    timestamptz not null default now()
);
create index events_company_time_idx on public.events (company_id, publish_at desc);
create index events_lead_idx on public.events (lead_id, created_at desc);
create index events_project_idx on public.events (project_id, created_at desc);

create table public.comments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  entity_type  text not null check (entity_type in ('lead', 'project', 'task')),
  entity_id    uuid not null,
  lead_id      uuid references public.leads (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  author_id    uuid not null references public.users (id) on delete cascade,
  body         text not null check (length(body) between 1 and 4000),
  mentions     uuid[] not null default '{}',
  photo_paths  text[] not null default '{}',     -- Storage paths in bucket "files"
  created_at   timestamptz not null default now(),
  check (num_nonnulls(lead_id, project_id) = 1)
);
create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  event_id    uuid references public.events (id) on delete cascade,
  comment_id  uuid references public.comments (id) on delete cascade,
  kind        text not null,      -- new_lead | mention | money | meeting | blocked | info_request | design_ready | digest
  title       text not null,
  body        text not null default '',
  url         text not null default '/today',
  read_at     timestamptz,
  pushed_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null unique,
  keys        jsonb not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table public.record_views (
  user_id       uuid not null references public.users (id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid not null,
  last_seen_at  timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

create table public.shift_handoffs (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  shift_kind   text not null check (shift_kind in ('live', 'back_office')),
  shift_date   date not null,                     -- ET date the shift started
  checklist    jsonb not null default '{}'::jsonb,
  body         text not null default '',
  posted_at    timestamptz,
  publish_at   timestamptz,                       -- back-office brief publishes at 7:00 AM ET
  unique (user_id, shift_kind, shift_date)
);

create table public.scheduled_messages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  lead_id     uuid references public.leads (id) on delete cascade,
  project_id  uuid references public.projects (id) on delete cascade,
  channel     text not null check (channel in ('sms', 'email', 'call_reminder')),
  body        text not null,
  send_at     timestamptz not null,
  reminded_at timestamptz,                       -- push reminder went out at send time
  sent_at     timestamptz,
  created_by  uuid references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (num_nonnulls(lead_id, project_id) >= 1)
);
create index scheduled_messages_due_idx on public.scheduled_messages (company_id, send_at) where sent_at is null;

-- ---------------------------------------------------------------------------
-- Later phases (schema only, per kickoff: full schema in Phase 1)
-- ---------------------------------------------------------------------------
create table public.files (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  lead_id      uuid references public.leads (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  kind         text not null check (kind in ('photo', 'design', 'contract', 'receipt', 'permit', 'check', 'sketch')),
  path         text not null,          -- Storage path in bucket "files"
  uploaded_by  uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

create table public.site_visits (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  lead_id              uuid not null references public.leads (id) on delete cascade,
  visited_at           timestamptz,
  visited_by           uuid[] not null default '{}',
  status               text not null default 'draft' check (status in ('draft', 'submitted', 'needs_info', 'accepted')),
  client               jsonb not null default '{}'::jsonb,
  scope                jsonb not null default '{}'::jsonb,
  walls                jsonb not null default '[]'::jsonb,
  appliances           jsonb not null default '[]'::jsonb,
  checklist            jsonb not null default '{}'::jsonb,
  sketch_file_id       uuid references public.files (id) on delete set null,
  promised             text,
  ballpark_low_cents   bigint,
  ballpark_high_cents  bigint,
  ballpark_inputs      jsonb,
  completeness         smallint not null default 0,
  submitted_at         timestamptz
);

create table public.design_requests (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  lead_id        uuid not null references public.leads (id) on delete cascade,
  site_visit_id  uuid references public.site_visits (id) on delete set null,
  assignee_id    uuid references public.users (id) on delete set null,
  status         text not null default 'waiting'
                   check (status in ('waiting', 'needs_info', 'in_design', 'ready', 'presented', 'revising', 'approved')),
  due_at         timestamptz,
  paused_at      timestamptz,
  ready_at       timestamptz,
  quote_id       uuid references public.quotes (id) on delete set null
);

create table public.info_requests (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  design_request_id  uuid not null references public.design_requests (id) on delete cascade,
  asked_by           uuid references public.users (id) on delete set null,
  asked_of           uuid references public.users (id) on delete set null,
  items              jsonb not null default '[]'::jsonb,
  answered_at        timestamptz,
  created_at         timestamptz not null default now()
);

create table public.issues (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  project_id            uuid not null references public.projects (id) on delete cascade,
  type                  text not null check (type in ('damage', 'delay', 'change_order', 'client', 'other')),
  description           text not null,
  cost_impact_cents     bigint,
  schedule_impact_days  int,
  status                text not null default 'open' check (status in ('open', 'resolved')),
  photo_paths           text[] not null default '{}',
  reported_by           uuid references public.users (id) on delete set null,
  created_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Crew lockdown: crew reads projects only through a view with no money columns.
-- (security_barrier view owned by postgres; it filters with can_see_project.)
-- ---------------------------------------------------------------------------
drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (private.is_team(company_id));

create view public.crew_projects with (security_barrier = true) as
  select p.id, p.company_id, p.contact_id, p.name, p.status, p.project_manager_id, p.created_at, p.closed_at
    from public.projects p
   where private.can_see_project(p.id);
grant select on public.crew_projects to authenticated;

-- ---------------------------------------------------------------------------
-- RLS for the new tables
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'work_windows','events','comments','notifications','push_subscriptions','record_views',
    'shift_handoffs','scheduled_messages','files','site_visits','design_requests','info_requests','issues'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

create policy work_windows_select on public.work_windows for select to authenticated
  using (private.is_member(company_id));
create policy work_windows_owner on public.work_windows for all to authenticated
  using (private.is_owner(company_id)) with check (private.is_owner(company_id));

-- events: written by triggers only. Crew: own jobs, no money, no sales.
revoke insert, update, delete on public.events from authenticated;
create policy events_team on public.events for select to authenticated
  using (private.is_team(company_id) and publish_at <= now());
create policy events_crew on public.events for select to authenticated
  using (private.user_role() = 'crew' and not has_money and lead_id is null
         and project_id is not null and private.can_see_project(project_id) and publish_at <= now());

create policy comments_team on public.comments for select to authenticated
  using (private.is_team(company_id));
create policy comments_crew on public.comments for select to authenticated
  using (project_id is not null and private.can_see_project(project_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (author_id = private.user_id() and private.is_member(company_id)
              and (private.is_team(company_id) or (project_id is not null and private.can_see_project(project_id))));
create policy comments_own_delete on public.comments for delete to authenticated
  using (author_id = private.user_id());

revoke insert, delete on public.notifications from authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (user_id = private.user_id());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = private.user_id()) with check (user_id = private.user_id());

create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = private.user_id()) with check (user_id = private.user_id() and private.is_member(company_id));

create policy record_views_own on public.record_views for all to authenticated
  using (user_id = private.user_id()) with check (user_id = private.user_id());

create policy handoffs_team_read on public.shift_handoffs for select to authenticated
  using (private.is_team(company_id));
create policy handoffs_own_write on public.shift_handoffs for all to authenticated
  using (user_id = private.user_id()) with check (user_id = private.user_id() and private.is_team(company_id));

do $$
declare t text;
begin
  foreach t in array array['scheduled_messages','site_visits','design_requests','info_requests'] loop
    execute format($f$create policy %1$s_team on public.%1$I for all to authenticated
                      using (private.is_team(company_id)) with check (private.is_team(company_id))$f$, t);
  end loop;
end $$;

create policy files_team on public.files for all to authenticated
  using (private.is_team(company_id)) with check (private.is_team(company_id));
create policy files_crew on public.files for select to authenticated
  using (project_id is not null and private.can_see_project(project_id) and kind not in ('check', 'receipt', 'contract'));

create policy issues_team on public.issues for all to authenticated
  using (private.is_team(company_id)) with check (private.is_team(company_id));
create policy issues_crew_read on public.issues for select to authenticated
  using (private.can_see_project(project_id));
create policy issues_crew_insert on public.issues for insert to authenticated
  with check (private.can_see_project(project_id) and reported_by = private.user_id());

-- ---------------------------------------------------------------------------
-- Event writer + notification fan-out
-- ---------------------------------------------------------------------------
create or replace function private.add_event(
  p_company uuid, p_entity_type text, p_entity_id uuid, p_lead uuid, p_project uuid,
  p_verb text, p_summary text, p_has_money boolean default false
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  insert into public.events (company_id, actor_id, entity_type, entity_id, lead_id, project_id, verb, summary, has_money)
  values (p_company, private.user_id(), p_entity_type, p_entity_id, p_lead, p_project, p_verb, p_summary, p_has_money)
  returning id into v_id;
  return v_id;
end $$;

-- Who gets notified, per kind: company override in settings_json.notify.<kind> (array of roles), else default.
create or replace function private.notify_roles(p_company uuid, p_kind text) returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select array(select jsonb_array_elements_text(c.settings_json -> 'notify' -> p_kind))
       from public.companies c where c.id = p_company and c.settings_json -> 'notify' ? p_kind),
    case p_kind
      when 'new_lead' then array['team']           -- + the lead owner (added separately)
      when 'money'    then array['owner', 'team']  -- "all three"
      when 'meeting'  then array['owner']
      when 'blocked'  then array[]::text[]         -- PM only (added separately)
      else array[]::text[]
    end)
$$;

create or replace function private.notify(
  p_company uuid, p_event uuid, p_kind text, p_title text, p_body text, p_url text, p_extra uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (company_id, user_id, event_id, kind, title, body, url)
  select p_company, u.id, p_event, p_kind, p_title, coalesce(p_body, ''), p_url
    from public.users u
   where u.company_id = p_company and u.active
     and u.id is distinct from private.user_id()
     and (u.role = any (private.notify_roles(p_company, p_kind)) or u.id = any (p_extra));
end $$;

-- leads: created / stage change / reassigned
create or replace function private.leads_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name  text;
  v_stage text;
  v_ev    uuid;
begin
  select name into v_name from public.contacts where id = new.contact_id;
  if tg_op = 'INSERT' then
    v_ev := private.add_event(new.company_id, 'lead', new.id, new.id, null, 'lead.created',
                              format('New lead: %s (%s)', v_name, replace(new.source, '_', ' ')));
    perform private.notify(new.company_id, v_ev, 'new_lead', format('New lead: %s', v_name),
                           case when new.waiting_for_live then 'Nobody is live right now. Reply within 1 hour.'
                                else 'Reply within 1 hour.' end,
                           '/leads/' || new.id, array[new.owner_id]);
    return null;
  end if;
  if new.stage_id is distinct from old.stage_id then
    select label into v_stage from public.pipeline_stages where id = new.stage_id;
    perform private.add_event(new.company_id, 'lead', new.id, new.id, null, 'lead.stage',
                              format('%s → %s', v_name, v_stage));
  end if;
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
    v_ev := private.add_event(new.company_id, 'lead', new.id, new.id, null, 'lead.assigned',
                              format('%s assigned to %s', v_name,
                                     (select name from public.users where id = new.owner_id)));
    perform private.notify(new.company_id, v_ev, 'assigned', format('Lead assigned to you: %s', v_name), '',
                           '/leads/' || new.id, array[new.owner_id]);
  end if;
  return null;
end $$;

create trigger leads_events after insert or update of stage_id, owner_id on public.leads
  for each row execute function private.leads_events();

-- The notify() above includes roles from notify_roles('assigned') = none, so only the new owner gets it.

-- activities: log touches + response clock
create or replace function private.activities_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_verb text;
begin
  if new.lead_id is null or new.type in ('stage_change', 'system') then return null; end if;
  select c.name into v_name from public.leads l join public.contacts c on c.id = l.contact_id where l.id = new.lead_id;
  v_verb := case new.type
    when 'call' then 'Call' when 'text' then 'Text' when 'fb_msg' then 'FB message'
    when 'email' then 'Email' when 'meeting' then 'Meeting' else 'Note' end;
  perform private.add_event(new.company_id, 'lead', new.lead_id, new.lead_id, null, 'activity.' || new.type,
    format('%s %s %s%s', v_verb, case new.direction when 'in' then 'from' when 'out' then 'with' else 'on' end, v_name,
           case when coalesce(new.summary, '') <> '' then ': ' || left(new.summary, 120) else '' end));
  if new.direction = 'out' then
    update public.leads
       set first_response_at = coalesce(first_response_at, new.occurred_at), waiting_for_live = false
     where id = new.lead_id and (first_response_at is null or waiting_for_live);
  end if;
  return null;
end $$;

create trigger activities_events after insert on public.activities
  for each row execute function private.activities_events();

-- projects: created (deposit) / closed
create or replace function private.projects_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_ev uuid;
begin
  if tg_op = 'INSERT' then
    v_ev := private.add_event(new.company_id, 'project', new.id, new.lead_id, new.id, 'project.created',
                              format('Deposit received — new job: %s', new.name), true);
    perform private.notify(new.company_id, v_ev, 'money', format('Deposit received: %s', new.name), 'New job created.',
                           '/projects/' || new.id);
  elsif new.status = 'closed' and old.status <> 'closed' then
    perform private.add_event(new.company_id, 'project', new.id, null, new.id, 'project.closed',
                              format('%s closed — margin locked at %s%%', new.name,
                                     round(coalesce(new.locked_margin_bps, 0) / 100.0, 1)), true);
  elsif new.project_manager_id is distinct from old.project_manager_id and new.project_manager_id is not null then
    perform private.add_event(new.company_id, 'project', new.id, null, new.id, 'project.assigned',
                              format('%s: PM is now %s', new.name,
                                     (select name from public.users where id = new.project_manager_id)));
  end if;
  return null;
end $$;

create trigger projects_events after insert or update of status, project_manager_id on public.projects
  for each row execute function private.projects_events();

-- payments received
create or replace function private.payments_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_ev   uuid;
begin
  if new.status = 'received' and old.status <> 'received' then
    select name into v_name from public.projects where id = new.project_id;
    v_ev := private.add_event(new.company_id, 'payment', new.id, null, new.project_id, 'payment.received',
                              format('$%s received — %s (%s)', to_char(new.amount_cents / 100.0, 'FM999,999,990.00'),
                                     v_name, new.label), true);
    perform private.notify(new.company_id, v_ev, 'money',
                           format('$%s received', to_char(new.amount_cents / 100.0, 'FM999,999,990.00')),
                           format('%s — %s', v_name, new.label), '/projects/' || new.project_id || '?tab=payments');
  end if;
  return null;
end $$;

create trigger payments_events after update of status on public.payments
  for each row execute function private.payments_events();

-- milestones done / undone
create or replace function private.milestones_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_name text;
begin
  if new.key in ('deposit_received', 'closed', 'final_payment') then return null; end if;
  select name into v_name from public.projects where id = new.project_id;
  if new.actual_date is not null and old.actual_date is null then
    perform private.add_event(new.company_id, 'project', new.project_id, null, new.project_id, 'milestone.done',
                              format('%s: %s done', v_name, new.name));
  elsif new.planned_date is distinct from old.planned_date and new.actual_date is null and new.planned_date is not null then
    perform private.add_event(new.company_id, 'project', new.project_id, null, new.project_id, 'milestone.planned',
                              format('%s: %s planned for %s', v_name, new.name, to_char(new.planned_date, 'Dy Mon DD')));
  end if;
  return null;
end $$;

create trigger milestones_events after update of actual_date, planned_date on public.milestones
  for each row execute function private.milestones_events();

-- tasks done / blocked
create or replace function private.tasks_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_ev uuid;
begin
  if new.status = old.status or new.status not in ('done', 'blocked') then return null; end if;
  select * into v_project from public.projects where id = new.project_id;
  v_ev := private.add_event(new.company_id, 'task', new.id, null, new.project_id, 'task.' || new.status,
                            format('%s: %s %s', v_project.name, case when new.status = 'done' then 'done —' else 'BLOCKED —' end,
                                   new.title));
  if new.status = 'blocked' and v_project.project_manager_id is not null then
    perform private.notify(new.company_id, v_ev, 'blocked', format('Blocked: %s', new.title), v_project.name,
                           '/projects/' || new.project_id || '?tab=tasks', array[v_project.project_manager_id]);
  end if;
  return null;
end $$;

create trigger tasks_events after update of status on public.tasks
  for each row execute function private.tasks_events();

-- meetings booked / moved
create or replace function private.meetings_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_ev uuid;
  v_when text := to_char(new.scheduled_at at time zone 'America/New_York', 'Dy Mon DD, HH12:MI AM');
begin
  if tg_op = 'UPDATE' and new.scheduled_at = old.scheduled_at then return null; end if;
  select c.name into v_name from public.leads l join public.contacts c on c.id = l.contact_id where l.id = new.lead_id;
  v_ev := private.add_event(new.company_id, 'meeting', new.id, new.lead_id, new.project_id,
                            case when tg_op = 'INSERT' then 'meeting.booked' else 'meeting.moved' end,
                            format('%s %s: %s', case when tg_op = 'INSERT' then 'Meeting booked' else 'Meeting moved' end,
                                   coalesce(v_name, ''), v_when));
  perform private.notify(new.company_id, v_ev, 'meeting', format('Meeting %s: %s', case when tg_op = 'INSERT' then 'booked' else 'moved' end, coalesce(v_name, '')),
                         v_when, coalesce('/leads/' || new.lead_id, '/today'));
  return null;
end $$;

create trigger meetings_events after insert or update of scheduled_at on public.meetings
  for each row execute function private.meetings_events();

-- comments: event + @mentions + replies to people already in the thread
create or replace function private.comments_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_subject text;
  v_url     text;
  v_author  text;
  v_ev      uuid;
  v_thread  uuid[];
begin
  select name into v_author from public.users where id = new.author_id;
  if new.lead_id is not null then
    select c.name into v_subject from public.leads l join public.contacts c on c.id = l.contact_id where l.id = new.lead_id;
    v_url := '/leads/' || new.lead_id || '#comments';
  else
    select name into v_subject from public.projects where id = new.project_id;
    v_url := '/projects/' || new.project_id || '?tab=comments';
  end if;
  v_ev := private.add_event(new.company_id, 'comment', new.id, new.lead_id, new.project_id, 'comment.added',
                            format('%s on %s: %s', v_author, v_subject, left(new.body, 140)));
  select coalesce(array_agg(distinct author_id), '{}') into v_thread
    from public.comments where entity_type = new.entity_type and entity_id = new.entity_id and id <> new.id;

  insert into public.notifications (company_id, user_id, event_id, comment_id, kind, title, body, url)
  select new.company_id, u.id, v_ev, new.id, 'mention',
         case when u.id = any (new.mentions) then format('%s mentioned you', v_author)
              else format('%s replied on %s', v_author, v_subject) end,
         left(new.body, 200), v_url
    from public.users u
   where u.company_id = new.company_id and u.active and u.id <> new.author_id
     and (u.id = any (new.mentions) or u.id = any (v_thread))
     -- crew only hear about threads they can see
     and (u.role <> 'crew' or new.project_id is not null);
  return null;
end $$;

create trigger comments_events after insert on public.comments
  for each row execute function private.comments_events();

-- shift handoff posted → pinned in the feed (back-office brief publishes at 7:00 AM ET)
create or replace function private.handoffs_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_pub timestamptz := coalesce(new.publish_at, now());
begin
  if new.posted_at is not null and old.posted_at is null then
    insert into public.events (company_id, actor_id, entity_type, entity_id, verb, summary, pinned_until, publish_at)
    values (new.company_id, new.user_id, 'handoff', new.id,
            case when new.shift_kind = 'back_office' then 'handoff.brief' else 'handoff.live' end,
            new.body, v_pub + interval '24 hours', v_pub);
  end if;
  return null;
end $$;

create trigger handoffs_events after update of posted_at on public.shift_handoffs
  for each row execute function private.handoffs_events();

-- ---------------------------------------------------------------------------
-- Storage bucket for photos (comments, checks, site visits). Private; the app serves signed URLs.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;
  end if;
end $$;

-- Default company settings for the team engine (FIELD-AND-OFFICE §3).
update public.companies
   set settings_json = jsonb_build_object(
         'quiet_hours_start', '21:00', 'quiet_hours_end', '08:00', 'lead_response_minutes', 60,
         'design_due_days', 5, 'visit_buffer_minutes', 30, 'target_margin_bps', 3500) || settings_json;
