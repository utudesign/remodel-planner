-- =====================================================================
-- 0002_estimating.sql
-- Price book, quote line items, takeoff, priced views, approval,
-- quote -> project conversion, and the project materials / pick list.
--
-- Depends on 0001 (per docs/CONTEXT.md): companies, users, leads, quotes,
-- projects, tasks, costs. Reconcile column names with 0001 before applying
-- (see docs/ESTIMATING.md "Assumptions about 0001").
--
-- Conventions
--   money  = bigint cents
--   rates  = numeric(5,4) fractions (0.35 = 35%)
--   qty    = numeric(10,2)
--   price  = round(cost / (1 - margin))   -- margin, never markup
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers (create or replace: safe if 0001 defines the same helpers)
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

-- Roles: owner (the partners), team (office/admin staff), crew (installers, plumber, electrician).
-- owner + team see everything; crew sees only jobs they are assigned to, with no money.
create or replace function public.is_owner()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() = 'owner', false)
$$;

create or replace function public.is_team()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() in ('owner', 'team'), false)
$$;

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

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Company estimating settings (owner-editable defaults)
-- ---------------------------------------------------------------------
create table public.estimating_settings (
  company_id          uuid primary key references public.companies(id) on delete cascade,
  target_margin       numeric(5,4) not null default 0.35 check (target_margin >= 0 and target_margin < 0.95),
  contingency_rate    numeric(5,4) not null default 0.07 check (contingency_rate between 0 and 0.5),
  tax_rate            numeric(5,4) not null default 0.06 check (tax_rate between 0 and 0.2),
  labor_rate_cents    bigint       not null default 5500 check (labor_rate_cents >= 0),
  trim_waste          numeric(5,4) not null default 0.15 check (trim_waste between 0 and 1),
  trim_stick_ft       numeric(5,2) not null default 8 check (trim_stick_ft > 0),
  countertop_overage  numeric(5,4) not null default 0.05 check (countertop_overage between 0 and 1),
  hardware_spares     int          not null default 2 check (hardware_spares >= 0),
  led_headroom        numeric(5,4) not null default 0.20 check (led_headroom between 0 and 1),
  cost_stale_days     int          not null default 90 check (cost_stale_days > 0),
  -- Phone ballpark range shown during the first visit (lib/estimating/ballpark.ts)
  ballpark_low_pct    numeric(5,4) not null default 0.05 check (ballpark_low_pct between 0 and 0.5),
  ballpark_high_pct   numeric(5,4) not null default 0.15 check (ballpark_high_pct between 0 and 1),
  ballpark_round_cents bigint      not null default 50000 check (ballpark_round_cents > 0),
  updated_at          timestamptz  not null default now()
);
create trigger estimating_settings_updated before update on public.estimating_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Lookups: quote sections (client-facing), pick phases (crew),
--    catalog categories (defaults for both + cost category)
-- ---------------------------------------------------------------------
create table public.quote_sections (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  name                  text not null,
  client_description    text,
  sort_order            int  not null default 0,
  absorbs_project_costs boolean not null default false, -- contingency + tax are shown inside this section
  active                boolean not null default true,
  unique (company_id, name)
);
create unique index quote_sections_one_absorber
  on public.quote_sections (company_id) where absorbs_project_costs;

create table public.pick_phases (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  unique (company_id, name)
);

create table public.catalog_categories (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies(id) on delete cascade,
  name                   text not null,
  cost_category          text not null check (cost_category in
                           ('materials','labor','subcontractor','permit','delivery','disposal','other')),
  default_section_id     uuid not null references public.quote_sections(id),
  default_pick_phase_id  uuid references public.pick_phases(id),   -- null = not picked by crew (labor, subs, permits)
  sort_order             int not null default 0,
  unique (company_id, name)
);

-- ---------------------------------------------------------------------
-- 4a. Vendor price lists and color groups ("collections")
--     e.g. TimberPeak MSRP list, cost = MSRP x 0.33; Group 1 = TSW/TSB/TSG/DBG
-- ---------------------------------------------------------------------
create table public.price_lists (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  vendor           text not null,
  name             text not null,
  cost_multiplier  numeric(6,4) not null check (cost_multiplier > 0 and cost_multiplier <= 1.5),
  effective_date   date not null default current_date,
  source_file      text,
  created_at       timestamptz not null default now(),
  unique (company_id, name)
);

create table public.catalog_collections (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  price_list_id  uuid references public.price_lists(id) on delete cascade,
  name           text not null,
  colors         text[] not null default '{}',
  sort_order     int not null default 0,
  active         boolean not null default true,
  unique (company_id, name)
);

