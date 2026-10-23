-- =====================================================================
-- 0006_sales_rep.sql
-- The app belongs to the SALES REP (Tugu). He finds and prepares deals, hands them
-- to a licensed contractor ("partner", e.g. RenoDesign Inc., Crystal's company) who
-- signs, builds and collects, and he earns a commission. See docs/SALES-REP-MODE.md.
--   1. partners + commission plans
--   2. deal hand-off: partner, plan, the "before hand-off" jacket gate
--   3. job progress the partner reports (status, sold price, deposit, final payment)
--   4. commissions: expected / earned / paid / owed per deal (deal_commissions view)
--   5. partner login: sees only deals handed to them, can update only job fields
--   6. the rep's own business money: expenses + mileage
-- Depends on 0001, 0002, 0004, 0005.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Partners (contractors the rep sells for) + commission plans
-- ---------------------------------------------------------------------
create table public.partners (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,                 -- "RenoDesign Inc."
  contact_name    text,                          -- "Crystal"
  phone           text,
  email           text,
  address         text,
  license_number  text,                          -- printed on what the rep hands the client
  license_class   text check (license_class in ('A','B','C')),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- How the rep gets paid on a partner's deals. Rates are numeric(5,4) like the rest of the app.
--   basis  contract_price = sold price + approved change orders (what the client pays)
--          gross_profit   = partner-reported gross profit (only if the partner shares it)
--   first_payout_pct  share earned when the client's deposit is received; the rest when
--                     the client has paid in full. 0 = all at the end, 1 = all at deposit.
create table public.commission_plans (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  partner_id        uuid not null references public.partners(id) on delete cascade,
  name              text not null,               -- "Kitchens 2026", "Cabinets only"
  basis             text not null default 'contract_price' check (basis in ('contract_price','gross_profit')),
  rate              numeric(5,4) not null check (rate >= 0 and rate < 1),
  first_payout_pct  numeric(5,4) not null default 0.5 check (first_payout_pct between 0 and 1),
  min_cents         bigint not null default 0,   -- floor per deal, e.g. $250 on small cabinet jobs
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (partner_id, name)
);

-- Partner logins (Crystal) live in the rep's company with role 'partner'.
alter table public.users add column if not exists partner_id uuid references public.partners(id);

create or replace function public.current_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select partner_id from public.users where clerk_id = (auth.jwt() ->> 'sub') and role = 'partner' limit 1
$$;

-- ---------------------------------------------------------------------
-- 2 + 3. Deal hand-off and the job progress the partner reports
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists partner_id                uuid references public.partners(id),
  add column if not exists commission_plan_id        uuid references public.commission_plans(id),
  add column if not exists handed_off_at             timestamptz,
  add column if not exists job_status                text not null default 'not_started'
        check (job_status in ('not_started','signed','ordered','in_progress','completed','cancelled')),
  add column if not exists sold_price_cents          bigint check (sold_price_cents >= 0),     -- contract total
  add column if not exists change_orders_cents       bigint not null default 0,                 -- approved COs total
  add column if not exists partner_gross_profit_cents bigint,                                   -- only for gross_profit plans
  add column if not exists deposit_received_at       timestamptz,
  add column if not exists paid_in_full_at           timestamptz,
  add column if not exists job_completed_at          timestamptz,
  add column if not exists partner_note              text;

alter table public.document_requirements drop constraint if exists document_requirements_gate_check;
alter table public.document_requirements add constraint document_requirements_gate_check
  check (gate in ('before_handoff','before_order','before_start','before_close'));

create or replace function public.deals_handoff()
returns trigger language plpgsql set search_path = public as $$
declare v_missing text;
begin
  -- the plan must belong to the partner
  if new.commission_plan_id is not null and not exists (
       select 1 from public.commission_plans cp where cp.id = new.commission_plan_id and cp.partner_id = new.partner_id) then
    raise exception 'Commission plan does not belong to this partner' using errcode = 'check_violation';
  end if;
  if new.handed_off_at is not null and (tg_op = 'INSERT' or old.handed_off_at is null) then
    if new.partner_id is null or new.commission_plan_id is null then
      raise exception 'Pick the partner and commission plan before handing off' using errcode = 'check_violation';
    end if;
    select string_agg(m, ', ') into v_missing from public.deal_gate_missing(new.id, 'before_handoff') m;
    if v_missing is not null then
      raise exception 'Deal jacket is missing before hand-off: %', v_missing using errcode = 'check_violation';
    end if;
  end if;
  if new.job_status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  if new.job_status = 'completed' and new.job_completed_at is null then new.job_completed_at := now(); end if;
  return new;
end $$;
create trigger deals_handoff before insert or update on public.deals
  for each row execute function public.deals_handoff();

create or replace function public.seed_default_handoff(p_company_id uuid)
returns void language sql security invoker set search_path = public as $$
  insert into public.document_requirements (company_id, gate, folder, label, required, applies_when, sort_order)
  values
    (p_company_id, 'before_handoff', 'photos',   'Site photos (every wall, ceiling, floor, panel, under sink)', true,  'always', 1),
    (p_company_id, 'before_handoff', 'design',   'Measurements + sketch',                                       true,  'always', 2),
    (p_company_id, 'before_handoff', 'other',    'Appliance list (model numbers or "reuse")',                   true,  'always', 3),
    (p_company_id, 'before_handoff', 'design',   'Design / cabinet list the client approved',                   false, 'always', 4),
    (p_company_id, 'before_handoff', 'estimates','Estimate the client saw',                                     false, 'always', 5)
  on conflict (company_id, gate, label) do nothing;
$$;
revoke execute on function public.seed_default_handoff(uuid) from public, anon;
grant  execute on function public.seed_default_handoff(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Commissions
-- ---------------------------------------------------------------------
create table public.commission_payments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  deal_id     uuid not null references public.deals(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),   -- negative = clawback / correction
  paid_on     date not null,
  method      text check (method in ('check','zelle','ach','cash','other')),
  reference   text,                                       -- check number, Zelle id
  note        text,
  created_at  timestamptz not null default now()
);
create index commission_payments_deal on public.commission_payments (deal_id);

-- Rounding: half away from zero (round() on numeric), same as the estimating code.
create or replace view public.deal_commissions with (security_invoker = true) as
with base as (
  select d.id as deal_id, d.company_id, d.deal_number, d.partner_id, p.name as partner_name,
         cp.id as plan_id, cp.name as plan_name, cp.basis, cp.rate, cp.first_payout_pct, cp.min_cents,
         d.job_status, d.handed_off_at, d.deposit_received_at, d.paid_in_full_at, d.cancelled_at,
         (coalesce(d.sold_price_cents, 0) + d.change_orders_cents)::bigint as contract_total_cents,
         case cp.basis when 'contract_price' then coalesce(d.sold_price_cents, 0) + d.change_orders_cents
                       else coalesce(d.partner_gross_profit_cents, 0) end as basis_cents
  from public.deals d
  join public.commission_plans cp on cp.id = d.commission_plan_id
  join public.partners p on p.id = d.partner_id
  where d.handed_off_at is not null and d.deleted_at is null
),
calc as (
  select b.*,
         case when b.basis_cents > 0 then greatest(round(b.basis_cents * b.rate)::bigint, b.min_cents) else 0 end as commission_cents
  from base b
),
paid as (select deal_id, sum(amount_cents)::bigint as paid_cents, max(paid_on) as last_paid_on
         from public.commission_payments group by deal_id)
select c.*,
       case
         when c.cancelled_at is not null and c.deposit_received_at is null then 0
         when c.paid_in_full_at is not null then c.commission_cents
         when c.deposit_received_at is not null then round(c.commission_cents * c.first_payout_pct)::bigint
         else 0 end                                                    as earned_cents,
       coalesce(p.paid_cents, 0)                                        as paid_cents,
       p.last_paid_on,
       case
         when c.cancelled_at is not null and c.deposit_received_at is null then 0
         when c.paid_in_full_at is not null then c.commission_cents
         when c.deposit_received_at is not null then round(c.commission_cents * c.first_payout_pct)::bigint
         else 0 end - coalesce(p.paid_cents, 0)                         as owed_cents,
       case when c.cancelled_at is not null then 0
            else c.commission_cents end                                 as expected_cents,
       case
         when c.cancelled_at is not null then 'cancelled'
         when c.basis_cents = 0 then 'waiting for price'
         when c.paid_in_full_at is null and c.deposit_received_at is null then 'pending'
         when coalesce(p.paid_cents, 0) >= (case when c.paid_in_full_at is not null then c.commission_cents
                                                 else round(c.commission_cents * c.first_payout_pct)::bigint end)
              then case when c.paid_in_full_at is not null then 'paid' else 'part paid' end
         else 'owed' end                                                as commission_status
from calc c left join paid p on p.deal_id = c.deal_id;

-- ---------------------------------------------------------------------
-- 5. Partner login (Crystal): only deals handed to her company; only job fields
-- ---------------------------------------------------------------------
create or replace function public.deals_partner_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.current_app_role() = 'partner' then
    if (to_jsonb(new) - array['job_status','sold_price_cents','change_orders_cents','partner_gross_profit_cents',
                               'deposit_received_at','paid_in_full_at','job_completed_at','cancelled_at','partner_note'])
       is distinct from
       (to_jsonb(old) - array['job_status','sold_price_cents','change_orders_cents','partner_gross_profit_cents',
                               'deposit_received_at','paid_in_full_at','job_completed_at','cancelled_at','partner_note']) then
      raise exception 'Partners can only update job progress and price' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end $$;
-- Triggers fire in name order: "deals_guard_partner" runs before "deals_handoff".
create trigger deals_guard_partner before update on public.deals
  for each row execute function public.deals_partner_guard();

alter table public.partners            enable row level security;
alter table public.commission_plans    enable row level security;
alter table public.commission_payments enable row level security;

create policy partners_owner on public.partners for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_owner());
create policy partners_self on public.partners for select to authenticated
  using (id = public.current_partner_id());

create policy plans_owner on public.commission_plans for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
-- the partner can see the plan on their deals (transparency: both see the same numbers)
create policy plans_partner on public.commission_plans for select to authenticated
  using (partner_id = public.current_partner_id());

create policy commission_payments_owner on public.commission_payments for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
create policy commission_payments_partner on public.commission_payments for select to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_id and d.partner_id = public.current_partner_id()));

