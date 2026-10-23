-- =============================================================================
-- 0001 core schema: companies, users, settings tables, sales + delivery tables.
-- Money = bigint cents. Events = timestamptz (UTC). Calendar days = date.
-- RLS policies live in 0002. Business-rule triggers live in 0003.
-- =============================================================================

create extension if not exists pgcrypto;

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  clerk_org_id  text unique,
  name          text not null,
  timezone      text not null default 'America/New_York',
  settings_json jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table public.users (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  clerk_id    text not null,
  name        text not null default '',
  email       text,
  phone       text,
  role        text not null default 'crew' check (role in ('owner', 'team', 'crew')),
  is_default_owner boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, clerk_id)
);
create index users_clerk_id_idx on public.users (clerk_id);
-- At most one default lead owner per company.
create unique index users_one_default_owner on public.users (company_id) where is_default_owner;

-- ---------------------------------------------------------------------------
-- Settings (all editable by owners; nothing is hard-coded in the app)
-- ---------------------------------------------------------------------------
create table public.pipeline_stages (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,                -- stable id used by logic: new, contacted, ..., won, lost
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

create table public.follow_up_rules (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  stage_id     uuid not null references public.pipeline_stages (id) on delete cascade,
  sequence     int  not null default 1,      -- 1st, 2nd, 3rd follow-up in this stage
  offset_days  int  not null default 0 check (offset_days >= 0),
  offset_hours int  not null default 0 check (offset_hours >= 0),
  description  text not null default '',
  unique (stage_id, sequence)
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

create table public.cost_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

-- Delivery milestones (seeded; drives the projects board columns and payment triggers).
create table public.milestone_definitions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null,
  label       text not null,
  sort_order  int  not null default 0,
  unique (company_id, key)
);

create table public.payment_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

create table public.payment_template_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  template_id   uuid not null references public.payment_templates (id) on delete cascade,
  label         text not null,
  sort_order    int  not null default 0,
  kind          text not null check (kind in ('percent', 'fixed')),
  percent_bps   int  check (percent_bps between 0 and 10000),     -- 5000 = 50.00%
  amount_cents  bigint check (amount_cents >= 0),
  due_trigger   text,                                             -- milestone key; first item = deposit
  check ((kind = 'percent' and percent_bps is not null) or (kind = 'fixed' and amount_cents is not null))
);

create table public.task_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  is_default  boolean not null default false,
  active      boolean not null default true
);

create table public.task_template_items (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  template_id   uuid not null references public.task_templates (id) on delete cascade,
  title         text not null,
  milestone_key text,
  kind          text not null default 'task' check (kind in ('task', 'punch')),
  sort_order    int  not null default 0
);

-- ---------------------------------------------------------------------------
-- Sales pipeline
-- ---------------------------------------------------------------------------
create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  name        text not null,
  phone       text,
  email       text,
  address     text,
  city        text,
  zip         text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table public.leads (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies (id) on delete cascade,
  contact_id         uuid not null references public.contacts (id) on delete restrict,
  source             text not null default 'call',
  stage_id           uuid not null references public.pipeline_stages (id),
  owner_id           uuid references public.users (id) on delete set null,
  budget_min_cents   bigint check (budget_min_cents >= 0),
  budget_max_cents   bigint check (budget_max_cents >= 0),
  scope              text check (scope in ('cabinets', 'counters', 'full', 'other')),
  desired_timeline   text,
  notes              text,                     -- qualifying answers (playbook §1)
  next_follow_up_at  timestamptz,
  lost_reason_id     uuid references public.lost_reasons (id),
  lost_note          text,
  stage_entered_at   timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (budget_min_cents is null or budget_max_cents is null or budget_min_cents <= budget_max_cents)
);
create index leads_company_stage_idx on public.leads (company_id, stage_id);
create index leads_follow_up_idx on public.leads (company_id, next_follow_up_at);

