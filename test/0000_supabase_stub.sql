-- Test-only stand-ins for Supabase internals and the 0001 tables (per docs/CONTEXT.md).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create table public.companies (id uuid primary key default gen_random_uuid(), name text not null,
  settings_json jsonb default '{}', timezone text default 'America/New_York');
create table public.users (id uuid primary key default gen_random_uuid(), clerk_id text unique not null,
  company_id uuid not null references public.companies(id), name text, role text not null, phone text);
create table public.contacts (id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id), name text);
create table public.deals (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  contact_id uuid references public.contacts(id), source text, stage text, owner_id uuid, created_at timestamptz default now());
create table public.quotes (id uuid primary key default gen_random_uuid(), deal_id uuid not null references public.deals(id),
  version int not null default 1, line_items_json jsonb, subtotal bigint, tax bigint, total bigint,
  sent_at timestamptz, approved_at timestamptz, file_url text);
create table public.projects (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  deal_id uuid references public.deals(id), contact_id uuid, name text, status text, project_manager_id uuid references public.users(id),
  contract_value bigint);
create table public.tasks (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects(id),
  title text, assignee_id uuid references public.users(id), status text default 'todo');
create table public.costs (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  category text not null, vendor text, estimated_amount bigint, actual_amount bigint, paid_at timestamptz, receipt_url text);
-- More 0001 tables used by 0004 (per CONTEXT §5) and the order/close columns.
alter table public.projects add column order_date date, add column closed_at timestamptz;
create table public.site_visits (id uuid primary key default gen_random_uuid(), company_id uuid, deal_id uuid references public.deals(id));
create table public.payments (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  label text, amount bigint not null, due_date date, received_at timestamptz, method text, check_number text, status text default 'due');
create table public.change_orders (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  description text, price_change bigint not null default 0, cost_change bigint not null default 0, approved_at timestamptz);
-- Supabase Storage stand-in
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to authenticated, service_role;
grant select, insert, update, delete on all tables in schema storage to authenticated, service_role;
