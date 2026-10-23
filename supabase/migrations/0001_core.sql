-- =====================================================================
-- 0001_core.sql — the base the handoff migrations 0002–0006 build on.
--
-- The app is Tugu's sales tool (docs/SALES-REP-MODE.md). One company = one
-- rep's account. Roles: owner (the rep), partner (a contractor's login, 0006),
-- team / crew (contractor module, unused for now).
--
-- Column names on the contractor tables (projects, tasks, costs, payments,
-- change_orders, quotes) follow docs/CONTEXT.md §5 exactly — the tested
-- migrations 0002–0006 depend on them (see docs/DECISIONS.md).
--
-- Identity: Clerk session token via Supabase third-party auth. auth.jwt()->>'sub'
-- is the Clerk user id; public.users maps it to a company and a role.
-- Money = bigint cents. Events = timestamptz (UTC). Calendar days = date.
-- =====================================================================

create extension if not exists pgcrypto;
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Tenancy
-- ---------------------------------------------------------------------
create table public.companies (
  id             uuid primary key default gen_random_uuid(),
  clerk_org_id   text unique,                       -- unused in sales-rep mode
  name           text not null,
  timezone       text not null default 'America/New_York',
  settings_json  jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create table public.users (
  id                uuid primary key default gen_random_uuid(),
  clerk_id          text unique not null,
  company_id        uuid not null references public.companies (id) on delete cascade,
  name              text,
  email             text,
  phone             text,
  role              text not null check (role in ('owner', 'partner', 'team', 'crew')),
  is_default_owner  boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index users_company_idx on public.users (company_id);
create unique index users_one_default_owner on public.users (company_id) where is_default_owner;

-- ---------------------------------------------------------------------
-- 2. Helpers (same definitions as 0002 §1, so its "create or replace" is a no-op)
-- ---------------------------------------------------------------------
create or replace function public.current_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.users where clerk_id = (auth.jwt() ->> 'sub') limit 1
$$;

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.users where clerk_id = (auth.jwt() ->> 'sub') limit 1
$$;

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where clerk_id = (auth.jwt() ->> 'sub') limit 1
$$;

create or replace function public.is_owner()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create or replace function public.is_team()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() in ('owner', 'team'), false)
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- True outside a signed-in request (migrations, seed, service-role jobs, tests).
create or replace function private.is_system() returns boolean
language sql stable as $$ select (auth.jwt() ->> 'sub') is null $$;

create or replace function private.company_today(p_company uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.companies c where c.id = p_company), 'America/New_York'))::date
$$;

-- ---------------------------------------------------------------------
-- 3. Settings that drive the workflow (editable in Settings, never hard-coded)
-- ---------------------------------------------------------------------
-- kind: open = I'm working it; handed_off = with a partner; lost.
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,
  label       text not null,
  kind        text not null default 'open' check (kind in ('open', 'handed_off', 'lost')),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

-- Follow-up cadence per stage: the next follow-up after entering the stage or logging a touch.
create table public.follow_up_rules (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  stage_key     text not null,
  sequence      int  not null default 1,
  offset_days   int  not null default 0 check (offset_days >= 0),
  offset_hours  int  not null default 0 check (offset_hours >= 0),
  description   text not null default '',
  unique (company_id, stage_key, sequence)
);

