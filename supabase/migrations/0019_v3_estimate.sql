-- =====================================================================
-- 0019_v3_estimate.sql — change request v3, batch C (docs/PLAN.md v3, items 9 + 10)
--   1. catalog_colors: each brand's colors (name, series, swatch) → the color group that prices them
--   2. cabinet_groups + cabinet_group_rules: Wall / Base / Corner / Pantry / Vanity / Accessories for bulk add
--   3. estimate_accessories: the accessory list per brand (fillers, toe kick, lights, scribe, crown, panels, DW end panel)
--   4. estimate_special_types: special work (electrical, gas, plumbing, flooring, other) and where it prints
--   5. quotes.color_code: the color picked on the estimate
--   6. import_brand_colors() + sync_collection_colors(): colors arrive with a price list
-- Brand = price_lists.vendor (TimberPeak, Skyline): a column, not code. Everything here is config in the DB.
-- Additive only; quotes gets one nullable column.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colors per brand
-- ---------------------------------------------------------------------
create table public.catalog_colors (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  price_list_id  uuid not null references public.price_lists (id) on delete cascade,
  collection_id  uuid not null references public.catalog_collections (id) on delete cascade,
  code           text not null check (length(btrim(code)) between 1 and 20),
  name           text not null check (length(btrim(name)) between 1 and 80),
  line           text,                       -- series shown as a heading in the picker (Essential, Charm, …)
  swatch_url     text check (swatch_url is null or swatch_url ~ '^(/|https://)'),
  sort_order     int not null default 0,
  active         boolean not null default true,
  unique (company_id, price_list_id, code)
);
create index catalog_colors_list on public.catalog_colors (company_id, price_list_id, sort_order);

alter table public.catalog_colors enable row level security;
create policy catalog_colors_read on public.catalog_colors for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy catalog_colors_owner on public.catalog_colors for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Colors that come with a price list (names, series, swatches). p_colors: [{code, name, line, collection, sort_order, swatch_url}]
create or replace function public.import_brand_colors(p_company_id uuid, p_list_name text, p_colors jsonb)
returns int language plpgsql security invoker set search_path = public as $$
declare v_list uuid; n int;
begin
  if not public.is_owner() and auth.jwt() ->> 'sub' is not null then
    raise exception 'Only the owner can import price lists' using errcode = '42501';
  end if;
  select id into v_list from public.price_lists where company_id = p_company_id and name = p_list_name;
  if v_list is null then raise exception 'Import the price list "%" first', p_list_name; end if;
  insert into public.catalog_colors (company_id, price_list_id, collection_id, code, name, line, swatch_url, sort_order)
  select p_company_id, v_list, cc.id, c ->> 'code', coalesce(c ->> 'name', c ->> 'code'), c ->> 'line',
         c ->> 'swatch_url', coalesce((c ->> 'sort_order')::int, 0)
    from jsonb_array_elements(p_colors) c
    join public.catalog_collections cc on cc.company_id = p_company_id and cc.name = c ->> 'collection'
  on conflict (company_id, price_list_id, code) do update
    set collection_id = excluded.collection_id, name = excluded.name, line = excluded.line,
        swatch_url = excluded.swatch_url, sort_order = excluded.sort_order, active = true;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.import_brand_colors(uuid, text, jsonb) from public, anon;
grant execute on function public.import_brand_colors(uuid, text, jsonb) to authenticated, service_role;

-- Price lists imported without color names (TimberPeak): one color per code in each collection, named by its code.
create or replace function public.sync_collection_colors(p_company_id uuid)
returns int language sql security definer set search_path = public as $$
  with ins as (
    insert into public.catalog_colors (company_id, price_list_id, collection_id, code, name, line, sort_order)
    select c.company_id, c.price_list_id, c.id, x.code, x.code,
           regexp_replace(c.name, '^' || pl.vendor || '\s*', ''), c.sort_order * 100 + x.n::int
      from public.catalog_collections c
      join public.price_lists pl on pl.id = c.price_list_id
      cross join lateral unnest(c.colors) with ordinality as x(code, n)
     where c.company_id = p_company_id and c.active
    on conflict (company_id, price_list_id, code) do nothing
    returning 1)
  select count(*)::int from ins
$$;
revoke execute on function public.sync_collection_colors(uuid) from public, anon;
grant execute on function public.sync_collection_colors(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Cabinet groups for bulk add (Settings-editable rules, first match wins)
-- ---------------------------------------------------------------------
create table public.cabinet_groups (
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,30}$'),
  label       text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  primary key (company_id, key)
);

