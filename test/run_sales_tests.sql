\set ON_ERROR_STOP 1
reset role;
reset request.jwt.claims;
\set c1 '00000000-0000-0000-0000-00000000c001'
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
select seed_default_handoff(:'c1');
select seed_default_handoff(:'c1');

-- RenoDesign = partner; Crystal logs in as role 'partner'
insert into partners (id, company_id, name, contact_name, license_class) values
  ('00000000-0000-0000-0000-0000000000aa', :'c1', 'RenoDesign Inc.', 'Crystal', 'B'),
  ('00000000-0000-0000-0000-0000000000ab', :'c1', 'Other Contractor LLC', 'Sam', 'A');
insert into commission_plans (id, company_id, partner_id, name, basis, rate, first_payout_pct, min_cents) values
  ('00000000-0000-0000-0000-0000000000c1', :'c1', '00000000-0000-0000-0000-0000000000aa', 'Kitchens', 'contract_price', 0.05, 0.5, 0),
  ('00000000-0000-0000-0000-0000000000c2', :'c1', '00000000-0000-0000-0000-0000000000aa', 'Cabinets only', 'contract_price', 0.08, 1.0, 25000),
  ('00000000-0000-0000-0000-0000000000c3', :'c1', '00000000-0000-0000-0000-0000000000ab', 'Other kitchens', 'contract_price', 0.06, 0.5, 0);
insert into users (id, clerk_id, company_id, name, role, partner_id) values
  ('00000000-0000-0000-0000-0000000000a9', 'user_crystal', :'c1', 'Crystal', 'partner', '00000000-0000-0000-0000-0000000000aa');

insert into deals (id, company_id, source, stage, year_built) values
  ('00000000-0000-0000-0000-00000000e003', :'c1', 'facebook', 'visit_done', 1999),   -- kitchen
  ('00000000-0000-0000-0000-00000000e004', :'c1', 'marketplace', 'visit_done', 2005), -- cabinets only
  ('00000000-0000-0000-0000-00000000e005', :'c1', 'referral', 'visit_done', 2010),    -- will cancel
  ('00000000-0000-0000-0000-00000000e006', :'c1', 'google', 'visit_done', 2012);      -- other partner

\echo '--- hand-off needs partner + plan, then the hand-off checklist'
do $$ begin
  update deals set handed_off_at = now() where id = '00000000-0000-0000-0000-00000000e003';
  raise exception 'FAIL: handed off without partner';
exception when check_violation then raise notice 'OK: % ', sqlerrm;
end $$;
do $$ begin
  update deals set partner_id = '00000000-0000-0000-0000-0000000000ab', commission_plan_id = '00000000-0000-0000-0000-0000000000c1'
  where id = '00000000-0000-0000-0000-00000000e003';
  raise exception 'FAIL: plan from another partner accepted';
exception when check_violation then raise notice 'OK: % ', sqlerrm;
end $$;
do $$ begin
  update deals set partner_id = '00000000-0000-0000-0000-0000000000aa', commission_plan_id = '00000000-0000-0000-0000-0000000000c1',
                   handed_off_at = now() where id = '00000000-0000-0000-0000-00000000e003';
  raise exception 'FAIL: handed off without photos/measurements';
exception when check_violation then raise notice 'OK: % ', sqlerrm;
end $$;

-- file the required hand-off items for all four deals
insert into deal_files (deal_id, folder, storage_path, mime_type, size_bytes, requirement_id)
select d.id, r.folder, d.company_id || '/' || d.deal_year || '/' || d.deal_number || '/' || r.folder || '/' || r.id || '.jpg',
       'image/jpeg', 100, r.id
from deals d cross join document_requirements r
where d.id in ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000e004',
               '00000000-0000-0000-0000-00000000e005','00000000-0000-0000-0000-00000000e006')
  and r.company_id = d.company_id and r.gate = 'before_handoff' and r.required;

update deals set partner_id = '00000000-0000-0000-0000-0000000000aa', commission_plan_id = '00000000-0000-0000-0000-0000000000c1', handed_off_at = now()
where id in ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000e005');
update deals set partner_id = '00000000-0000-0000-0000-0000000000aa', commission_plan_id = '00000000-0000-0000-0000-0000000000c2', handed_off_at = now()
where id = '00000000-0000-0000-0000-00000000e004';
update deals set partner_id = '00000000-0000-0000-0000-0000000000ab', commission_plan_id = '00000000-0000-0000-0000-0000000000c3', handed_off_at = now()
where id = '00000000-0000-0000-0000-00000000e006';
\echo 'OK: handed off after the checklist'

\echo '--- Crystal (partner login) sees only RenoDesign deals that were handed off'
set role authenticated;
set request.jwt.claims = '{"sub":"user_crystal"}';
do $$
declare n int; other int; plans int;
begin
  select count(*) into n from deals;
  select count(*) into other from deals where id = '00000000-0000-0000-0000-00000000e006';
  select count(*) into plans from commission_plans;
  if n <> 3 or other <> 0 or plans <> 2 then raise exception 'FAIL: partner sees % deals, other=% plans=%', n, other, plans; end if;
  raise notice 'OK: partner sees % deals (not the other contractor''s), % plans', n, plans;
end $$;
select count(*) as partner_sees_expenses from business_expenses;