-- ---------------------------------------------------------------------
-- 4. Price book
-- ---------------------------------------------------------------------
-- qty_source keys are computed in lib/estimating/takeoff.ts. Keep both lists in sync.
create table public.catalog_items (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  category_id       uuid not null references public.catalog_categories(id),
  code              text not null default '',
  name              text not null,
  unit              text not null default 'ea',
  unit_cost_cents   bigint not null default 0 check (unit_cost_cents >= 0),
  uses_labor_rate   boolean not null default false,  -- cost follows the quote's labor rate
  taxable           boolean not null default true,
  is_allowance      boolean not null default false,
  vendor            text,
  qty_source        text check (qty_source in (
                      'countertop_sqft','crown_sticks','light_rail_sticks','toe_kick_sticks',
                      'scribe_sticks','door_pulls','drawer_pulls','led_ft','countertop_outlets',
                      'cover_plates')),
  section_id        uuid references public.quote_sections(id),  -- overrides the category default
  cost_category     text check (cost_category in
                      ('materials','labor','subcontractor','permit','delivery','disposal','other')),
  notes             text,
  collection_id     uuid references public.catalog_collections(id) on delete cascade, -- vendor color group
  list_price_cents  bigint check (list_price_cents >= 0),   -- vendor MSRP; cost = MSRP x multiplier
  -- 'margin': price = cost / (1 - margin).  'fixed': sell at unit_price_cents (market-priced items, e.g. quartz)
  pricing_mode      text not null default 'margin' check (pricing_mode in ('margin','fixed')),
  unit_price_cents  bigint check (unit_price_cents >= 0),
  -- where the cost (or fixed price) came from, so stale or sample prices are visible
  price_source      text not null default 'sample' check (price_source in
                      ('vendor_list','home_depot','market','supplier_quote','sample')),
  source_url        text,
  source_checked_on date,
  active            boolean not null default true,
  cost_updated_at   timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint catalog_items_fixed_has_price check (pricing_mode = 'margin' or unit_price_cents is not null)
);
create index catalog_items_company on public.catalog_items (company_id, active);
create unique index catalog_items_generic_key on public.catalog_items (company_id, category_id, code, name)
  where collection_id is null;
create unique index catalog_items_vendor_key on public.catalog_items (company_id, collection_id, code)
  where collection_id is not null;

create or replace function public.catalog_items_touch_cost()
returns trigger language plpgsql as $$
begin
  if new.unit_cost_cents is distinct from old.unit_cost_cents then
    new.cost_updated_at := now();
  end if;
  return new;
end $$;
create trigger catalog_items_cost before update on public.catalog_items
  for each row execute function public.catalog_items_touch_cost();
create trigger catalog_items_updated before update on public.catalog_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Quote templates (e.g. "10x10 L-shape - shaker + quartz")
-- ---------------------------------------------------------------------
create table public.quote_templates (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  name             text not null,
  description      text,
  default_takeoff  jsonb not null default '{}'::jsonb,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (company_id, name)
);

create table public.quote_template_items (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  template_id      uuid not null references public.quote_templates(id) on delete cascade,
  catalog_item_id  uuid not null references public.catalog_items(id),
  qty              numeric(10,2) not null default 1 check (qty >= 0),
  note             text,
  sort_order       int not null default 0
);
create index quote_template_items_tpl on public.quote_template_items (template_id, sort_order);

-- ---------------------------------------------------------------------
-- 6. Quotes: extend the 0001 table
-- ---------------------------------------------------------------------
alter table public.quotes
  add column if not exists company_id           uuid references public.companies(id) on delete cascade,
  add column if not exists name                 text,
  add column if not exists status               text,
  add column if not exists template_id          uuid references public.quote_templates(id) on delete set null,
  add column if not exists target_margin        numeric(5,4),
  add column if not exists contingency_rate     numeric(5,4),
  add column if not exists tax_rate             numeric(5,4),
  add column if not exists labor_rate_cents     bigint,
  add column if not exists takeoff              jsonb not null default '{}'::jsonb,
  add column if not exists collection_id        uuid references public.catalog_collections(id) on delete set null,
  add column if not exists approved_price_cents bigint,
  add column if not exists approved_cost_cents  bigint,
  add column if not exists created_by           uuid references public.users(id),
  add column if not exists created_at           timestamptz not null default now(),
  add column if not exists updated_at           timestamptz not null default now();

-- Backfill any existing rows, then tighten.
update public.quotes q set company_id = l.company_id
  from public.leads l where q.lead_id = l.id and q.company_id is null;
update public.quotes set
  status           = coalesce(status, case when approved_at is not null then 'approved'
                                           when sent_at is not null then 'sent' else 'draft' end),
  target_margin    = coalesce(target_margin, 0.35),
  contingency_rate = coalesce(contingency_rate, 0.07),
  tax_rate         = coalesce(tax_rate, 0.06),
  labor_rate_cents = coalesce(labor_rate_cents, 5500);

alter table public.quotes
  alter column company_id       set not null,
  alter column status           set not null,
  alter column status           set default 'draft',
  alter column target_margin    set not null,
  alter column contingency_rate set not null,
  alter column tax_rate         set not null,
  alter column labor_rate_cents set not null,
  add constraint quotes_status_chk check (status in ('draft','sent','approved','superseded','lost')),
  add constraint quotes_margin_chk check (target_margin >= 0 and target_margin < 0.95),
  add constraint quotes_rates_chk  check (contingency_rate between 0 and 0.5 and tax_rate between 0 and 0.2
                                          and labor_rate_cents >= 0);

-- Line items live in their own table now; totals come from views.
alter table public.quotes
  drop column if exists line_items_json,
  drop column if exists subtotal,
  drop column if exists tax,
  drop column if exists total;

create unique index if not exists quotes_lead_version on public.quotes (lead_id, version);

create or replace function public.quotes_fill_defaults()
returns trigger language plpgsql set search_path = public as $$
declare s public.estimating_settings%rowtype;
begin
  if new.company_id is null then
    select company_id into new.company_id from public.leads where id = new.lead_id;
  end if;
  select * into s from public.estimating_settings where company_id = new.company_id;
  new.target_margin    := coalesce(new.target_margin,    s.target_margin,    0.35);
  new.contingency_rate := coalesce(new.contingency_rate, s.contingency_rate, 0.07);
  new.tax_rate         := coalesce(new.tax_rate,         s.tax_rate,         0.06);
  new.labor_rate_cents := coalesce(new.labor_rate_cents, s.labor_rate_cents, 5500);
  new.status           := coalesce(new.status, 'draft');
  return new;