create table public.lost_reasons (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

-- ---------------------------------------------------------------------
-- 4. Customers and deals
-- ---------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies (id) on delete cascade,
  name        text,
  phone       text,
  email       text,
  address     text,
  city        text,
  zip         text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index contacts_company_idx on public.contacts (company_id);

-- 0004 adds deal_year/deal_seq/deal_number/opened_on/permit_required/deleted_at,
-- 0005 year_built/first_response_at/cancelled_at/lost_reason/…, 0006 partner + job fields.
create table public.deals (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  contact_id         uuid references public.contacts (id) on delete restrict,
  source             text,
  stage              text not null default 'new',           -- pipeline_stages.key
  owner_id           uuid references public.users (id) on delete set null,
  title              text,                                   -- "Lee kitchen"
  scope              text check (scope in ('kitchen', 'cabinets_only', 'countertops', 'bath', 'other')),
  budget_min_cents   bigint check (budget_min_cents >= 0),
  budget_max_cents   bigint check (budget_max_cents >= 0),
  timeline           text,                                   -- asap | 1_3_months | 3_6_months | later
  decision_maker     text,
  owns_home          boolean,
  knowledge_level    smallint check (knowledge_level between 1 and 3),  -- 1 just looking … 3 knows exactly
  estimated_value_cents bigint check (estimated_value_cents >= 0),
  notes              text,
  next_follow_up_at  timestamptz,
  last_touch_at      timestamptz,
  stage_entered_at   timestamptz not null default now(),
  created_at         timestamptz default now(),
  updated_at         timestamptz not null default now(),
  check (budget_min_cents is null or budget_max_cents is null or budget_min_cents <= budget_max_cents)
);
create index deals_company_stage_idx on public.deals (company_id, stage);
create index deals_follow_up_idx on public.deals (company_id, next_follow_up_at);

create table public.quotes (
  id               uuid primary key default gen_random_uuid(),
  deal_id          uuid not null references public.deals (id) on delete cascade,
  version          int not null default 1,
  line_items_json  jsonb,
  subtotal         bigint,
  tax              bigint,
  total            bigint,
  sent_at          timestamptz,
  approved_at      timestamptz,
  file_url         text
);

-- ---------------------------------------------------------------------
-- 5. Contractor module tables (CONTEXT §5 names; no screens in sales-rep mode)
-- ---------------------------------------------------------------------
create table public.projects (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  deal_id             uuid references public.deals (id) on delete set null,
  contact_id          uuid references public.contacts (id),
  name                text,
  status              text default 'active',
  project_manager_id  uuid references public.users (id),
  contract_value      bigint,
  order_date          date,
  closed_at           timestamptz,
  created_at          timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references public.projects (id) on delete cascade,
  title        text,
  assignee_id  uuid references public.users (id),
  status       text default 'todo',
  due_date     date,
  created_at   timestamptz not null default now()
);

create table public.costs (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  category          text not null,
  vendor            text,
  estimated_amount  bigint,
  actual_amount     bigint,
  paid_at           timestamptz,
  receipt_url       text
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  label         text,
  amount        bigint not null,
  due_date      date,
  received_at   timestamptz,
  method        text,
  check_number  text,
  status        text default 'due'
);

create table public.change_orders (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  description  text,
  price_change bigint not null default 0,
  cost_change  bigint not null default 0,
  approved_at  timestamptz
);

-- Same definition as 0002 §1.
create or replace function public.is_assigned_to_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.company_id = public.current_company_id()
      and (
        p.project_manager_id = public.current_user_id()
        or exists (select 1 from public.tasks t
                   where t.project_id = p.id and t.assignee_id = public.current_user_id())
      )
  )
$$;

-- ---------------------------------------------------------------------
-- 6. The rep's own sales work
-- ---------------------------------------------------------------------
-- Site visit: measurements, appliances, checklist, ballpark (FIELD-AND-OFFICE §4).
create table public.site_visits (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid references public.companies (id) on delete cascade,
  deal_id              uuid references public.deals (id) on delete cascade,
  visited_at           timestamptz,
  status               text not null default 'draft' check (status in ('draft', 'done')),
  walls                jsonb not null default '[]'::jsonb,
  appliances           jsonb not null default '[]'::jsonb,
  checklist            jsonb not null default '{}'::jsonb,
  notes                text,
  ballpark_low_cents   bigint,
  ballpark_high_cents  bigint,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index site_visits_deal_idx on public.site_visits (deal_id);

create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  deal_id      uuid not null references public.deals (id) on delete cascade,
  type         text not null check (type in ('call', 'text', 'email', 'fb_msg', 'visit', 'note', 'stage_change', 'system')),
  direction    text check (direction in ('in', 'out')),
  summary      text not null default '',
  created_by   uuid references public.users (id) on delete set null,
  occurred_at  timestamptz not null default now()
);
create index activities_deal_idx on public.activities (deal_id, occurred_at desc);

-- Visits and calls on the calendar (booked by me or by the client from the booking link).
create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  deal_id       uuid not null references public.deals (id) on delete cascade,
  kind          text not null default 'visit' check (kind in ('visit', 'call', 'other')),
  starts_at     timestamptz not null,
  ends_at       timestamptz,
  status        text not null default 'scheduled' check (status in ('scheduled', 'done', 'canceled')),
  booked_via    text not null default 'manual' check (booked_via in ('manual', 'link')),
  notes         text,
  created_at    timestamptz not null default now()
);
create index meetings_company_time_idx on public.meetings (company_id, starts_at);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        text not null,
  title       text not null,
  body        text,
  url         text,
  deal_id     uuid references public.deals (id) on delete cascade,
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  pushed_at   timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  company_id  uuid not null references public.companies (id) on delete cascade,
  actor_id    uuid references public.users (id) on delete set null,
  table_name  text not null,
  record_id   uuid,
  action      text not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. Default settings for a new company (stages, follow-ups, lost reasons).
