-- =====================================================================
-- 0012_intake.sql — the client's answers from the free-estimate form (/l/<slug>).
-- One row per deal: the structured answers (lib/intake.ts), the short summary I read,
-- and a rough range from their cabinet count (full kitchens only; never shown to the client).
-- Written by the server with the service role; owner reads/edits; the partner reads it
-- once the deal is handed to her (same rule as site_visits in 0010).
-- =====================================================================

create table public.deal_intake (
  deal_id             uuid primary key references public.deals (id) on delete cascade,
  company_id          uuid not null references public.companies (id) on delete cascade,
  answers             jsonb not null default '{}'::jsonb,
  summary             text not null default '',
  ballpark_low_cents  bigint check (ballpark_low_cents >= 0),
  ballpark_high_cents bigint check (ballpark_high_cents >= ballpark_low_cents),
  created_at          timestamptz not null default now()
);
create index deal_intake_company_idx on public.deal_intake (company_id);
alter table public.deal_intake enable row level security;

create policy deal_intake_owner on public.deal_intake for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create policy deal_intake_partner_read on public.deal_intake for select to authenticated
  using (exists (select 1 from public.deals d
                 where d.id = deal_intake.deal_id and d.partner_id = public.current_partner_id()
                   and d.handed_off_at is not null and d.deleted_at is null));