end $$;
create trigger quotes_defaults before insert on public.quotes
  for each row execute function public.quotes_fill_defaults();

-- Approved / superseded quotes are frozen: pricing inputs cannot change.
create or replace function public.guard_quote_pricing()
returns trigger language plpgsql as $$
begin
  if old.status in ('approved','superseded')
     and (new.target_margin, new.contingency_rate, new.tax_rate, new.labor_rate_cents, new.takeoff)
         is distinct from
         (old.target_margin, old.contingency_rate, old.tax_rate, old.labor_rate_cents, old.takeoff) then
    raise exception 'Quote % is %: duplicate it to make a new version', old.id, old.status
      using errcode = 'check_violation';
  end if;
  if old.status = 'superseded' and new.status <> 'superseded' then
    raise exception 'Quote % is superseded and cannot be reopened', old.id using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger quotes_guard before update on public.quotes
  for each row execute function public.guard_quote_pricing();
create trigger quotes_updated before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7. Quote line items
-- ---------------------------------------------------------------------
create table public.quote_line_items (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  quote_id          uuid not null references public.quotes(id) on delete cascade,
  section_id        uuid not null references public.quote_sections(id),
  category_id       uuid references public.catalog_categories(id),
  pick_phase_id     uuid references public.pick_phases(id),
  catalog_item_id   uuid references public.catalog_items(id) on delete set null,
  cost_category     text not null default 'materials' check (cost_category in
                      ('materials','labor','subcontractor','permit','delivery','disposal','other')),
  code              text not null default '',
  name              text not null,
  qty               numeric(10,2) not null default 1 check (qty >= 0),
  unit              text not null default 'ea',
  unit_cost_cents   bigint not null default 0 check (unit_cost_cents >= 0), -- snapshot of the price book
  uses_labor_rate   boolean not null default false,
  margin_override   numeric(5,4) check (margin_override is null or (margin_override >= 0 and margin_override < 0.95)),
  pricing_mode      text not null default 'margin' check (pricing_mode in ('margin','fixed')),
  unit_price_cents  bigint check (unit_price_cents >= 0),   -- sell price when pricing_mode = 'fixed'
  list_price_cents  bigint check (list_price_cents >= 0),   -- vendor MSRP snapshot (cabinets)
  collection_id     uuid references public.catalog_collections(id) on delete set null,
  taxable           boolean not null default true,
  is_allowance      boolean not null default false,
  vendor            text,
  qty_source        text,       -- copied from the catalog; null = qty typed by hand
  note              text,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint quote_line_items_fixed_has_price check (pricing_mode = 'margin' or unit_price_cents is not null)
);
create index quote_line_items_quote on public.quote_line_items (quote_id, sort_order);

create or replace function public.guard_quote_lines()
returns trigger language plpgsql set search_path = public as $$
declare v_status text;
begin
  if tg_op = 'DELETE' then
    select status into v_status from public.quotes where id = old.quote_id;
  else
    select status into v_status from public.quotes where id = new.quote_id;
    if tg_op = 'INSERT' and new.company_id is null then
      select company_id into new.company_id from public.quotes where id = new.quote_id;
    end if;
    if tg_op = 'UPDATE' and new.quote_id <> old.quote_id then
      raise exception 'Line items cannot move between quotes' using errcode = 'check_violation';
    end if;
  end if;
  if v_status in ('approved','superseded') then
    raise exception 'Quote is %: duplicate it to change line items', v_status using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger quote_line_items_guard before insert or update or delete on public.quote_line_items
  for each row execute function public.guard_quote_lines();
