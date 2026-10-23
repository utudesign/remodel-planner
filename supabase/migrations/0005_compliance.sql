-- =====================================================================
-- 0005_compliance.sql
-- Rules a Virginia home-improvement contractor can't afford to miss, enforced by
-- the database so nobody has to remember them (see docs/COMPLIANCE-AND-OPS.md):
--   1. 3-day right to cancel (FTC 16 CFR 429 + Va. Code 59.1-21.1): the deadline is
--      computed when the contract is signed; nothing can be ORDERED before it passes.
--   2. No payment is recorded as received before the contract is signed
--      (18VAC50-22-260 B8).
--   3. Change orders: numbered 26-1047-CO1…, can't be approved without the client's
--      signature (18VAC50-22-260 B9 j, B31).
--   4. Payment receipts numbered 26-1047-R1…
--   5. Pre-1978 homes: lead-safe (EPA RRP, 40 CFR 745) checklist items in the jacket.
--   6. Subcontractor license / insurance expiry tracking.
--   7. Warranty clock + speed-to-lead and lead-source numbers.
-- General information, not legal advice: have a Virginia lawyer review the contract
-- template and these rules before relying on them.
-- Depends on 0001, 0002, 0004.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Business days (FTC definition: every day except Sunday and these holidays)
-- ---------------------------------------------------------------------
create table public.business_holidays (
  day  date primary key,
  name text not null
);
insert into public.business_holidays (day, name) values
  ('2026-01-01','New Year''s Day'),('2026-02-16','Washington''s Birthday'),('2026-05-25','Memorial Day'),
  ('2026-07-04','Independence Day'),('2026-09-07','Labor Day'),('2026-10-12','Columbus Day'),
  ('2026-11-11','Veterans Day'),('2026-11-26','Thanksgiving Day'),('2026-12-25','Christmas Day'),
  ('2027-01-01','New Year''s Day'),('2027-02-15','Washington''s Birthday'),('2027-05-31','Memorial Day'),
  ('2027-07-04','Independence Day'),('2027-09-06','Labor Day'),('2027-10-11','Columbus Day'),
  ('2027-11-11','Veterans Day'),('2027-11-25','Thanksgiving Day'),('2027-12-25','Christmas Day'),
  ('2028-01-01','New Year''s Day'),('2028-02-21','Washington''s Birthday'),('2028-05-29','Memorial Day'),
  ('2028-07-04','Independence Day'),('2028-09-04','Labor Day'),('2028-10-09','Columbus Day'),
  ('2028-11-11','Veterans Day'),('2028-11-23','Thanksgiving Day'),('2028-12-25','Christmas Day')
on conflict do nothing;
alter table public.business_holidays enable row level security;
create policy business_holidays_read on public.business_holidays for select to authenticated using (true);

-- Midnight (company time zone) at the end of the 3rd business day after the signing date.
create or replace function public.cancellation_deadline(p_signed timestamptz, p_tz text default 'America/New_York')
returns timestamptz language plpgsql stable set search_path = public as $$
declare d date := (p_signed at time zone p_tz)::date; n int := 0;
begin
  while n < 3 loop
    d := d + 1;
    if extract(isodow from d) <> 7 and not exists (select 1 from public.business_holidays h where h.day = d) then
      n := n + 1;
    end if;
  end loop;
  return ((d + 1)::timestamp) at time zone p_tz;
end $$;

-- ---------------------------------------------------------------------
-- 2. Deal compliance fields
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists year_built            int check (year_built between 1700 and 2100),
  add column if not exists sold_in_home          boolean not null default true,
  add column if not exists contract_signed_at    timestamptz,
  add column if not exists cancel_deadline       timestamptz,
  add column if not exists cancellation_waived   boolean not null default false,  -- bona fide emergency, buyer's handwritten waiver filed
  add column if not exists cancelled_at          timestamptz,
  add column if not exists first_response_at     timestamptz,                     -- speed to lead
  add column if not exists lost_reason           text,
  add column if not exists financing_lender      text,
  add column if not exists financing_fee_rate    numeric(5,4);                    -- dealer fee, eats margin

create or replace function public.deals_compliance_fields()
returns trigger language plpgsql set search_path = public as $$
declare v_tz text;
begin
  if new.contract_signed_at is distinct from (case when tg_op = 'UPDATE' then old.contract_signed_at end)
     or new.sold_in_home is distinct from (case when tg_op = 'UPDATE' then old.sold_in_home end) then
    select coalesce(timezone, 'America/New_York') into v_tz from public.companies where id = new.company_id;
    new.cancel_deadline := case when new.contract_signed_at is not null and new.sold_in_home
                                then public.cancellation_deadline(new.contract_signed_at, v_tz) end;
  end if;
  return new;
end $$;
create trigger deals_compliance_fields before insert or update on public.deals
  for each row execute function public.deals_compliance_fields();

