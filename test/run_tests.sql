\set ON_ERROR_STOP 1
-- Supabase grants table privileges to authenticated by default; mirror that.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated;

insert into companies (id, name) values
  ('00000000-0000-0000-0000-00000000c001', 'Acme Kitchens'),
  ('00000000-0000-0000-0000-00000000c002', 'Other Co');
insert into users (id, clerk_id, company_id, name, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'user_admin',    '00000000-0000-0000-0000-00000000c001', 'Sales owner', 'owner'),
  ('00000000-0000-0000-0000-0000000000d1', 'user_designer', '00000000-0000-0000-0000-00000000c001', 'PM owner',    'owner'),
  ('00000000-0000-0000-0000-0000000000d2', 'user_team',     '00000000-0000-0000-0000-00000000c001', 'Office admin','team'),
  ('00000000-0000-0000-0000-0000000000f1', 'user_field',    '00000000-0000-0000-0000-00000000c001', 'Installer',   'crew'),
  ('00000000-0000-0000-0000-0000000000f2', 'user_field2',   '00000000-0000-0000-0000-00000000c001', 'Plumber',     'crew'),
  ('00000000-0000-0000-0000-0000000000b1', 'user_other',    '00000000-0000-0000-0000-00000000c002', 'Other',       'owner');
insert into deals (id, company_id, source, stage) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000c001', 'facebook', 'design_sent');

-- Seed as service role (onboarding path), twice to prove idempotency.
set role service_role;
select seed_default_estimating('00000000-0000-0000-0000-00000000c001');
select seed_default_estimating('00000000-0000-0000-0000-00000000c001');
select seed_default_estimating('00000000-0000-0000-0000-00000000c002');
reset role;

\echo '--- seed counts (company 1)'
select (select count(*) from quote_sections where company_id='00000000-0000-0000-0000-00000000c001') sections,
       (select count(*) from pick_phases     where company_id='00000000-0000-0000-0000-00000000c001') phases,
       (select count(*) from catalog_categories where company_id='00000000-0000-0000-0000-00000000c001') categories,
       (select count(*) from catalog_items   where company_id='00000000-0000-0000-0000-00000000c001') items,
       (select count(*) from quote_template_items where company_id='00000000-0000-0000-0000-00000000c001') template_items;

-- Act as the designer.
set role authenticated;
set request.jwt.claims = '{"sub":"user_designer"}';

select create_quote_from_template('00000000-0000-0000-0000-00000000e001',
  (select id from quote_templates limit 1)) as q1 \gset
\echo '--- quote 1 totals (generic placeholders + HD-priced parts + market quartz)'
select line_count, direct_cost_cents, contingency_cost_cents, tax_cost_cents, total_cost_cents,
       total_price_cents, gross_profit_cents, gross_margin
from quote_totals where quote_id = :'q1';

\echo '--- section totals'
select name, price_cents from quote_section_totals where quote_id = :'q1' order by sort_order;
select sum(price_cents) = (select total_price_cents from quote_totals where quote_id = :'q1') as sections_sum_to_total
from quote_section_totals where quote_id = :'q1';

\echo '--- margin override on faucet (pass-through at 10%) and labor-rate change flow through'
update quote_line_items set margin_override = 0.10 where quote_id = :'q1' and name like 'Faucet allowance%';
update quotes set labor_rate_cents = 6000 where id = :'q1';
select name, ext_cost_cents, price_cents, line_margin from quote_line_items_priced
where quote_id = :'q1' and (name like 'Faucet allowance%' or name = 'Cabinet install');
select total_price_cents, gross_margin, gross_margin < target_margin as below_target from quote_totals where quote_id = :'q1';


\echo '--- approve; then edits must be refused'
select total_price_cents from approve_quote(:'q1');
select status, approved_price_cents, approved_cost_cents from quotes where id = :'q1';
do $$ begin
  update quote_line_items set qty = 99 where quote_id = (select id from quotes where status='approved' limit 1);
  raise exception 'FAIL: edit on approved quote was allowed';
exception when check_violation then raise notice 'OK: line edit on approved quote refused';
end $$;
do $$ begin
  update quotes set target_margin = 0.20 where status = 'approved';
  raise exception 'FAIL: margin change on approved quote was allowed';