create trigger quote_line_items_updated before update on public.quote_line_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 8. Project materials = order tracking + crew pick list (no costs)
-- ---------------------------------------------------------------------
create table public.project_materials (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  source_quote_id      uuid references public.quotes(id) on delete set null,
  source_line_item_id  uuid references public.quote_line_items(id) on delete set null,
  pick_phase_id        uuid references public.pick_phases(id),
  code                 text not null default '',
  name                 text not null,
  qty                  numeric(10,2) not null check (qty >= 0),
  unit                 text not null default 'ea',
  vendor               text,
  order_status         text not null default 'to_order' check (order_status in
                         ('to_order','ordered','received','backordered','damaged','returned')),
  ordered_at           timestamptz,
  received_at          timestamptz,
  packed               boolean not null default false,
  packed_by            uuid references public.users(id),
  packed_at            timestamptz,
  note                 text,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index project_materials_project on public.project_materials (project_id, sort_order);

-- Crew may only change packing / receiving fields; timestamps are stamped here.
create or replace function public.guard_project_materials()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.current_app_role() = 'crew'
     and (new.company_id, new.project_id, new.source_quote_id, new.source_line_item_id, new.pick_phase_id,
          new.code, new.name, new.qty, new.unit, new.vendor, new.sort_order, new.ordered_at)
         is distinct from
         (old.company_id, old.project_id, old.source_quote_id, old.source_line_item_id, old.pick_phase_id,
          old.code, old.name, old.qty, old.unit, old.vendor, old.sort_order, old.ordered_at) then
    raise exception 'Crew can only update packing and receiving status' using errcode = '42501';
  end if;
  if new.packed and not old.packed then
    new.packed_at := now();
    new.packed_by := coalesce(new.packed_by, public.current_user_id());
  elsif not new.packed then
    new.packed_at := null;
    new.packed_by := null;
  end if;
  if new.order_status = 'ordered' and old.order_status <> 'ordered' then
    new.ordered_at := coalesce(new.ordered_at, now());
  end if;
  if new.order_status = 'received' and old.order_status <> 'received' then
    new.received_at := coalesce(new.received_at, now());
  end if;
  return new;
end $$;
create trigger project_materials_guard before update on public.project_materials
  for each row execute function public.guard_project_materials();
create trigger project_materials_updated before update on public.project_materials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 9. Priced views (security_invoker: RLS of the caller applies)
-- ---------------------------------------------------------------------
create view public.quote_line_items_priced with (security_invoker = true) as
select
  li.*,
  u.effective_unit_cost_cents,
  c.ext_cost_cents,
  m.effective_margin,
  p.price_cents,
  case when p.price_cents = 0 then 0
       else round((p.price_cents - c.ext_cost_cents)::numeric / p.price_cents, 4) end as line_margin
from public.quote_line_items li
join public.quotes q on q.id = li.quote_id
cross join lateral (select case when li.uses_labor_rate then q.labor_rate_cents
                                else li.unit_cost_cents end as effective_unit_cost_cents) u
cross join lateral (select round(li.qty * u.effective_unit_cost_cents)::bigint as ext_cost_cents) c
cross join lateral (select coalesce(li.margin_override, q.target_margin) as effective_margin) m
cross join lateral (select case when li.pricing_mode = 'fixed' then round(li.qty * li.unit_price_cents)::bigint
                                else round(c.ext_cost_cents / (1 - m.effective_margin))::bigint end as price_cents) p;

create view public.quote_totals with (security_invoker = true) as
with lines as (
  select quote_id,
         count(*)                                         as line_count,
         sum(ext_cost_cents)                              as direct_cost_cents,
         coalesce(sum(ext_cost_cents) filter (where taxable), 0) as taxable_cost_cents,
         sum(price_cents)                                 as lines_price_cents
  from public.quote_line_items_priced
  group by quote_id
),
base as (
  select q.id as quote_id, q.company_id, q.lead_id, q.version, q.status, q.target_margin,
         coalesce(l.line_count, 0)                 as line_count,
         coalesce(l.direct_cost_cents, 0)::bigint  as direct_cost_cents,
         coalesce(l.taxable_cost_cents, 0)::bigint as taxable_cost_cents,
         coalesce(l.lines_price_cents, 0)::bigint  as lines_price_cents,
         round(coalesce(l.direct_cost_cents, 0) * q.contingency_rate)::bigint as contingency_cost_cents,
         round(coalesce(l.taxable_cost_cents, 0) * q.tax_rate)::bigint        as tax_cost_cents
  from public.quotes q
  left join lines l on l.quote_id = q.id
),
priced as (
  select b.*,
         round(b.contingency_cost_cents / (1 - b.target_margin))::bigint as contingency_price_cents,
         round(b.tax_cost_cents / (1 - b.target_margin))::bigint         as tax_price_cents
  from base b
)
select p.*,
       (p.direct_cost_cents + p.contingency_cost_cents + p.tax_cost_cents)::bigint    as total_cost_cents,
       (p.lines_price_cents + p.contingency_price_cents + p.tax_price_cents)::bigint  as total_price_cents,
       (p.lines_price_cents + p.contingency_price_cents + p.tax_price_cents
        - p.direct_cost_cents - p.contingency_cost_cents - p.tax_cost_cents)::bigint  as gross_profit_cents,
       case when (p.lines_price_cents + p.contingency_price_cents + p.tax_price_cents) = 0 then 0
            else round((p.lines_price_cents + p.contingency_price_cents + p.tax_price_cents
                        - p.direct_cost_cents - p.contingency_cost_cents - p.tax_cost_cents)::numeric
                       / (p.lines_price_cents + p.contingency_price_cents + p.tax_price_cents), 4) end as gross_margin
from priced p;

-- Client-facing section totals. Contingency + tax are folded into the absorbing section.
create view public.quote_section_totals with (security_invoker = true) as
with sec as (
  select quote_id, section_id, sum(price_cents)::bigint as lines_price_cents, count(*) as line_count
  from public.quote_line_items_priced
  where qty > 0
  group by quote_id, section_id
)
select q.id as quote_id, s.id as section_id, s.name, s.client_description, s.sort_order,
       coalesce(sec.line_count, 0) as line_count,
       (coalesce(sec.lines_price_cents, 0)
        + case when s.absorbs_project_costs then t.contingency_price_cents + t.tax_price_cents else 0 end
       )::bigint as price_cents
from public.quotes q
join public.quote_sections s on s.company_id = q.company_id and s.active
join public.quote_totals t on t.quote_id = q.id
left join sec on sec.quote_id = q.id and sec.section_id = s.id
where sec.section_id is not null or s.absorbs_project_costs;

-- Estimated cost per (cost category, vendor) -> becomes project costs at conversion.
create view public.quote_cost_rollup with (security_invoker = true) as
select quote_id, cost_category, coalesce(nullif(vendor, ''), 'Unassigned') as vendor,
       sum(ext_cost_cents)::bigint as estimated_cost_cents
from public.quote_line_items_priced
group by quote_id, cost_category, coalesce(nullif(vendor, ''), 'Unassigned')
union all
select quote_id, 'other', 'Contingency reserve', contingency_cost_cents from public.quote_totals
union all
select quote_id, 'materials', 'Sales tax on materials', tax_cost_cents from public.quote_totals;

-- ---------------------------------------------------------------------
-- 10. Workflow functions
-- ---------------------------------------------------------------------
create or replace function public.create_quote_from_template(p_lead_id uuid, p_template_id uuid, p_name text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid;
  v_quote   uuid;
  v_version int;
  v_tpl     public.quote_templates%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can create quotes' using errcode = '42501';
  end if;
  select company_id into v_company from public.leads where id = p_lead_id;
  if v_company is null then raise exception 'Lead % not found', p_lead_id; end if;
  select * into v_tpl from public.quote_templates where id = p_template_id and company_id = v_company;
  if not found then raise exception 'Template % not found for this company', p_template_id; end if;

  select coalesce(max(version), 0) + 1 into v_version from public.quotes where lead_id = p_lead_id;

  insert into public.quotes (company_id, lead_id, version, name, template_id, takeoff, status, created_by)
  values (v_company, p_lead_id, v_version, coalesce(p_name, v_tpl.name), v_tpl.id, v_tpl.default_takeoff,
          'draft', public.current_user_id())
  returning id into v_quote;

  insert into public.quote_line_items
    (company_id, quote_id, section_id, category_id, pick_phase_id, catalog_item_id, cost_category,
     code, name, qty, unit, unit_cost_cents, uses_labor_rate, taxable, is_allowance, vendor,
     qty_source, note, sort_order, pricing_mode, unit_price_cents, list_price_cents, collection_id)
  select v_company, v_quote, coalesce(ci.section_id, cc.default_section_id), cc.id, cc.default_pick_phase_id,
         ci.id, coalesce(ci.cost_category, cc.cost_category),
         ci.code, ci.name, ti.qty, ci.unit, ci.unit_cost_cents, ci.uses_labor_rate, ci.taxable,
         ci.is_allowance, ci.vendor, ci.qty_source, coalesce(ti.note, ci.notes), ti.sort_order,
         ci.pricing_mode, ci.unit_price_cents, ci.list_price_cents, ci.collection_id
  from public.quote_template_items ti
  join public.catalog_items ci      on ci.id = ti.catalog_item_id
  join public.catalog_categories cc on cc.id = ci.category_id
  where ti.template_id = v_tpl.id
  order by ti.sort_order;

  return v_quote;
end $$;

-- New editable version with the same lines and rates (use after approval or for options).
create or replace function public.duplicate_quote(p_quote_id uuid, p_name text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  q       public.quotes%rowtype;
  v_new   uuid;
  v_ver   int;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can duplicate quotes' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % not found', p_quote_id; end if;
  select coalesce(max(version), 0) + 1 into v_ver from public.quotes where lead_id = q.lead_id;

  insert into public.quotes (company_id, lead_id, version, name, template_id, takeoff, status, collection_id,
                             target_margin, contingency_rate, tax_rate, labor_rate_cents, created_by)
  values (q.company_id, q.lead_id, v_ver, coalesce(p_name, q.name), q.template_id, q.takeoff, 'draft', q.collection_id,
          q.target_margin, q.contingency_rate, q.tax_rate, q.labor_rate_cents, public.current_user_id())
  returning id into v_new;

  insert into public.quote_line_items
    (company_id, quote_id, section_id, category_id, pick_phase_id, catalog_item_id, cost_category,
     code, name, qty, unit, unit_cost_cents, uses_labor_rate, margin_override, taxable, is_allowance,
     vendor, qty_source, note, sort_order, pricing_mode, unit_price_cents, list_price_cents, collection_id)
  select company_id, v_new, section_id, category_id, pick_phase_id, catalog_item_id, cost_category,
         code, name, qty, unit, unit_cost_cents, uses_labor_rate, margin_override, taxable, is_allowance,
         vendor, qty_source, note, sort_order, pricing_mode, unit_price_cents, list_price_cents, collection_id
  from public.quote_line_items where quote_id = p_quote_id;

  return v_new;
end $$;

-- Freezes the quote, snapshots totals, supersedes the lead's other open versions.
create or replace function public.approve_quote(p_quote_id uuid)
returns public.quote_totals language plpgsql security invoker set search_path = public as $$
declare
  q public.quotes%rowtype;
  t public.quote_totals%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can approve quotes' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote % not found', p_quote_id; end if;
  if q.status not in ('draft','sent') then
    raise exception 'Only draft or sent quotes can be approved (this one is %)', q.status;
  end if;
  select * into t from public.quote_totals where quote_id = p_quote_id;
  if t.line_count = 0 then raise exception 'Quote has no line items'; end if;

  update public.quotes set status = 'superseded'
   where lead_id = q.lead_id and id <> q.id and status in ('draft','sent');

  update public.quotes
     set status = 'approved',
         approved_at = now(),
         approved_price_cents = t.total_price_cents,
         approved_cost_cents  = t.total_cost_cents
   where id = p_quote_id;

  return t;
end $$;

-- Called by the "Deposit received -> create project" server action, after the project row exists.
create or replace function public.materialize_quote_into_project(p_quote_id uuid, p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  q public.quotes%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can convert quotes' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % not found', p_quote_id; end if;
  if q.status <> 'approved' then raise exception 'Approve the quote before converting it'; end if;
  perform 1 from public.projects where id = p_project_id and company_id = q.company_id;
  if not found then raise exception 'Project % not found for this company', p_project_id; end if;
  if exists (select 1 from public.project_materials
             where project_id = p_project_id and source_quote_id = p_quote_id) then
    raise exception 'Quote % was already converted into this project', p_quote_id;
  end if;

  -- Estimated costs per category + vendor (actuals get entered against these later).
  insert into public.costs (project_id, category, vendor, estimated_amount)
  select p_project_id, r.cost_category, r.vendor, r.estimated_cost_cents
  from public.quote_cost_rollup r
  where r.quote_id = p_quote_id and r.estimated_cost_cents <> 0
  order by r.cost_category, r.vendor;

  -- Everything the crew handles, with order + packing status. No costs on this table.
  insert into public.project_materials
    (company_id, project_id, source_quote_id, source_line_item_id, pick_phase_id,
     code, name, qty, unit, vendor, note, sort_order)
  select li.company_id, p_project_id, p_quote_id, li.id, li.pick_phase_id,
         li.code, li.name, li.qty, li.unit, li.vendor, li.note, li.sort_order
  from public.quote_line_items li
  where li.quote_id = p_quote_id and li.pick_phase_id is not null and li.qty > 0
  order by li.sort_order;

  update public.projects
     set contract_value = coalesce(contract_value, q.approved_price_cents)
   where id = p_project_id;
end $$;

-- ---------------------------------------------------------------------
-- 10b. Vendor price list import + quote helpers for the quick estimate
-- ---------------------------------------------------------------------
-- p_collections = [{ "name", "colors": [..], "sort_order",
--                    "items": [{ "code","description","unit","list_price_cents","cost_cents","category" }] }]
-- Built by lib/estimating/vendorImport.ts from the vendor's spreadsheet.
-- Upserts by (collection, code); items missing from the new list are deactivated.
create or replace function public.import_price_list(
  p_company_id uuid, p_vendor text, p_list_name text, p_cost_multiplier numeric,
  p_effective_date date, p_source_file text, p_collections jsonb)
returns table (collection text, items_upserted int, items_deactivated int)
language plpgsql security invoker set search_path = public as $$
declare
  v_list uuid;
  v_coll uuid;
  c jsonb;
  v_up int;
  v_off int;
begin
  if not public.is_team() and auth.jwt() ->> 'sub' is not null then
    raise exception 'Only owners or team members can import price lists' using errcode = '42501';
  end if;

  insert into public.price_lists (company_id, vendor, name, cost_multiplier, effective_date, source_file)
  values (p_company_id, p_vendor, p_list_name, p_cost_multiplier, coalesce(p_effective_date, current_date), p_source_file)
  on conflict (company_id, name) do update
    set cost_multiplier = excluded.cost_multiplier, effective_date = excluded.effective_date,
        source_file = excluded.source_file, vendor = excluded.vendor
  returning id into v_list;

  for c in select * from jsonb_array_elements(p_collections) loop
    insert into public.catalog_collections (company_id, price_list_id, name, colors, sort_order)
    values (p_company_id, v_list, c->>'name',
            array(select jsonb_array_elements_text(coalesce(c->'colors', '[]'::jsonb))),
            coalesce((c->>'sort_order')::int, 0))
    on conflict (company_id, name) do update
      set price_list_id = excluded.price_list_id, colors = excluded.colors, sort_order = excluded.sort_order, active = true
    returning id into v_coll;

    if exists (select 1 from jsonb_array_elements(c->'items') i
               where not exists (select 1 from public.catalog_categories cc
                                 where cc.company_id = p_company_id and cc.name = i->>'category')) then
      raise exception 'Unknown category in price list (create it first): %',
        (select string_agg(distinct i->>'category', ', ') from jsonb_array_elements(c->'items') i
         where not exists (select 1 from public.catalog_categories cc
                           where cc.company_id = p_company_id and cc.name = i->>'category'));
    end if;

    insert into public.catalog_items
      (company_id, category_id, collection_id, code, name, unit, list_price_cents, unit_cost_cents,
       taxable, vendor, price_source, source_checked_on, active)
    select p_company_id, cc.id, v_coll, i->>'code', i->>'description', coalesce(i->>'unit', 'ea'),
           (i->>'list_price_cents')::bigint, (i->>'cost_cents')::bigint,
           true, p_vendor, 'vendor_list', coalesce(p_effective_date, current_date), true
    from jsonb_array_elements(c->'items') i
    join public.catalog_categories cc on cc.company_id = p_company_id and cc.name = i->>'category'
    on conflict (company_id, collection_id, code) where collection_id is not null do update
      set name = excluded.name, unit = excluded.unit, category_id = excluded.category_id,
          list_price_cents = excluded.list_price_cents, unit_cost_cents = excluded.unit_cost_cents,
          vendor = excluded.vendor, price_source = 'vendor_list',
          source_checked_on = excluded.source_checked_on, active = true;
    get diagnostics v_up = row_count;

    update public.catalog_items ci set active = false
     where ci.collection_id = v_coll and ci.active
       and not exists (select 1 from jsonb_array_elements(c->'items') i where i->>'code' = ci.code);
    get diagnostics v_off = row_count;

    collection := c->>'name'; items_upserted := v_up; items_deactivated := v_off;
    return next;
  end loop;
end $$;

-- Re-price a quote in another color group: every line whose code exists in the target
-- collection is swapped to that item (cost, MSRP, description). Returns what happened per code.
create or replace function public.set_quote_collection(p_quote_id uuid, p_collection_id uuid)
returns table (code text, status text)
language plpgsql security invoker set search_path = public as $$
declare q public.quotes%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can change quotes' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id;
  if not found then raise exception 'Quote % not found', p_quote_id; end if;
  perform 1 from public.catalog_collections where id = p_collection_id and company_id = q.company_id;
  if not found then raise exception 'Color group % not found for this company', p_collection_id; end if;

  update public.quotes set collection_id = p_collection_id where id = p_quote_id;

  return query
  with target as (
    select ci.* from public.catalog_items ci where ci.collection_id = p_collection_id and ci.active
  ),
  swapped as (
    update public.quote_line_items li
       set catalog_item_id = t.id, collection_id = t.collection_id, category_id = t.category_id,
           name = t.name, unit = t.unit, unit_cost_cents = t.unit_cost_cents,
           list_price_cents = t.list_price_cents, pricing_mode = t.pricing_mode,
           unit_price_cents = t.unit_price_cents, vendor = t.vendor
      from target t
     where li.quote_id = p_quote_id and li.code <> '' and li.code = t.code
    returning li.code
  )
  select s.code, 'swapped'::text from swapped s
  union all
  select li.code, 'missing in color group'::text
    from public.quote_line_items li
    join public.catalog_categories cc on cc.id = li.category_id
   where li.quote_id = p_quote_id and cc.name in ('Cabinets', 'Fillers & trim', 'Cabinet accessories')
     and li.qty > 0 and li.code <> ''
     and not exists (select 1 from target t where t.code = li.code);
end $$;

-- Swap one line to another price-book item, keeping qty (quartz level, faucet, sink…).
create or replace function public.swap_line_item(p_line_id uuid, p_catalog_item_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  li public.quote_line_items%rowtype;
  ci public.catalog_items%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can change quotes' using errcode = '42501';
  end if;
  select * into li from public.quote_line_items where id = p_line_id;
  if not found then raise exception 'Line % not found', p_line_id; end if;
  select * into ci from public.catalog_items where id = p_catalog_item_id and company_id = li.company_id;
  if not found then raise exception 'Price-book item % not found', p_catalog_item_id; end if;
  update public.quote_line_items
     set catalog_item_id = ci.id, collection_id = ci.collection_id, category_id = ci.category_id,
         code = ci.code, name = ci.name, unit = ci.unit, unit_cost_cents = ci.unit_cost_cents,
         uses_labor_rate = ci.uses_labor_rate, taxable = ci.taxable, is_allowance = ci.is_allowance,
         vendor = ci.vendor, qty_source = coalesce(ci.qty_source, li.qty_source),
         pricing_mode = ci.pricing_mode, unit_price_cents = ci.unit_price_cents,
         list_price_cents = ci.list_price_cents
   where id = p_line_id;
end $$;

-- ---------------------------------------------------------------------
-- 10c. Competitor comparison (Home Depot)
--   comparison_prices: what the same/closest item costs at a retailer, with URL + date.
--   Matched to quote lines by catalog item, or by code for vendor cabinet codes (any color group).
--   comparison_adjustments: retailer fees/quotes that are not items (measure fee, an actual install quote).
-- ---------------------------------------------------------------------
create table public.comparison_sources (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  name        text not null,
  disclaimer  text not null,
  active      boolean not null default true,
  unique (company_id, name)
);

create table public.comparison_prices (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  source_id         uuid not null references public.comparison_sources(id) on delete cascade,
  catalog_item_id   uuid references public.catalog_items(id) on delete cascade,
  match_code        text,                -- e.g. 'SB36' matches that code in every color group
  product_name      text not null,
  sku               text,
  url               text,
  pack_qty          numeric(10,2) not null default 1 check (pack_qty > 0),
  pack_price_cents  bigint not null check (pack_price_cents >= 0),
  is_substitute     boolean not null default false,  -- closest available, not the same item
  verified          boolean not null default false,  -- price read from the retailer page on checked_on
  checked_on        date not null,
  notes             text,
  constraint comparison_prices_target check (num_nonnulls(catalog_item_id, match_code) = 1)
);
create unique index comparison_prices_item on public.comparison_prices (source_id, catalog_item_id)
  where catalog_item_id is not null;
create unique index comparison_prices_code on public.comparison_prices (source_id, match_code)
  where match_code is not null;

create table public.comparison_adjustments (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  source_id     uuid not null references public.comparison_sources(id) on delete cascade,
  quote_id      uuid references public.quotes(id) on delete cascade, -- null = applies to every quote
  label         text not null,
  amount_cents  bigint not null,
  verified      boolean not null default false,
  url           text,
  checked_on    date,
  sort_order    int not null default 0
);

-- One row per quote line per source: our price vs the retailer's materials cost.
-- Packs are rounded up (you can't buy 0.3 of a box). Retailer sales tax is added at the quote's tax rate.
create view public.quote_comparison_lines with (security_invoker = true) as
select li.quote_id, s.id as source_id, s.name as source_name, li.id as line_id, li.sort_order,
       li.section_id, li.code, li.name, li.qty, li.unit, li.price_cents as our_price_cents,
       cp.product_name, cp.sku, cp.url, cp.pack_qty, cp.pack_price_cents, cp.is_substitute,
       cp.verified, cp.checked_on,
       case when cp.id is null then null
            else ceil(li.qty / cp.pack_qty)::int end as packs,
       case when cp.id is null then null
            else round(ceil(li.qty / cp.pack_qty) * cp.pack_price_cents * (1 + q.tax_rate))::bigint
       end as retailer_cost_cents
from public.quote_line_items_priced li
join public.quotes q on q.id = li.quote_id
join public.comparison_sources s on s.company_id = li.company_id and s.active
left join lateral (
  select c.* from public.comparison_prices c
   where c.source_id = s.id
     and (c.catalog_item_id = li.catalog_item_id or (c.match_code is not null and c.match_code = li.code))
   order by (c.catalog_item_id is not null) desc
   limit 1
) cp on true
where li.qty > 0;

create view public.quote_comparison_totals with (security_invoker = true) as
with l as (
  select quote_id, source_id, source_name,
         count(*) filter (where retailer_cost_cents is not null)                       as covered_lines,
         count(*) filter (where retailer_cost_cents is null)                           as uncovered_lines,
         coalesce(sum(retailer_cost_cents), 0)::bigint                                  as retailer_materials_cents,
         coalesce(sum(our_price_cents) filter (where retailer_cost_cents is not null), 0)::bigint
                                                                                        as our_price_covered_cents,
         count(*) filter (where retailer_cost_cents is not null and not verified)       as unverified_lines,
         count(*) filter (where is_substitute)                                          as substitute_lines,
         min(checked_on)                                                                as oldest_price_date
  from public.quote_comparison_lines
  group by quote_id, source_id, source_name
),
a as (
  select q.id as quote_id, ca.source_id, coalesce(sum(ca.amount_cents), 0)::bigint as adjustments_cents,
         bool_and(ca.verified) as adjustments_verified
  from public.quotes q
  join public.comparison_adjustments ca on ca.company_id = q.company_id
       and (ca.quote_id is null or ca.quote_id = q.id)
  group by q.id, ca.source_id
)
select l.*, coalesce(a.adjustments_cents, 0) as adjustments_cents, a.adjustments_verified,
       (l.retailer_materials_cents + coalesce(a.adjustments_cents, 0))::bigint as retailer_total_cents,
       t.total_price_cents as our_total_price_cents
from l
join public.quote_totals t on t.quote_id = l.quote_id
left join a on a.quote_id = l.quote_id and a.source_id = l.source_id;

-- ---------------------------------------------------------------------
-- 11. Row Level Security
-- ---------------------------------------------------------------------
alter table public.estimating_settings  enable row level security;
alter table public.quote_sections       enable row level security;
alter table public.pick_phases          enable row level security;
alter table public.catalog_categories   enable row level security;
alter table public.catalog_items        enable row level security;
alter table public.quote_templates      enable row level security;
alter table public.quote_template_items enable row level security;
alter table public.quotes               enable row level security;
alter table public.quote_line_items     enable row level security;
alter table public.project_materials    enable row level security;
alter table public.price_lists          enable row level security;
alter table public.catalog_collections  enable row level security;
alter table public.comparison_sources   enable row level security;
alter table public.comparison_prices    enable row level security;
alter table public.comparison_adjustments enable row level security;

create policy price_lists_team on public.price_lists for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy collections_read on public.catalog_collections for select to authenticated
  using (company_id = public.current_company_id());
create policy collections_team on public.catalog_collections for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy comparison_sources_team on public.comparison_sources for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy comparison_prices_team on public.comparison_prices for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy comparison_adjustments_team on public.comparison_adjustments for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

-- Settings-style tables: owners change them; team reads all; crew reads section/phase names only.
create policy est_settings_read  on public.estimating_settings for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy est_settings_write on public.estimating_settings for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create policy sections_read  on public.quote_sections for select to authenticated
  using (company_id = public.current_company_id());
create policy sections_write on public.quote_sections for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create policy phases_read  on public.pick_phases for select to authenticated
  using (company_id = public.current_company_id());
create policy phases_write on public.pick_phases for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create policy categories_read  on public.catalog_categories for select to authenticated
  using (company_id = public.current_company_id());
create policy categories_write on public.catalog_categories for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Costs and margins: owners + team (crew never sees money).
create policy catalog_items_all on public.catalog_items for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

create policy templates_all on public.quote_templates for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

create policy template_items_all on public.quote_template_items for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

create policy quotes_team on public.quotes for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

create policy quote_lines_team on public.quote_line_items for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

-- Materials: owners + team manage; crew reads and ticks off on assigned projects only.
create policy materials_team on public.project_materials for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy materials_crew_read on public.project_materials for select to authenticated
  using (company_id = public.current_company_id() and public.is_assigned_to_project(project_id));
create policy materials_crew_update on public.project_materials for update to authenticated
  using (company_id = public.current_company_id() and public.is_assigned_to_project(project_id))
  with check (company_id = public.current_company_id() and public.is_assigned_to_project(project_id));

revoke execute on function public.create_quote_from_template(uuid, uuid, text) from public, anon;
revoke execute on function public.duplicate_quote(uuid, text)                  from public, anon;
revoke execute on function public.approve_quote(uuid)                          from public, anon;
revoke execute on function public.materialize_quote_into_project(uuid, uuid)   from public, anon;
revoke execute on function public.import_price_list(uuid, text, text, numeric, date, text, jsonb) from public, anon;
revoke execute on function public.set_quote_collection(uuid, uuid)             from public, anon;
revoke execute on function public.swap_line_item(uuid, uuid)                   from public, anon;
grant  execute on function public.import_price_list(uuid, text, text, numeric, date, text, jsonb) to authenticated, service_role;
grant  execute on function public.set_quote_collection(uuid, uuid)             to authenticated;
grant  execute on function public.swap_line_item(uuid, uuid)                   to authenticated;
grant  execute on function public.create_quote_from_template(uuid, uuid, text) to authenticated;
grant  execute on function public.duplicate_quote(uuid, text)                  to authenticated;
grant  execute on function public.approve_quote(uuid)                          to authenticated;
grant  execute on function public.materialize_quote_into_project(uuid, uuid)   to authenticated;
