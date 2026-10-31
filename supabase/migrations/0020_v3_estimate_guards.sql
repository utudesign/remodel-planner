-- =====================================================================
-- 0020_v3_estimate_guards.sql — review fixes for batch C (0019)
--   1. Locked estimates stay locked in the database: no line changes on archived or deleted estimates
--      (0002 only covered approved / superseded; 0017 missed DELETE), and an approved, superseded,
--      archived or deleted estimate keeps its color group + color.
--   2. pick_quote_color(): one transaction for "pick a color" — re-price by code, save the color, and move
--      accessory quantities to the new brand's item (TimberPeak WF342 ↔ Skyline F342). Replaces 4+ calls.
--   3. Grants: sync_collection_colors() is service-role only; cabinet_group_of() runs as the caller, not anon.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Locks
-- ---------------------------------------------------------------------
create or replace function public.quote_lines_locked_guard()
returns trigger language plpgsql set search_path = public as $$
declare q record;
begin
  select deleted_at, archived_at into q from public.quotes where id = coalesce(new.quote_id, old.quote_id);
  if found and q.deleted_at is not null then
    raise exception 'This estimate was deleted' using errcode = 'check_violation';
  end if;
  if found and q.archived_at is not null then
    raise exception 'This estimate is archived: restore it to change it' using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
create trigger quote_lines_locked before insert or update or delete on public.quote_line_items
  for each row execute function public.quote_lines_locked_guard();

create or replace function public.quotes_color_lock()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.collection_id, new.color_code) is distinct from (old.collection_id, old.color_code)
     and (old.status in ('approved', 'superseded') or old.deleted_at is not null or old.archived_at is not null) then
    raise exception 'This estimate is locked: duplicate it to change the color' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger quotes_color_lock before update on public.quotes
  for each row execute function public.quotes_color_lock();

-- ---------------------------------------------------------------------
-- 2. Pick a color, atomically
-- ---------------------------------------------------------------------
-- The price-list item an accessory means for a brand + color group (same rule as lib/estimating/builder-steps.ts):
-- the brand's row for that key (else the "every brand" row) → its code in the color group, else a generic item with
-- that code, else the generic item with that name.
create or replace function public.accessory_item(p_company uuid, p_key text, p_vendor text, p_collection uuid)
returns uuid language sql stable security invoker set search_path = public as $$
  with acc as (
    select a.code, a.item_name
      from public.estimate_accessories a
     where a.company_id = p_company and a.key = p_key and a.active
       and (a.vendor is null or a.vendor = p_vendor)
     order by (a.vendor is null), a.sort_order
     limit 1)
  select coalesce(
    (select ci.id from acc join public.catalog_items ci
        on ci.company_id = p_company and ci.active and upper(ci.code) = upper(acc.code) and ci.collection_id = p_collection
      limit 1),
    (select ci.id from acc join public.catalog_items ci
        on ci.company_id = p_company and ci.active and upper(ci.code) = upper(acc.code) and ci.collection_id is null
      limit 1),
    (select ci.id from acc join public.catalog_items ci
        on ci.company_id = p_company and ci.active and ci.name = acc.item_name and ci.collection_id is null
      limit 1))
$$;

-- Copy a price-list item into an estimate (same columns as server/actions/estimates.ts insertCatalogLine).
create or replace function public.add_quote_item(p_quote uuid, p_item uuid, p_qty numeric)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_line uuid;
begin
  select id into v_line from public.quote_line_items where quote_id = p_quote and catalog_item_id = p_item
   order by sort_order limit 1;
  if v_line is not null then
    update public.quote_line_items set qty = qty + p_qty where id = v_line;
    return v_line;
  end if;
  insert into public.quote_line_items
    (company_id, quote_id, section_id, category_id, pick_phase_id, catalog_item_id, cost_category, code, name, qty, unit,
     unit_cost_cents, uses_labor_rate, taxable, is_allowance, vendor, qty_source, note, sort_order, pricing_mode,
     unit_price_cents, list_price_cents, collection_id)
  select q.company_id, q.id, coalesce(ci.section_id, cc.default_section_id), ci.category_id, cc.default_pick_phase_id, ci.id,
         coalesce(ci.cost_category, cc.cost_category), ci.code, ci.name, p_qty, ci.unit, ci.unit_cost_cents, ci.uses_labor_rate,
         ci.taxable, ci.is_allowance, ci.vendor, ci.qty_source, ci.notes,
         coalesce((select max(sort_order) from public.quote_line_items where quote_id = q.id), 0) + 1,
         ci.pricing_mode, ci.unit_price_cents, ci.list_price_cents, ci.collection_id
    from public.quotes q
    join public.catalog_items ci on ci.id = p_item and ci.company_id = q.company_id
    join public.catalog_categories cc on cc.id = ci.category_id
   where q.id = p_quote
  returning id into v_id;
  if v_id is null then raise exception 'Price-list item not found for this estimate'; end if;
  return v_id;