exception when check_violation then raise notice 'OK: margin change on approved quote refused';
end $$;

\echo '--- duplicate -> v2 is an editable draft with the same total'
select duplicate_quote(:'q1') as q2 \gset
select version, status, (select total_price_cents from quote_totals where quote_id = :'q2') total
from quotes where id = :'q2';

\echo '--- other company sees nothing'
set request.jwt.claims = '{"sub":"user_other"}';
select count(*) as other_co_visible_quotes from quotes where deal_id = '00000000-0000-0000-0000-00000000e001';

\echo '--- office admin (team) sees everything; cannot change settings'
set request.jwt.claims = '{"sub":"user_team"}';
select (select count(*) from quotes) quotes_visible, (select count(*) from quote_totals) totals_visible,
       (select count(*) from estimating_settings) settings_visible;
update estimating_settings set target_margin = 0.10;
select target_margin as margin_unchanged from estimating_settings where company_id = '00000000-0000-0000-0000-00000000c001';
\echo '--- crew cannot see quotes or costs'
set request.jwt.claims = '{"sub":"user_field"}';
select (select count(*) from quotes) quotes_visible, (select count(*) from catalog_items) catalog_visible,
       (select count(*) from quote_sections) section_names_visible;

\echo '--- convert to project (as admin)'
set request.jwt.claims = '{"sub":"user_admin"}';
reset role;
insert into projects (id, company_id, deal_id, name, project_manager_id)
values ('00000000-0000-0000-0000-0000000000b0', '00000000-0000-0000-0000-00000000c001',
        '00000000-0000-0000-0000-00000000e001', 'Smith kitchen', '00000000-0000-0000-0000-0000000000a1');
insert into tasks (project_id, title, assignee_id)
values ('00000000-0000-0000-0000-0000000000b0', 'Cabinet install', '00000000-0000-0000-0000-0000000000f1');
set role authenticated;
select materialize_quote_into_project(:'q1', '00000000-0000-0000-0000-0000000000b0');
select contract_value from projects;
select category, vendor, estimated_amount from costs order by category, vendor;
select sum(estimated_amount) = (select approved_cost_cents from quotes where id = :'q1') as costs_match_quote from costs;
select count(*) as materials, count(distinct pick_phase_id) as phases from project_materials;
do $$ begin
  perform materialize_quote_into_project((select id from quotes where status='approved' limit 1),
                                         '00000000-0000-0000-0000-0000000000b0');
  raise exception 'FAIL: double conversion allowed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'OK: double conversion refused (%)', sqlerrm;
end $$;

\echo '--- field crew: assigned user ticks packing, cannot change qty; unassigned user sees nothing'
set request.jwt.claims = '{"sub":"user_field"}';
update project_materials set packed = true where name like 'Composite shims%';
select name, packed, packed_by is not null as stamped_by, packed_at is not null as stamped_at
from project_materials where name like 'Composite shims%';
do $$ begin
  update project_materials set qty = 1 where name like 'Composite shims%';
  raise exception 'FAIL: field changed qty';
exception when insufficient_privilege then raise notice 'OK: field qty change refused';
end $$;
set request.jwt.claims = '{"sub":"user_field2"}';
select count(*) as unassigned_field_visible from project_materials;

\echo '--- pick list view for the crew'
set request.jwt.claims = '{"sub":"user_field"}';
select ph.name as phase, count(*) items
from project_materials m join pick_phases ph on ph.id = m.pick_phase_id
group by ph.name, ph.sort_order order by ph.sort_order;

-- =====================================================================
-- Vendor price list, color groups, quartz tiers, Home Depot comparison
-- =====================================================================
\echo '--- import TimberPeak MSRP list (as office admin)'
reset role;
set role authenticated;
set request.jwt.claims = '{"sub":"user_team"}';
\set company_id '00000000-0000-0000-0000-00000000c001'
\i /tmp/pkg/supabase/seed/timberpeak_msrp_2026.sql
select name, array_length(colors, 1) colors,
       (select count(*) from catalog_items ci where ci.collection_id = cc.id) items
from catalog_collections cc order by sort_order;

