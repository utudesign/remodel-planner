\set ON_ERROR_STOP 1
reset role;
reset request.jwt.claims;
\set c1 '00000000-0000-0000-0000-00000000c001'
grant select, insert, update on all tables in schema public to authenticated;
select seed_default_compliance(:'c1');
select seed_default_compliance(:'c1');  -- idempotent

\echo '--- 3-day cancellation deadline (Sundays + FTC holidays skipped, midnight Eastern)'
do $$
declare got text;
begin
  select string_agg(to_char(cancellation_deadline(t) at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI'), ' ' order by t) into got
  from unnest(array[
    timestamptz '2026-10-23 10:00-04',  -- Fri → Sat, Mon, Tue → ends midnight Tue night
    timestamptz '2026-11-07 15:00-05',  -- Sat → Mon 9, Tue 10, (Wed 11 Veterans Day), Thu 12
    timestamptz '2026-11-24 19:00-05',  -- Tue → Wed 25, (Thu 26 Thanksgiving), Fri 27, Sat 28
    timestamptz '2026-12-31 23:30-05'   -- Thu night → (Fri Jan 1 holiday), Sat 2, Mon 4, Tue 5
  ]) t;
  if got <> '2026-10-28 00:00 2026-11-13 00:00 2026-11-29 00:00 2027-01-06 00:00' then
    raise exception 'FAIL: deadlines %', got;
  end if;
  raise notice 'OK: deadlines %', got;
end $$;

\echo '--- a new in-home sale'
insert into deals (id, company_id, source, stage, created_at, first_response_at, year_built)
values ('00000000-0000-0000-0000-00000000e002', :'c1', 'google_lsa', 'new', now() - interval '20 days', now() - interval '20 days' + interval '3 minutes', 1972);
insert into projects (id, company_id, deal_id, name)
values ('00000000-0000-0000-0000-0000000000b2', :'c1', '00000000-0000-0000-0000-00000000e002', 'Park kitchen');

do $$ begin
  insert into payments (project_id, label, amount, received_at, status)
  values ('00000000-0000-0000-0000-0000000000b2', 'Deposit', 400000, now(), 'received');
  raise exception 'FAIL: payment before contract';
exception when check_violation then raise notice 'OK: no payment before a signed contract';
end $$;

update deals set contract_signed_at = now() - interval '1 hour' where id = '00000000-0000-0000-0000-00000000e002';
select deal_number, cancel_deadline is not null as has_deadline from deals where id = '00000000-0000-0000-0000-00000000e002';

insert into payments (project_id, label, amount, received_at, status)
values ('00000000-0000-0000-0000-0000000000b2', 'Deposit', 400000, now(), 'received');
do $$
declare r text; n text;
begin
  select receipt_number into r from payments where project_id = '00000000-0000-0000-0000-0000000000b2';
  select deal_number into n from deals where id = '00000000-0000-0000-0000-00000000e002';
  if r <> n || '-R1' then raise exception 'FAIL: receipt %', r; end if;
  raise notice 'OK: deposit receipt %', r;
end $$;

\echo '--- pre-1978 house: lead-safe items appear; order blocked inside the 3 days'
do $$
declare got text;
begin
  select string_agg(label, ' | ' order by gate, sort_order) into got from deal_jacket_checklist
  where deal_id = '00000000-0000-0000-0000-00000000e002' and label ~ 'Renovate|Lead-safe|cancellation';
  if got is null or got !~ 'Renovate' or got !~ 'cancellation' then raise exception 'FAIL: checklist %', got; end if;
  raise notice 'OK: % ', got;
end $$;

-- satisfy every before_order document so only the 3-day rule is left
insert into deal_files (deal_id, folder, storage_path, mime_type, size_bytes, requirement_id)
select '00000000-0000-0000-0000-00000000e002', r.folder,
       '00000000-0000-0000-0000-00000000c001/' || d.deal_year || '/' || d.deal_number || '/' || r.folder || '/' || r.id || '.pdf',
       'application/pdf', 100, r.id
from document_requirements r, deals d
where d.id = '00000000-0000-0000-0000-00000000e002' and r.company_id = d.company_id and r.gate = 'before_order';

do $$ begin
  update projects set order_date = current_date where id = '00000000-0000-0000-0000-0000000000b2';
  raise exception 'FAIL: ordered inside the cancellation period';
exception when check_violation then raise notice 'OK: % ', sqlerrm;
end $$;

update deals set contract_signed_at = now() - interval '8 days' where id = '00000000-0000-0000-0000-00000000e002';
update projects set order_date = current_date where id = '00000000-0000-0000-0000-0000000000b2';
\echo 'OK-ish: ordered after the window:'
select order_date is not null as ordered from projects where id = '00000000-0000-0000-0000-0000000000b2';

\echo '--- start gate: pre-1978 needs the Renovate Right receipt'
do $$ begin
  update projects set start_date = current_date + 7 where id = '00000000-0000-0000-0000-0000000000b2';
  raise exception 'FAIL: started without lead-safe papers';
exception when check_violation then
  if sqlerrm !~ 'Renovate Right' then raise exception 'FAIL: wrong message %', sqlerrm; end if;
  raise notice 'OK: % ', sqlerrm;
end $$;
update deals set year_built = 1995 where id = '00000000-0000-0000-0000-00000000e002';
do $$ begin
  update projects set start_date = current_date + 7 where id = '00000000-0000-0000-0000-0000000000b2';
  raise exception 'FAIL: start allowed without before photos/delivery inspection';
exception when check_violation then
  if sqlerrm ~ 'Renovate' then raise exception 'FAIL: 1995 house still asks for lead-safe'; end if;
  raise notice 'OK: 1995 house only needs: % ', sqlerrm;
end $$;

\echo '--- change orders: numbered, signed before approved, frozen after'
insert into change_orders (project_id, description, price_change, cost_change)
values ('00000000-0000-0000-0000-0000000000b2', 'Add pantry pull-out', 85000, 52000),
       ('00000000-0000-0000-0000-0000000000b2', 'Upgrade faucet', 32000, 21000);
do $$ begin
  update change_orders set approved_at = now() where project_id = '00000000-0000-0000-0000-0000000000b2' and description = 'Add pantry pull-out';
  raise exception 'FAIL: approved unsigned change order';
exception when check_violation then raise notice 'OK: % ', sqlerrm;
end $$;
update change_orders set client_signed_at = now(), approved_at = now() where project_id = '00000000-0000-0000-0000-0000000000b2' and description = 'Add pantry pull-out';
do $$ begin
  update change_orders set price_change = 1 where project_id = '00000000-0000-0000-0000-0000000000b2' and description = 'Add pantry pull-out';
  raise exception 'FAIL: edited approved change order';
exception when check_violation then raise notice 'OK: approved change orders are frozen';
end $$;
do $$
declare got text;
begin
  select string_agg(doc_number, ' ' order by doc_number) into got from change_orders where project_id = '00000000-0000-0000-0000-0000000000b2';
  if got !~ '^\d\d-\d{4}-CO1 \d\d-\d{4}-CO2$' then raise exception 'FAIL: %', got; end if;
  raise notice 'OK: change orders %', got;
end $$;

\echo '--- subs, warranty, lead sources'
insert into subcontractors (company_id, name, trade, license_class, license_expires, gl_coi_expires, wc_coi_expires, w9_on_file) values
  (:'c1', 'Ace Plumbing', 'plumbing', 'trade', current_date + 200, current_date + 10, current_date + 300, true),
  (:'c1', 'Volt Electric', 'electrical', 'trade', current_date + 200, current_date + 200, current_date - 1, true),
  (:'c1', 'New installer', 'install', 'none', null, null, null, false);
do $$
declare got text;
begin
  select string_agg(name || '=' || status, ', ' order by name) into got from subcontractor_compliance;
  if got <> 'Ace Plumbing=expiring, New installer=missing, Volt Electric=expired' then raise exception 'FAIL: %', got; end if;
  raise notice 'OK: subs %', got;
end $$;
update projects set substantial_completion_on = '2026-11-20' where id = '00000000-0000-0000-0000-0000000000b2';
do $$ begin
  if (select warranty_ends_on from deal_warranty where project_id = '00000000-0000-0000-0000-0000000000b2') <> '2027-11-20'
     or (select check_in_on from deal_warranty where project_id = '00000000-0000-0000-0000-0000000000b2') <> '2027-10-21' then
    raise exception 'FAIL: warranty dates';
  end if;
  raise notice 'OK: warranty ends 2027-11-20, check-in 2027-10-21';
end $$;
select source, leads, answered_5_min, won from lead_source_stats where company_id = :'c1' and source = 'google_lsa';

\echo '--- crew cannot see subs'
set role authenticated;
set request.jwt.claims = '{"sub":"user_field"}';
select count(*) as subs_visible_to_crew from subcontractors;
reset role;