-- ---------------------------------------------------------------------
-- 3. Order gate: signed contract, not cancelled, 3-day window over
-- ---------------------------------------------------------------------
create or replace function public.projects_compliance_gates()
returns trigger language plpgsql set search_path = public as $$
declare d public.deals%rowtype;
begin
  if new.order_date is not null and old.order_date is null then
    select * into d from public.deals where id = new.deal_id;
    if d.contract_signed_at is null then
      raise exception 'Record the contract signing before ordering' using errcode = 'check_violation';
    end if;
    if d.cancelled_at is not null then
      raise exception 'Deal % was cancelled', d.deal_number using errcode = 'check_violation';
    end if;
    if d.cancel_deadline is not null and now() < d.cancel_deadline and not d.cancellation_waived then
      raise exception 'Client can still cancel until % (3-day right to cancel); order after that',
        to_char((d.cancel_deadline - interval '1 minute') at time zone 'America/New_York', 'Dy Mon DD, HH12:MI PM')
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger projects_compliance_gates before update on public.projects
  for each row execute function public.projects_compliance_gates();

-- ---------------------------------------------------------------------
-- 4. Payments: no money before a signed contract; receipt numbers
-- ---------------------------------------------------------------------
alter table public.payments add column if not exists receipt_number text unique;

create or replace function public.payments_compliance()
returns trigger language plpgsql security definer set search_path = public as $$
declare d public.deals%rowtype;
begin
  if new.received_at is not null and (tg_op = 'INSERT' or old.received_at is null) then
    select dl.* into d from public.projects p join public.deals dl on dl.id = p.deal_id where p.id = new.project_id;
    if d.contract_signed_at is null then
      raise exception 'Virginia rule: no payment before the contract is signed by both sides (deal %)', d.deal_number
        using errcode = 'check_violation';
    end if;
    if new.receipt_number is null then
      new.receipt_number := public._deal_doc_number(d.id, 'R');
    end if;
  end if;
  return new;
end $$;
create trigger payments_compliance before insert or update on public.payments
  for each row execute function public.payments_compliance();

-- ---------------------------------------------------------------------
-- 5. Change orders: numbered, signed before approved
-- ---------------------------------------------------------------------
alter table public.change_orders
  add column if not exists doc_number        text unique,
  add column if not exists schedule_days     int not null default 0,   -- completion date moves by this
  add column if not exists client_signed_at  timestamptz,
  add column if not exists signed_file_id    uuid references public.deal_files(id);

create or replace function public.change_orders_compliance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deal uuid;
begin
  if tg_op = 'INSERT' and new.doc_number is null then
    select deal_id into v_deal from public.projects where id = new.project_id;
    new.doc_number := public._deal_doc_number(v_deal, 'CO');
  end if;
  if new.approved_at is not null and new.client_signed_at is null then
    raise exception 'Change order % needs the client''s signature before it is approved', new.doc_number
      using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.approved_at is not null
     and (new.price_change, new.cost_change, new.description, new.schedule_days)
         is distinct from (old.price_change, old.cost_change, old.description, old.schedule_days) then
    raise exception 'Approved change order % can''t be edited; write a new one', old.doc_number
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger change_orders_compliance before insert or update on public.change_orders
  for each row execute function public.change_orders_compliance();

-- ---------------------------------------------------------------------
-- 6. Jacket requirements that depend on the house / the sale
-- ---------------------------------------------------------------------
alter table public.document_requirements drop constraint if exists document_requirements_applies_when_check;
alter table public.document_requirements add constraint document_requirements_applies_when_check
  check (applies_when in ('always','permit_required','pre_1978','sold_in_home'));

-- Unknown year built counts as pre-1978 until someone enters it (safer).
create or replace function public.requirement_applies(p_applies_when text, p_deal public.deals)
returns boolean language sql immutable as $$
  select case p_applies_when
    when 'always'          then true
    when 'permit_required' then p_deal.permit_required
    when 'pre_1978'        then coalesce(p_deal.year_built < 1978, true)
    when 'sold_in_home'    then p_deal.sold_in_home
    else false end
$$;

create or replace view public.deal_jacket_checklist with (security_invoker = true) as
select d.id as deal_id, d.deal_number, r.id as requirement_id, r.gate, r.folder, r.label, r.required, r.sort_order,
       count(f.id) as file_count,
       count(f.id) > 0 as satisfied
from public.deals d
join public.document_requirements r on r.company_id = d.company_id and public.requirement_applies(r.applies_when, d)
left join public.deal_files f on f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null
group by d.id, d.deal_number, r.id, r.gate, r.folder, r.label, r.required, r.sort_order;

create or replace function public.deal_gate_missing(p_deal_id uuid, p_gate text)
returns setof text language sql stable security definer set search_path = public as $$
  select r.label
  from public.deals d
  join public.document_requirements r on r.company_id = d.company_id and r.gate = p_gate and r.required
       and public.requirement_applies(r.applies_when, d)
  where d.id = p_deal_id
    and not exists (select 1 from public.deal_files f
                    where f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null)
  order by r.sort_order