-- Deals: if 0001 already enables RLS on deals, these add the partner's view.
alter table public.deals enable row level security;
drop policy if exists deals_team on public.deals;
create policy deals_team on public.deals for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy deals_partner_read on public.deals for select to authenticated
  using (partner_id = public.current_partner_id() and handed_off_at is not null and deleted_at is null);
create policy deals_partner_update on public.deals for update to authenticated
  using (partner_id = public.current_partner_id() and handed_off_at is not null)
  with check (partner_id = public.current_partner_id());

-- Partner sees the hand-off files of their deals (not the rep's estimates or notes).
create policy deal_files_partner_read on public.deal_files for select to authenticated
  using (deleted_at is null and folder in ('photos','design','contract','permits','other')
         and exists (select 1 from public.deals d where d.id = deal_id
                     and d.partner_id = public.current_partner_id() and d.handed_off_at is not null));

-- ---------------------------------------------------------------------
-- 6. The rep's own business money (separate from any day job)
-- ---------------------------------------------------------------------
create table public.business_expenses (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  spent_on     date not null,
  amount_cents bigint not null check (amount_cents > 0),
  category     text not null check (category in
                 ('marketing','phone','software','vehicle','tools','samples','meals','office','license_fees','other')),
  vendor       text,
  note         text,
  deal_id      uuid references public.deals(id) on delete set null,
  receipt_path text,                       -- deal-files bucket or a receipts/ folder
  created_at   timestamptz not null default now()
);
create table public.mileage_trips (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  trip_on     date not null,
  miles       numeric(7,1) not null check (miles > 0),
  purpose     text not null,
  deal_id     uuid references public.deals(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.business_expenses enable row level security;
alter table public.mileage_trips     enable row level security;
create policy expenses_owner on public.business_expenses for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
create policy mileage_owner on public.mileage_trips for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Year summary: commissions received vs expenses vs mileage (rate is a setting, passed in).
create or replace function public.rep_year_summary(p_year int, p_mileage_rate_cents int default 70)
returns table (commissions_paid_cents bigint, commissions_owed_cents bigint, commissions_pipeline_cents bigint,
               expenses_cents bigint, miles numeric, mileage_deduction_cents bigint, net_cents bigint)
language sql stable security invoker set search_path = public as $$
  with cm as (
    select coalesce(sum(amount_cents) filter (where extract(year from paid_on) = p_year), 0)::bigint as paid
    from public.commission_payments where company_id = public.current_company_id()
  ), ow as (
    select coalesce(sum(owed_cents), 0)::bigint as owed,
           coalesce(sum(expected_cents - earned_cents), 0)::bigint as pipeline
    from public.deal_commissions where company_id = public.current_company_id()
  ), ex as (
    select coalesce(sum(amount_cents), 0)::bigint as spent from public.business_expenses
    where company_id = public.current_company_id() and extract(year from spent_on) = p_year
  ), mi as (
    select coalesce(sum(miles), 0) as miles from public.mileage_trips
    where company_id = public.current_company_id() and extract(year from trip_on) = p_year
  )
  select cm.paid, ow.owed, ow.pipeline, ex.spent, mi.miles,
         round(mi.miles * p_mileage_rate_cents)::bigint,
         (cm.paid - ex.spent - round(mi.miles * p_mileage_rate_cents))::bigint
  from cm, ow, ex, mi
$$;

-- Lead sources for a rep: add hand-offs and commission (columns appended to 0005's view).
create or replace view public.lead_source_stats with (security_invoker = true) as
select d.company_id, d.deal_year, coalesce(d.source, 'unknown') as source,
       count(*)                                                                         as leads,
       count(*) filter (where d.first_response_at <= d.created_at + interval '5 minutes') as answered_5_min,
       count(*) filter (where d.first_response_at <= d.created_at + interval '1 hour')    as answered_1_hour,
       count(p.id)                                                                      as won,
       round(count(p.id)::numeric / nullif(count(*), 0), 4)                             as win_rate,
       coalesce(sum(p.contract_value), 0)::bigint                                       as contract_value_cents,
       count(*) filter (where d.handed_off_at is not null)                              as handed_off,
       coalesce(sum(dc.expected_cents), 0)::bigint                                      as commission_expected_cents,
       coalesce(sum(dc.paid_cents), 0)::bigint                                          as commission_paid_cents
from public.deals d
left join public.projects p on p.deal_id = d.id
left join public.deal_commissions dc on dc.deal_id = d.id
where d.deleted_at is null
group by d.company_id, d.deal_year, coalesce(d.source, 'unknown');
