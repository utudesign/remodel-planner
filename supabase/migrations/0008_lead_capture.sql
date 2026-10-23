-- =====================================================================
-- 0008_lead_capture.sql — leads without an admin (master prompt v2, Step 2)
--   1. share links: a short public form I post in Facebook groups
--   2. booking tokens: the client picks a visit slot from a link in my auto-reply
--   3. public form submissions log (rate limit, spam check); service role only
-- Public pages never touch the database as "anon": the server validates the
-- slug/token and writes with the service role.
-- =====================================================================

create table public.lead_links (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  label       text not null default 'Facebook groups',
  source      text not null default 'share_link',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.lead_links enable row level security;
create policy lead_links_owner on public.lead_links for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- One unguessable token per deal for the booking page (/book/<token>).
alter table public.deals add column if not exists booking_token uuid not null default gen_random_uuid();
create unique index if not exists deals_booking_token on public.deals (booking_token);

-- Who submitted what, when (hashed IP only). No policies: service role only.
create table public.form_submissions (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('lead', 'booking')),
  company_id  uuid references public.companies (id) on delete cascade,
  ip_hash     text not null,
  deal_id     uuid references public.deals (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index form_submissions_ip on public.form_submissions (ip_hash, created_at desc);
alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from anon, authenticated;

-- A share link for every account (slug from the company name + 4 random characters).
create or replace function private.ensure_lead_link(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_base text; v_slug text;
begin
  if exists (select 1 from public.lead_links where company_id = p_company) then return; end if;
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(split_part(name, ' ', 1)), '[^a-z0-9]+', '-', 'g')), ''), 'kitchen')
    into v_base from public.companies where id = p_company;
  loop
    v_slug := left(v_base, 20) || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
    exit when not exists (select 1 from public.lead_links where slug = v_slug);
  end loop;
  insert into public.lead_links (company_id, slug) values (p_company, v_slug);
end $$;

-- New accounts get one too (seed_company_defaults is called by bootstrap_owner).
create or replace function private.companies_lead_link() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.ensure_lead_link(new.id);
  return null;
end $$;
create trigger companies_lead_link after insert on public.companies
  for each row execute function private.companies_lead_link();

do $$
declare c record;
begin
  for c in select id from public.companies loop perform private.ensure_lead_link(c.id); end loop;
end $$;