create table public.quotes (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  lead_id          uuid not null references public.leads (id) on delete cascade,
  version          int  not null default 1,
  line_items_json  jsonb not null default '[]'::jsonb,
  subtotal_cents   bigint not null default 0,
  tax_cents        bigint not null default 0,
  total_cents      bigint not null default 0,
  sent_at          timestamptz,
  approved_at      timestamptz,
  file_url         text,
  unique (lead_id, version)
);

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------
create table public.projects (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  lead_id               uuid unique references public.leads (id) on delete set null,
  contact_id            uuid not null references public.contacts (id) on delete restrict,
  name                  text not null,
  status                text not null default 'active' check (status in ('active', 'closed')),
  project_manager_id    uuid references public.users (id) on delete set null,
  contract_value_cents  bigint not null check (contract_value_cents > 0),
  payment_template_id   uuid references public.payment_templates (id) on delete set null,
  created_at            timestamptz not null default now(),
  closed_at             timestamptz,
  closed_by             uuid references public.users (id),
  locked_revenue_cents  bigint,
  locked_cost_cents     bigint,
  locked_margin_bps     int,
  check ((status = 'closed') = (closed_at is not null))
);
create index projects_company_status_idx on public.projects (company_id, status);

create table public.project_members (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  key           text not null,
  name          text not null,
  planned_date  date,
  actual_date   date,
  sort_order    int not null default 0,
  unique (project_id, key)
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  title        text not null,
  description  text,
  assignee_id  uuid references public.users (id) on delete set null,
  trade        text,                         -- who does it when they have no login: Install crew, Plumber, Electrician…
  due_date     date,
  priority     text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status       text not null default 'todo' check (status in ('todo', 'doing', 'blocked', 'done')),
  kind         text not null default 'task' check (kind in ('task', 'punch')),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id, status);

create table public.change_orders (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  project_id          uuid not null references public.projects (id) on delete cascade,
  description         text not null,
  price_change_cents  bigint not null default 0,
  cost_change_cents   bigint not null default 0,
  approved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create table public.payments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  label         text not null,
  amount_cents  bigint not null check (amount_cents >= 0),
  due_trigger   text,                         -- milestone key, null = manual due date
  due_date      date,
  received_on   date,
  method        text check (method in ('check', 'zelle', 'card', 'cash', 'other')),
  check_number  text,
  -- pending = trigger not reached; due = owed now; received. "overdue" is derived (due_date + 3 days).
  status        text not null default 'pending' check (status in ('pending', 'due', 'received')),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  check ((status = 'received') = (received_on is not null))
);
create index payments_project_idx on public.payments (project_id);
create index payments_company_status_idx on public.payments (company_id, status, due_date);

create table public.costs (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  project_id             uuid not null references public.projects (id) on delete cascade,
  category_id            uuid not null references public.cost_categories (id),
  vendor                 text,
  description            text,
  estimated_amount_cents bigint not null default 0 check (estimated_amount_cents >= 0),
  actual_amount_cents    bigint check (actual_amount_cents >= 0),
  paid_on                date,
  receipt_url            text,
  created_at             timestamptz not null default now()
);
create index costs_project_idx on public.costs (project_id);

-- ---------------------------------------------------------------------------
-- Activity + meetings (lead OR project)
-- ---------------------------------------------------------------------------
create table public.activities (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  lead_id      uuid references public.leads (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete cascade,
  type         text not null check (type in ('call', 'text', 'email', 'fb_msg', 'meeting', 'note', 'stage_change', 'system')),
  direction    text check (direction in ('in', 'out')),
  summary      text not null default '',
  created_by   uuid references public.users (id) on delete set null,
  occurred_at  timestamptz not null default now(),
  check (num_nonnulls(lead_id, project_id) >= 1)
);
create index activities_lead_idx on public.activities (lead_id, occurred_at desc);
create index activities_project_idx on public.activities (project_id, occurred_at desc);

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  lead_id       uuid references public.leads (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete cascade,
  type          text not null check (type in ('initial', 'design_review', 'mid_check', 'final')),
  scheduled_at  timestamptz not null,
  status        text not null default 'scheduled' check (status in ('scheduled', 'done', 'canceled')),
  assignee_id   uuid references public.users (id) on delete set null,
  notes         text,
  check (num_nonnulls(lead_id, project_id) >= 1)
);
create index meetings_company_time_idx on public.meetings (company_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- Audit log (post-close edits, role changes)
-- ---------------------------------------------------------------------------
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
create index audit_log_company_idx on public.audit_log (company_id, created_at desc);