--    Estimating, jacket, hand-off and partner defaults are added in 0007.
-- ---------------------------------------------------------------------
create or replace function public.seed_sales_defaults(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pipeline_stages (company_id, key, label, kind, sort_order) values
    (p_company, 'new',          'Lead',              'open',       1),
    (p_company, 'qualified',    'Qualified',         'open',       2),
    (p_company, 'visit_booked', 'Visit booked',      'open',       3),
    (p_company, 'visit_done',   'Visit done',        'open',       4),
    (p_company, 'estimate',     'Estimate',          'open',       5),
    (p_company, 'ready',        'Ready to hand off', 'open',       6),
    (p_company, 'handed_off',   'Handed off',        'handed_off', 7),
    (p_company, 'lost',         'Lost',              'lost',       8)
  on conflict (company_id, key) do nothing;

  insert into public.follow_up_rules (company_id, stage_key, sequence, offset_days, offset_hours, description) values
    (p_company, 'new',          1, 0, 1, 'Reply within the hour'),
    (p_company, 'qualified',    1, 1, 0, 'Book the visit'),
    (p_company, 'qualified',    2, 2, 0, 'Follow up again'),
    (p_company, 'visit_booked', 1, 1, 0, 'Confirm the visit the day before'),
    (p_company, 'visit_done',   1, 2, 0, 'Send the estimate within 2 days'),
    (p_company, 'estimate',     1, 2, 0, 'Follow up on the estimate'),
    (p_company, 'estimate',     2, 5, 0, 'Follow up again'),
    (p_company, 'ready',        1, 1, 0, 'Hand off to the partner'),
    (p_company, 'handed_off',   1, 7, 0, 'Ask the partner for an update')
  on conflict (company_id, stage_key, sequence) do nothing;

  insert into public.lost_reasons (company_id, key, label, sort_order) values
    (p_company, 'price',       'Price',                 1),
    (p_company, 'competitor',  'Went with someone else',2),
    (p_company, 'timing',      'Timing / postponed',    3),
    (p_company, 'no_response', 'No response',           4),
    (p_company, 'out_of_area', 'Out of area',           5),
    (p_company, 'too_small',   'Too small',             6),
    (p_company, 'renter',      'Renter / not the owner',7),
    (p_company, 'other',       'Other',                 8)
  on conflict (company_id, key) do nothing;
end $$;
revoke execute on function public.seed_sales_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_sales_defaults(uuid) to service_role;

create or replace function private.companies_seed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_sales_defaults(new.id);
  return null;
end $$;
create trigger companies_seed after insert on public.companies
  for each row execute function private.companies_seed();

-- ---------------------------------------------------------------------
-- 8. Deal guard: stage must exist (app writes), owner + follow-up defaults,
--    stage timestamps. 0007 replaces this function with the full version.
-- ---------------------------------------------------------------------
create or replace function private.next_follow_up(p_company uuid, p_stage text, p_from timestamptz)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select case
    when s.kind = 'lost' then null
    else p_from + coalesce(
      (select make_interval(days => r.offset_days, hours => r.offset_hours)
         from public.follow_up_rules r
        where r.company_id = p_company and r.stage_key = p_stage
        order by r.sequence limit 1),
      interval '1 day')
  end
  from (select coalesce((select kind from public.pipeline_stages
                          where company_id = p_company and key = p_stage), 'open') as kind) s
$$;

create or replace function private.deals_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_system() and not exists (
      select 1 from public.pipeline_stages s where s.company_id = new.company_id and s.key = new.stage) then
    raise exception 'Unknown stage "%"', new.stage using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' then
    if new.owner_id is null then
      select u.id into new.owner_id from public.users u
       where u.company_id = new.company_id and u.is_default_owner and u.active;
    end if;
    if new.next_follow_up_at is null then
      new.next_follow_up_at := private.next_follow_up(new.company_id, new.stage, coalesce(new.created_at, now()));
    end if;
  else
    if new.stage is distinct from old.stage then
      new.stage_entered_at := now();
      new.next_follow_up_at := private.next_follow_up(new.company_id, new.stage, now());
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
-- Named to fire last (triggers run in name order): 0006's partner guard must see the
-- partner's update before this one stamps updated_at / follow-up dates.
create trigger deals_zz_defaults before insert or update on public.deals
  for each row execute function private.deals_guard();

create or replace function private.deals_log_stage_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_from text; v_to text;
begin
  select label into v_from from public.pipeline_stages where company_id = new.company_id and key = old.stage;
  select label into v_to   from public.pipeline_stages where company_id = new.company_id and key = new.stage;
  insert into public.activities (company_id, deal_id, type, summary, created_by)
  values (new.company_id, new.id, 'stage_change',
          format('%s → %s', coalesce(v_from, old.stage), coalesce(v_to, new.stage)), public.current_user_id());
  return null;
end $$;
create trigger deals_log_stage_change after update of stage on public.deals
  for each row when (old.stage is distinct from new.stage)
  execute function private.deals_log_stage_change();

-- A logged touch (call, text, message, visit) moves the follow-up date forward.
create or replace function private.activities_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('call', 'text', 'email', 'fb_msg', 'visit') then
    update public.deals d
       set last_touch_at = new.occurred_at,
           next_follow_up_at = private.next_follow_up(d.company_id, d.stage, new.occurred_at)
     where d.id = new.deal_id;
  end if;
  return null;
end $$;
create trigger activities_touch after insert on public.activities
  for each row execute function private.activities_touch();

create trigger site_visits_updated before update on public.site_visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Row Level Security. Owner + team see the company's records; a partner
--    only gets the narrow policies 0006 adds; crew gets nothing here.
-- ---------------------------------------------------------------------
alter table public.companies          enable row level security;
alter table public.users              enable row level security;
alter table public.pipeline_stages    enable row level security;
alter table public.follow_up_rules    enable row level security;
alter table public.lost_reasons       enable row level security;
alter table public.contacts           enable row level security;
alter table public.deals              enable row level security;
alter table public.projects           enable row level security;
alter table public.tasks              enable row level security;
alter table public.costs              enable row level security;
alter table public.payments           enable row level security;
alter table public.change_orders      enable row level security;
alter table public.site_visits        enable row level security;
alter table public.activities         enable row level security;
alter table public.meetings           enable row level security;
alter table public.notifications      enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_log          enable row level security;

create policy companies_read on public.companies for select to authenticated
  using (id = public.current_company_id());
create policy companies_owner on public.companies for update to authenticated
  using (id = public.current_company_id() and public.is_owner())
  with check (id = public.current_company_id() and public.is_owner());

create policy users_team_read on public.users for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy users_self_read on public.users for select to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'));
create policy users_owner_write on public.users for update to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Settings: everyone in the company reads; the owner edits.
do $$
declare t text;
begin
  foreach t in array array['pipeline_stages', 'follow_up_rules', 'lost_reasons'] loop
    execute format($f$create policy %1$s_read on public.%1$s for select to authenticated
                      using (company_id = public.current_company_id())$f$, t);
    execute format($f$create policy %1$s_owner on public.%1$s for all to authenticated
                      using (company_id = public.current_company_id() and public.is_owner())
                      with check (company_id = public.current_company_id() and public.is_owner())$f$, t);
  end loop;
end $$;

-- Sales records: owner + team. (0006 replaces deals_team and adds the partner's view.)
do $$
declare t text;
begin
  foreach t in array array['contacts', 'deals', 'site_visits', 'activities', 'meetings', 'projects'] loop
    execute format($f$create policy %1$s_team on public.%1$s for all to authenticated
                      using (company_id = public.current_company_id() and public.is_team())
                      with check (company_id = public.current_company_id() and public.is_team())$f$, t);
  end loop;
end $$;

-- Contractor module: crew read the jobs they're assigned to (0004's file rules rely on it).
create policy projects_crew_read on public.projects for select to authenticated
  using (company_id = public.current_company_id() and public.is_assigned_to_project(id));
create policy deals_crew_read on public.deals for select to authenticated
  using (company_id = public.current_company_id() and exists (
           select 1 from public.projects p where p.deal_id = deals.id and public.is_assigned_to_project(p.id)));

-- Contractor children: through their project.
do $$
declare t text;
begin
  foreach t in array array['tasks', 'costs', 'payments', 'change_orders'] loop
    execute format($f$create policy %1$s_team on public.%1$s for all to authenticated
                      using (public.is_team() and exists (select 1 from public.projects p
                             where p.id = project_id and p.company_id = public.current_company_id()))
                      with check (public.is_team() and exists (select 1 from public.projects p
                             where p.id = project_id and p.company_id = public.current_company_id()))$f$, t);
  end loop;
end $$;

create policy notifications_own on public.notifications for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id());
create policy push_own on public.push_subscriptions for all to authenticated
  using (user_id = public.current_user_id())
  with check (user_id = public.current_user_id() and company_id = public.current_company_id());
create policy audit_owner_read on public.audit_log for select to authenticated
  using (company_id = public.current_company_id() and public.is_owner());

-- Supabase grants table privileges to these roles by default; mirror it so a plain
-- Postgres (tests) behaves the same. RLS decides what each signed-in user sees.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
grant execute on all functions in schema private to authenticated, service_role;