create table public.cabinet_group_rules (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  group_key   text not null,                          -- a cabinet_groups key, or 'skip' (never offered)
  match_on    text not null check (match_on in ('code', 'category')),
  pattern     text not null,                          -- case-insensitive regex
  sort_order  int not null default 0,
  active      boolean not null default true
);
create index cabinet_group_rules_company on public.cabinet_group_rules (company_id, sort_order);

alter table public.cabinet_groups enable row level security;
alter table public.cabinet_group_rules enable row level security;
create policy cabinet_groups_read on public.cabinet_groups for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy cabinet_groups_owner on public.cabinet_groups for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
create policy cabinet_group_rules_read on public.cabinet_group_rules for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy cabinet_group_rules_owner on public.cabinet_group_rules for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create or replace function public.cabinet_group_of(p_company uuid, p_code text, p_category text)
returns text language sql stable security definer set search_path = public as $$
  select r.group_key
    from public.cabinet_group_rules r
   where r.company_id = p_company and r.active
     and case r.match_on when 'code' then coalesce(p_code, '') ~* r.pattern
                         else coalesce(p_category, '') ~* r.pattern end
   order by r.sort_order, r.id
   limit 1
$$;

-- Price-list items with their bulk-add group. RLS of catalog_items applies (security invoker).
create view public.catalog_items_grouped with (security_invoker = true) as
select ci.id, ci.company_id, ci.collection_id, ci.category_id, ci.code, ci.name, ci.unit,
       ci.list_price_cents, ci.unit_cost_cents, ci.active, cc.name as category_name,
       public.cabinet_group_of(ci.company_id, ci.code, cc.name) as group_key
  from public.catalog_items ci
  join public.catalog_categories cc on cc.id = ci.category_id;

-- ---------------------------------------------------------------------
-- 3. Accessory list per brand (vendor null = every brand). Resolved on the estimate:
--    code → the item with that code in the estimate's color group, else the generic item with that code;
--    item_name → the generic (no color group) item with that name.
-- ---------------------------------------------------------------------
create table public.estimate_accessories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null check (length(btrim(label)) between 1 and 60),
  vendor      text,
  code        text,
  item_name   text,
  sort_order  int not null default 0,
  suggested   boolean not null default false,     -- shown as a one-tap chip on a new estimate
  active      boolean not null default true,
  check (code is not null or item_name is not null)
);
create unique index estimate_accessories_key on public.estimate_accessories (company_id, key, coalesce(vendor, ''));

alter table public.estimate_accessories enable row level security;
create policy estimate_accessories_read on public.estimate_accessories for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy estimate_accessories_owner on public.estimate_accessories for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- 4. Special work types (a priced line each) and the client-view section they print under (by section order)
-- ---------------------------------------------------------------------
create table public.estimate_special_types (
  company_id    uuid not null references public.companies (id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9_]{2,30}$'),
  label         text not null,
  section_sort  int not null default 5,    -- quote_sections.sort_order (4 = Lighting & electrical, …)
  sort_order    int not null default 0,
  active        boolean not null default true,
  primary key (company_id, key)
);
alter table public.estimate_special_types enable row level security;
create policy estimate_special_types_read on public.estimate_special_types for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy estimate_special_types_owner on public.estimate_special_types for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- 5. The color picked on an estimate (the color group is quotes.collection_id, 0002)
-- ---------------------------------------------------------------------
alter table public.quotes add column if not exists color_code text check (color_code is null or length(color_code) <= 20);