\echo '--- re-import is an upsert (same counts, nothing deactivated)'
\i /tmp/pkg/supabase/seed/timberpeak_msrp_2026.sql

\echo '--- quick estimate: template -> color group 1 -> quartz level 3'
select create_quote_from_template('00000000-0000-0000-0000-00000000e001',
  (select id from quote_templates limit 1), 'Quick estimate') as qe \gset
select status, count(*) from set_quote_collection(:'qe',
  (select id from catalog_collections where name like 'TimberPeak TSW%')) group by status;
\echo 'cabinets + fillers + trim at vendor cost (expect 307692 +/- per-item rounding)'
select sum(ext_cost_cents) as vendor_cabinet_cost_cents, sum(round(qty * list_price_cents))::bigint as msrp_cents
from quote_line_items_priced where quote_id = :'qe' and collection_id is not null;
do $$ declare v bigint; begin
  select sum(ext_cost_cents) into v from quote_line_items_priced
   where quote_id = (select id from quotes where name = 'Quick estimate') and collection_id is not null;
  if abs(v - 307692) > 10 then raise exception 'FAIL: vendor cost % <> 307692', v; end if;
  raise notice 'OK: 10x10 cabinets at TimberPeak group 1 cost = %', v;
end $$;

select swap_line_item(
  (select id from quote_line_items where quote_id = :'qe' and code = 'QZ2'),
  (select id from catalog_items where code = 'QZ3' and company_id = :'company_id'));
select code, qty, unit_price_cents, ext_cost_cents, price_cents, line_margin
from quote_line_items_priced where quote_id = :'qe' and code like 'QZ%';
select total_cost_cents, total_price_cents, gross_margin from quote_totals where quote_id = :'qe';

\echo '--- switching to group 4 (CWO) re-prices the same cabinets'
select count(*) filter (where status = 'swapped') swapped from set_quote_collection(:'qe',
  (select id from catalog_collections where name like 'TimberPeak CWO%'));
select sum(ext_cost_cents) as cwo_cabinet_cost_cents
from quote_line_items_priced where quote_id = :'qe' and collection_id is not null;
select count(*) filter (where status = 'swapped') swapped from set_quote_collection(:'qe',
  (select id from catalog_collections where name like 'TimberPeak TSW%'));

\echo '--- Home Depot comparison for the quick estimate'
select source_name, covered_lines, uncovered_lines, substitute_lines, unverified_lines,
       retailer_materials_cents, our_price_covered_cents, retailer_total_cents, our_total_price_cents, oldest_price_date
from quote_comparison_totals where quote_id = :'qe';
\echo 'Hampton Bay cabinet package before tax (expect 403355)'
select sum(packs * pack_price_cents) as hd_cabinets_pretax_cents
from quote_comparison_lines l join quote_line_items li on li.id = l.line_id
where l.quote_id = :'qe' and li.collection_id is not null and l.packs is not null;
do $$ declare v bigint; begin
  select sum(packs * pack_price_cents) into v from quote_comparison_lines l
    join quote_line_items li on li.id = l.line_id
   where l.quote_id = (select id from quotes where name = 'Quick estimate')
     and li.collection_id is not null and l.packs is not null;
  if v <> 403355 then raise exception 'FAIL: HD cabinet package % <> 403355', v; end if;
  raise notice 'OK: Hampton Bay package matches the research report ($4,033.55)';
end $$;
\echo 'lines Home Depot does not cover (never guessed)'
select name from quote_comparison_lines where quote_id = :'qe' and packs is null order by sort_order;

\echo '--- an actual Home Depot install quote can be added for this quote'
insert into comparison_adjustments (company_id, source_id, quote_id, label, amount_cents, verified, checked_on)
values (:'company_id', (select id from comparison_sources where company_id = :'company_id'), :'qe',
        'Home Depot install quote #TEST (example)', 1000000, true, date '2026-10-23');
select retailer_materials_cents, adjustments_cents, retailer_total_cents from quote_comparison_totals where quote_id = :'qe';

\echo '--- crew cannot read price lists or comparisons'
set request.jwt.claims = '{"sub":"user_field"}';
select (select count(*) from price_lists) price_lists, (select count(*) from comparison_prices) hd_prices,
       (select count(*) from quote_comparison_totals) comparisons;