$$;

-- The "before start" gate becomes hard too (start date can't be set without it).
alter table public.projects add column if not exists start_date date;
create or replace function public.projects_start_gate()
returns trigger language plpgsql set search_path = public as $$
declare v_missing text;
begin
  if new.start_date is not null and old.start_date is null then
    select string_agg(m, ', ') into v_missing from public.deal_gate_missing(new.deal_id, 'before_start') m;
    if v_missing is not null then
      raise exception 'Deal jacket is missing before starting: %', v_missing using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger projects_start_gate before update on public.projects
  for each row execute function public.projects_start_gate();

create or replace function public.seed_default_compliance(p_company_id uuid)
returns void language sql security invoker set search_path = public as $$
  insert into public.document_requirements (company_id, gate, folder, label, required, applies_when, sort_order)
  values
    (p_company_id, 'before_order', 'contract', 'Statement of Consumer Protections, signed acknowledgment', true, 'always', 5),
    (p_company_id, 'before_order', 'contract', 'Notice of cancellation given (2 copies)',                   true, 'sold_in_home', 6),
    (p_company_id, 'before_order', 'other',    'Appliance specs + cutout sizes checked against cabinet list', true, 'always', 7),
    (p_company_id, 'before_start', 'contract', 'Renovate Right pamphlet, signed receipt',                   true, 'pre_1978', 3),
    (p_company_id, 'before_start', 'other',    'Lead-safe certified renovator assigned',                    true, 'pre_1978', 4),
    (p_company_id, 'before_start', 'invoices_receipts', 'Cabinet delivery inspected (signed receipt + photos)', true, 'always', 5),
    (p_company_id, 'before_close', 'other',    'Lead-safe records (cleaning verification, checklist)',      true, 'pre_1978', 7)
  on conflict (company_id, gate, label) do nothing;
$$;
revoke execute on function public.seed_default_compliance(uuid) from public, anon;
grant  execute on function public.seed_default_compliance(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Subcontractors: license + insurance on file and not expired
-- ---------------------------------------------------------------------
create table public.subcontractors (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies(id) on delete cascade,
  name               text not null,
  trade              text not null check (trade in ('install','plumbing','electrical','countertops','drywall','paint','flooring','hvac','other')),
  phone              text,
  email              text,
  user_id            uuid references public.users(id),           -- if they have a crew login
  license_number     text,
  license_class      text check (license_class in ('A','B','C','trade','none')),
  license_expires    date,
  gl_coi_expires     date,                                       -- general liability certificate
  wc_coi_expires     date,                                       -- workers' comp certificate (or exemption on file)
  w9_on_file         boolean not null default false,
  active             boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now()
);
alter table public.subcontractors enable row level security;
create policy subs_team on public.subcontractors for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

create view public.subcontractor_compliance with (security_invoker = true) as
select s.id, s.company_id, s.name, s.trade,
       least(s.license_expires, s.gl_coi_expires, s.wc_coi_expires) as next_expiry,
       case
         when s.license_expires is null or s.gl_coi_expires is null or s.wc_coi_expires is null or not s.w9_on_file
           then 'missing'
         when least(s.license_expires, s.gl_coi_expires, s.wc_coi_expires) < current_date then 'expired'
         when least(s.license_expires, s.gl_coi_expires, s.wc_coi_expires) < current_date + 30 then 'expiring'
         else 'ok' end as status
from public.subcontractors s where s.active;

-- ---------------------------------------------------------------------
-- 8. Warranty clock + lead numbers
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists substantial_completion_on date,
  add column if not exists warranty_months int not null default 12;

create or replace view public.deal_warranty with (security_invoker = true) as
select d.id as deal_id, d.deal_number, p.id as project_id, p.substantial_completion_on,
       (p.substantial_completion_on + make_interval(months => p.warranty_months))::date as warranty_ends_on,
       (p.substantial_completion_on + make_interval(months => p.warranty_months) - interval '30 days')::date as check_in_on
from public.deals d join public.projects p on p.deal_id = d.id
where p.substantial_completion_on is not null;

-- Leads by source and year: count, answered within 5 min / 1 hour, won, revenue.
create or replace view public.lead_source_stats with (security_invoker = true) as
select d.company_id, d.deal_year, coalesce(d.source, 'unknown') as source,
       count(*)                                                                         as leads,
       count(*) filter (where d.first_response_at <= d.created_at + interval '5 minutes') as answered_5_min,
       count(*) filter (where d.first_response_at <= d.created_at + interval '1 hour')    as answered_1_hour,
       count(p.id)                                                                      as won,
       round(count(p.id)::numeric / nullif(count(*), 0), 4)                             as win_rate,
       coalesce(sum(p.contract_value), 0)::bigint                                       as contract_value_cents
from public.deals d left join public.projects p on p.deal_id = d.id
where d.deleted_at is null
group by d.company_id, d.deal_year, coalesce(d.source, 'unknown');