-- ---------------------------------------------------------------------
-- 6. Defaults (idempotent), for new accounts and every account that exists now
-- ---------------------------------------------------------------------
create or replace function public.seed_estimate_v3(p_company uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cabinet_groups (company_id, key, label, sort_order) values
    (p_company, 'wall', 'Wall', 1), (p_company, 'base', 'Base', 2), (p_company, 'corner', 'Corner', 3),
    (p_company, 'pantry', 'Pantry', 4), (p_company, 'vanity', 'Vanity', 5), (p_company, 'accessories', 'Accessories', 6)
  on conflict do nothing;

  if not exists (select 1 from public.cabinet_group_rules where company_id = p_company) then
    insert into public.cabinet_group_rules (company_id, group_key, match_on, pattern, sort_order) values
      (p_company, 'skip',        'code',     '^(SD|MINI|SB15MINI|SPAINT)$', 10),
      (p_company, 'accessories', 'category', '^(Fillers & trim|Cabinet accessories|Hardware)$', 20),
      (p_company, 'accessories', 'code',     '^(F[0-9]|F1\.5|CM[0-9]|ACM|BCM|RCM|LRM|ALRM|OCM|SHM|SM[0-9]|COV|BAM|FBM|TK|BSV|WSV|USV|TSV|BDEP|WDEP|TDEP|VDEP|BEDP|WEDP|TEDP|DWR|REPV|REF|FPV|FPL|BP[0-9]|S[0-9]{4}|BSP[LR]|USP[LR]|VSP[LR]|WSP|CB[0-9]|CBT|CLDL|FLDL|SQDL|MCB|VA[0-9]|VAL|SGH|RS[0-9]|RT[0-9]|CHROME|WOOD TRAY|WASTE|TRASHCAN|TUK|PWB-BBC|WF[0-9]|BF[0-9]|TF[0-9]|QR[0-9]|FB[0-9]|FLS|LS-)', 30),
      (p_company, 'corner',      'code',     '^(BBC|WBC|DCW|WDC|WER|ERB|BER|AW[0-9]|BEC|CSB|DCSF|SBF[0-9]|LS[0-9]|BLS|DSB)', 40),
      (p_company, 'pantry',      'code',     '^(U[0-9]|O[0-9]|OC[0-9]|UT[0-9]|PC[0-9]|TP[0-9])', 50),
      (p_company, 'vanity',      'code',     '^(V|3VDB|ADA-V|ADA-3V|KD)', 60),
      (p_company, 'wall',        'code',     '^(W|MO[0-9]|PR[0-9]|FS[0-9]|OE|PWB-MOS)', 70),
      (p_company, 'base',        'code',     '^(B|SB|2DB|3DB|DFB|MB[0-9]|SPB|BWB|FSB|FHB|BT|ADA-|BSDC|BES)', 80),
      (p_company, 'base',        'category', '^Cabinets$', 99);
  end if;

  insert into public.estimate_accessories (company_id, key, label, vendor, code, item_name, sort_order, suggested) values
    (p_company, 'filler',     'Fillers',               'TimberPeak', 'WF342', null, 1, true),
    (p_company, 'filler',     'Fillers',               'Skyline',    'F342',  null, 1, true),
    (p_company, 'toe_kick',   'Toe kick',              'TimberPeak', 'TK8',   null, 2, true),
    (p_company, 'toe_kick',   'Toe kick',              'Skyline',    'TKC',   null, 2, true),
    (p_company, 'under_cab_lights', 'Under-cabinet lights (ft)', null, null,
       'LED tape light, 3000K dimmable (per ft, from 16 ft kit)', 3, false),
    (p_company, 'scribe',     'Scribe molding',        'TimberPeak', 'SM8',   null, 4, false),
    (p_company, 'scribe',     'Scribe molding',        'Skyline',    'SM8(SCR)', null, 4, false),
    (p_company, 'crown',      'Top (crown) molding',   'TimberPeak', 'CM8',   null, 5, true),
    (p_company, 'crown',      'Top (crown) molding',   'Skyline',    'CM8',   null, 5, true),
    (p_company, 'panel',      'Panels (end panel)',    'TimberPeak', 'BSV',   null, 6, false),
    (p_company, 'panel',      'Panels (end panel)',    'Skyline',    'BSV',   null, 6, false),
    (p_company, 'dw_panel',   'Dishwasher end panel',  'TimberPeak', 'DWR3',  null, 7, false),
    (p_company, 'dw_panel',   'Dishwasher end panel',  'Skyline',    'DWR3',  null, 7, false)
  on conflict do nothing;

  insert into public.estimate_special_types (company_id, key, label, section_sort, sort_order) values
    (p_company, 'electrical', 'Electrical', 4, 1),
    (p_company, 'gas',        'Gas',        3, 2),
    (p_company, 'plumbing',   'Plumbing',   3, 3),
    (p_company, 'flooring',   'Flooring',   5, 4),
    (p_company, 'other',      'Other',      5, 5)
  on conflict do nothing;
end $$;
revoke execute on function public.seed_estimate_v3(uuid) from public, anon, authenticated;
grant execute on function public.seed_estimate_v3(uuid) to service_role;

create or replace function private.companies_seed_estimate_v3() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_estimate_v3(new.id);
  return new;
end $$;
create trigger companies_zz_estimate_v3 after insert on public.companies
  for each row execute function private.companies_seed_estimate_v3();

do $$
declare c uuid;
begin
  for c in select id from public.companies loop
    perform public.seed_estimate_v3(c);
    perform public.sync_collection_colors(c);
  end loop;
end $$;