end $$;

-- Returns what happened per code: 'swapped' (re-priced), 'moved' (accessory now the new brand's item),
-- 'missing in color group' (a cabinet this color doesn't make).
create or replace function public.pick_quote_color(p_quote_id uuid, p_color_id uuid)
returns table (code text, status text)
language plpgsql security invoker set search_path = public as $$
declare
  q public.quotes%rowtype;
  c public.catalog_colors%rowtype;
  v_old_vendor text;
  v_new_vendor text;
  k record;
  v_new uuid;
  v_moved text[] := '{}';
  v_before jsonb;
  v_swap jsonb;
begin
  if not public.is_team() then
    raise exception 'Only owners or team members can change estimates' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id and company_id = public.current_company_id() for update;
  if not found then raise exception 'Estimate not found'; end if;
  if q.deleted_at is not null or q.archived_at is not null or q.status in ('approved', 'superseded') then
    raise exception 'This estimate is locked: duplicate it to change the color' using errcode = 'check_violation';
  end if;
  select * into c from public.catalog_colors where id = p_color_id and company_id = q.company_id and active;
  if not found then raise exception 'Color not found'; end if;

  select pl.vendor into v_old_vendor from public.catalog_collections cc join public.price_lists pl on pl.id = cc.price_list_id
   where cc.id = q.collection_id;
  select pl.vendor into v_new_vendor from public.price_lists pl where pl.id = c.price_list_id;

  -- Accessory quantities before the switch, by key.
  select coalesce(jsonb_agg(jsonb_build_object('key', x.key, 'item', x.item, 'qty', x.qty, 'code', x.code)), '[]')
    into v_before
    from (select a.key, i.item, coalesce(sum(li.qty), 0) as qty, max(li.code) as code
            from (select distinct key from public.estimate_accessories where company_id = q.company_id and active) a
            cross join lateral (select public.accessory_item(q.company_id, a.key, v_old_vendor, q.collection_id) as item) i
            left join public.quote_line_items li on li.quote_id = q.id and li.catalog_item_id = i.item
           where i.item is not null
           group by a.key, i.item) x;

  -- Re-price every line whose code exists in the new color group (0002), then save the color.
  select coalesce(jsonb_agg(jsonb_build_object('code', r.code, 'status', r.status)), '[]')
    into v_swap
    from public.set_quote_collection(q.id, c.collection_id) r;
  update public.quotes set color_code = c.code where id = q.id;

  -- Accessories whose old item wasn't re-priced by code: move the qty to the new brand's item.
  for k in select * from jsonb_to_recordset(v_before) as t(key text, item uuid, qty numeric, code text) where t.qty > 0 loop
    if not exists (select 1 from public.quote_line_items where quote_id = q.id and catalog_item_id = k.item) then
      continue;  -- re-priced by code above (CM8, BSV, DWR3 exist in both brands)
    end if;
    v_new := public.accessory_item(q.company_id, k.key, v_new_vendor, c.collection_id);
    if v_new is null or v_new = k.item then continue; end if;
    delete from public.quote_line_items where quote_id = q.id and catalog_item_id = k.item;
    perform public.add_quote_item(q.id, v_new, k.qty);
    v_moved := v_moved || k.code;
  end loop;

  return query
    select r.code, r.status from jsonb_to_recordset(v_swap) as r(code text, status text) where not (r.code = any (v_moved))
    union all
    select m, 'moved'::text from unnest(v_moved) m;
end $$;
revoke execute on function public.accessory_item(uuid, text, text, uuid) from public, anon;
revoke execute on function public.add_quote_item(uuid, uuid, numeric) from public, anon;
revoke execute on function public.pick_quote_color(uuid, uuid) from public, anon;
grant execute on function public.accessory_item(uuid, text, text, uuid) to authenticated;
grant execute on function public.add_quote_item(uuid, uuid, numeric) to authenticated;
grant execute on function public.pick_quote_color(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------
-- Only the server (service role) fills TimberPeak's color rows; a signed-in user could otherwise pass any company id.
revoke execute on function public.sync_collection_colors(uuid) from authenticated;

-- Runs as the caller: the rules' RLS (team reads own company) applies; anon can't call it.
create or replace function public.cabinet_group_of(p_company uuid, p_code text, p_category text)
returns text language sql stable security invoker set search_path = public as $$
  select r.group_key
    from public.cabinet_group_rules r
   where r.company_id = p_company and r.active
     and case r.match_on when 'code' then coalesce(p_code, '') ~* r.pattern
                         else coalesce(p_category, '') ~* r.pattern end
   order by r.sort_order, r.id
   limit 1
$$;
revoke execute on function public.cabinet_group_of(uuid, text, text) from public, anon;
grant execute on function public.cabinet_group_of(uuid, text, text) to authenticated, service_role;