-- she reports progress: kitchen sold $38,500 + deposit; cabinets $4,200 + deposit; one cancelled
update deals set sold_price_cents = 3850000, job_status = 'signed', deposit_received_at = now()
where id = '00000000-0000-0000-0000-00000000e003';
update deals set sold_price_cents = 420000, job_status = 'ordered', deposit_received_at = now()
where id = '00000000-0000-0000-0000-00000000e004';
update deals set job_status = 'cancelled' where id = '00000000-0000-0000-0000-00000000e005';
do $$ begin
  update deals set stage = 'won', partner_id = null where id = '00000000-0000-0000-0000-00000000e003';
  raise exception 'FAIL: partner changed sales fields';
exception when insufficient_privilege then raise notice 'OK: % ', sqlerrm;
end $$;
do $$ begin
  insert into commission_payments (company_id, deal_id, amount_cents, paid_on)
  values ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000e003', 1, current_date);
  raise exception 'FAIL: partner recorded a commission payment';
exception when insufficient_privilege then raise notice 'OK: partner cannot record commission payments (rep confirms receipt)';
end $$;
reset role;

\echo '--- commissions'
set role authenticated;
set request.jwt.claims = '{"sub":"user_admin"}';
select deal_number, plan_name, contract_total_cents, commission_cents, earned_cents, paid_cents, owed_cents, expected_cents, commission_status
from deal_commissions order by deal_number;
do $$
declare got text;
begin
  select string_agg(plan_name || ':' || commission_cents || '/' || earned_cents || '/' || owed_cents || '/' || commission_status, ' ' order by deal_number)
  into got from deal_commissions where deal_id in ('00000000-0000-0000-0000-00000000e003','00000000-0000-0000-0000-00000000e004','00000000-0000-0000-0000-00000000e005');
  -- kitchen 5% of 38,500 = 1,925.00; half earned at deposit. Cabinets 8% of 4,200 = 336 (> 250 floor), all at deposit. Cancelled = 0.
  if got <> 'Kitchens:192500/96250/96250/owed Cabinets only:33600/33600/33600/owed Kitchens:0/0/0/cancelled' then
    raise exception 'FAIL: %', got;
  end if;
  raise notice 'OK: %', got;
end $$;

-- rep receives the first half; client pays in full after a $1,500 change order
insert into commission_payments (company_id, deal_id, amount_cents, paid_on, method, reference)
values (:'c1', '00000000-0000-0000-0000-00000000e003', 96250, current_date, 'zelle', 'ZL-1');
reset role;
update deals set change_orders_cents = 150000, paid_in_full_at = now(), job_status = 'completed'
where id = '00000000-0000-0000-0000-00000000e003';
set role authenticated;
set request.jwt.claims = '{"sub":"user_admin"}';
do $$
declare r record;
begin
  select * into r from deal_commissions where deal_id = '00000000-0000-0000-0000-00000000e003';
  -- 5% of 40,000 = 2,000.00 total; 962.50 paid; 1,037.50 owed
  if r.commission_cents <> 200000 or r.earned_cents <> 200000 or r.owed_cents <> 103750 or r.commission_status <> 'owed' then
    raise exception 'FAIL: % % % %', r.commission_cents, r.earned_cents, r.owed_cents, r.commission_status;
  end if;
  raise notice 'OK: after change order + final payment: commission 2000.00, owed 1037.50';
end $$;

\echo '--- small cabinet job hits the $250 floor'
reset role;
update deals set sold_price_cents = 180000 where id = '00000000-0000-0000-0000-00000000e004';
do $$ begin
  if (select commission_cents from deal_commissions where deal_id = '00000000-0000-0000-0000-00000000e004') <> 25000 then
    raise exception 'FAIL: floor';
  end if;
  raise notice 'OK: 8%% of $1,800 = $144 → floor $250';
end $$;

\echo '--- my money: expenses + mileage + year summary'
set role authenticated;
set request.jwt.claims = '{"sub":"user_admin"}';
insert into business_expenses (company_id, spent_on, amount_cents, category, vendor) values
  (:'c1', current_date, 4999, 'marketing', 'Facebook'), (:'c1', current_date, 2500, 'samples', 'TimberPeak door samples');
insert into mileage_trips (company_id, trip_on, miles, purpose, deal_id) values
  (:'c1', current_date, 42.5, 'Site visit', '00000000-0000-0000-0000-00000000e003');
select * from rep_year_summary(extract(year from current_date)::int, 70);
do $$
declare r record;
begin
  select * into r from rep_year_summary(extract(year from current_date)::int, 70);
  -- paid 962.50; expenses 74.99; 42.5 mi × 70¢ = 29.75; net 857.76
  if r.commissions_paid_cents <> 96250 or r.expenses_cents <> 7499 or r.mileage_deduction_cents <> 2975 or r.net_cents <> 85776 then
    raise exception 'FAIL: %', r;
  end if;
  raise notice 'OK: year summary paid 962.50, expenses 74.99, mileage 29.75, net 857.76, owed %', r.commissions_owed_cents;
end $$;
reset role;
do $$ begin
  if (select handed_off from lead_source_stats where source = 'facebook' and company_id = '00000000-0000-0000-0000-00000000c001' and deal_year = 2026) < 1
     or (select commission_paid_cents from lead_source_stats where source = 'facebook' and company_id = '00000000-0000-0000-0000-00000000c001' and deal_year = 2026) <> 96250 then
    raise exception 'FAIL: lead source stats';
  end if;
  raise notice 'OK: facebook leads → handed off + commission paid 962.50';
end $$;
