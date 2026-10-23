\set ON_ERROR_STOP 1
reset role;
reset request.jwt.claims;
\set c1 '00000000-0000-0000-0000-00000000c001'
\set c2 '00000000-0000-0000-0000-00000000c002'
grant select, insert, update on all tables in schema public to authenticated;

-- =====================================================================
-- Deal numbers
-- =====================================================================
\echo '--- deal numbers: YY-NNNN, per company, per year (company time zone), start 1001'
insert into deals (company_id, source, stage, created_at) values
  (:'c1', 'referral', 'new', '2026-01-05 10:00-05'),
  (:'c1', 'facebook', 'new', '2026-03-14 09:00-04'),
  (:'c1', 'call',     'new', '2026-03-14 12:00-04'),
  (:'c2', 'facebook', 'new', '2026-03-14 10:00-04'),   -- other company: its own series
  (:'c1', 'text',     'new', '2026-12-31 23:30-05'),   -- 04:30 UTC Jan 1, still 2026 in Virginia
  (:'c1', 'referral', 'new', '2027-01-01 00:10-05');   -- new year restarts
select deal_year, deal_number, deal_seq, opened_on, (company_id = :'c2') as other_company
from deals where created_at < '2026-10-01' or created_at > '2026-12-01' order by company_id, created_at;

do $$
declare got text; other text;
begin
  select string_agg(deal_number || '@' || opened_on, ' ' order by created_at) into got
  from deals where company_id = '00000000-0000-0000-0000-00000000c001'
   and (created_at < '2026-10-01' or created_at > '2026-12-01');
  -- 26-1001 went to the test deal created by run_tests.sql; numbers follow insert order
  if got <> '26-1002@2026-01-05 26-1003@2026-03-14 26-1004@2026-03-14 26-1005@2026-12-31 27-1001@2027-01-01' then
    raise exception 'FAIL: deal numbers were %', got;
  end if;
  select deal_number into other from deals where company_id = '00000000-0000-0000-0000-00000000c002';
  if other <> '26-1001' then raise exception 'FAIL: other company got %', other; end if;
  raise notice 'OK: deal numbers %; other company %', got, other;
end $$;

\echo '--- 50 deals at the same instant: 50 distinct consecutive numbers'
insert into deals (company_id, source, stage, created_at)
select :'c1', 'call', 'new', timestamptz '2026-03-20 09:00-04' from generate_series(1, 50);
do $$
declare n int; lo int; hi int;
begin
  select count(distinct deal_number), min(deal_seq), max(deal_seq) into n, lo, hi
  from deals where company_id = '00000000-0000-0000-0000-00000000c001' and created_at = '2026-03-20 09:00-04';
  if n <> 50 or hi - lo <> 49 then raise exception 'FAIL: % numbers, % to %', n, lo, hi; end if;
  raise notice 'OK: 50 numbers 26-% to 26-%', lo, hi;
end $$;

\echo '--- the number column sorts in creation order (lpad), and the year start is configurable'
update companies set deal_number_start = 5001 where id = :'c2';
insert into deals (company_id, source, stage, created_at) values (:'c2', 'call', 'new', '2027-02-01 10:00-05');
select deal_number as c2_2027_first from deals where company_id = :'c2' and deal_year = 2027;
do $$ begin
  if (select deal_number from deals where company_id = '00000000-0000-0000-0000-00000000c002' and deal_year = 2027) <> '27-5001' then
    raise exception 'FAIL: start setting ignored';
  end if;
  raise notice 'OK: configurable start 27-5001';
end $$;

do $$ begin
  update deals set deal_number = '26-9999' where deal_number = '26-1002';
  raise exception 'FAIL: deal number was changed';
exception when check_violation then raise notice 'OK: deal numbers cannot be edited';
end $$;

do $$ begin
  perform * from deal_number_counters;
  raise notice 'OK: service role can read counters (expected)';
end $$;
set role authenticated;
set request.jwt.claims = '{"sub":"user_team"}';
select count(*) as counters_visible_to_app_users from deal_number_counters;
reset role;

-- =====================================================================
-- Deal jacket
-- =====================================================================
select seed_default_deal_jacket(:'c1');
select seed_default_deal_jacket(:'c1');  -- idempotent
select count(*) as requirements from document_requirements where company_id = :'c1';

-- the test deal from run_tests.sql (has project b0; crew user_field has a task on it)
select id as d1, deal_year as y1, deal_number as n1 from deals where id = '00000000-0000-0000-0000-00000000e001' \gset
\echo 'test deal number:' :n1
\set base :c1/:y1/:n1

set role authenticated;
set request.jwt.claims = '{"sub":"user_team"}';

\echo '--- document numbers inside a deal: {deal}-CO1, -CO2, -R1'
do $$
declare a text; b text; c text; n text;
begin
  select deal_number into n from deals where id = '00000000-0000-0000-0000-00000000e001';
  a := next_deal_doc_number('00000000-0000-0000-0000-00000000e001', 'CO');
  b := next_deal_doc_number('00000000-0000-0000-0000-00000000e001', 'CO');
  c := next_deal_doc_number('00000000-0000-0000-0000-00000000e001', 'R');
  if a <> n || '-CO1' or b <> n || '-CO2' or c <> n || '-R1' then
    raise exception 'FAIL: doc numbers % % %', a, b, c;
  end if;
  raise notice 'OK: doc numbers % % %', a, b, c;
end $$;
set request.jwt.claims = '{"sub":"user_field"}';
do $$ begin
  perform next_deal_doc_number('00000000-0000-0000-0000-00000000e001', 'CO');
  raise exception 'FAIL: crew numbered a document';
exception when insufficient_privilege then raise notice 'OK: crew cannot create document numbers';
end $$;
set request.jwt.claims = '{"sub":"user_team"}';

\echo '--- files must live under {company}/{year}/{deal}/{folder}/'
do $$ begin
  insert into deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
  values ('00000000-0000-0000-0000-00000000e001', 'photos', 'somewhere/else.jpg', 'image/jpeg', 1000);
  raise exception 'FAIL: bad path accepted';
exception when check_violation then raise notice 'OK: wrong storage path refused';
end $$;

\echo '--- order gate: cannot set order_date until contract, design and deposit are in the jacket'
do $$ begin
  update projects set order_date = '2026-10-26' where id = '00000000-0000-0000-0000-0000000000b0';
  raise exception 'FAIL: ordered without paperwork';
exception when check_violation then raise notice 'OK: %', sqlerrm;
end $$;

insert into deal_files (deal_id, folder, storage_path, mime_type, size_bytes, requirement_id, title)
select :'d1', r.folder, :'base' || '/' || r.folder || '/' || replace(lower(r.label), ' ', '-') || '.pdf',
       'application/pdf', 120000, r.id, r.label
from document_requirements r where r.company_id = :'c1' and r.gate = 'before_order' and r.required;
insert into deal_files (deal_id, folder, photo_tag, storage_path, mime_type, size_bytes, width, height, taken_at, title)
values (:'d1', 'photos', 'before', :'base' || '/photos/wall-a.jpg', 'image/jpeg', 850000, 2000, 1500, '2026-10-22 18:10-04', 'Wall A'),
       (:'d1', 'photos', 'appliance_label', :'base' || '/photos/fridge-label.jpg', 'image/jpeg', 400000, 2000, 1500, '2026-10-22 18:20-04', 'Fridge label');
select gate, label, required, satisfied from deal_jacket_checklist where deal_id = :'d1' order by gate, sort_order;
update projects set order_date = '2026-10-26' where id = '00000000-0000-0000-0000-0000000000b0';
select order_date as ordered_after_paperwork from projects where id = '00000000-0000-0000-0000-0000000000b0';

\echo '--- storage objects (team uploads the files)'
insert into storage.objects (bucket_id, name) select 'deal-files', storage_path from deal_files where deal_id = :'d1';
select count(*) as team_sees_objects from storage.objects where bucket_id = 'deal-files';

\echo '--- crew on the job: sees photos + design, never contract/payments; can add progress photos'
set request.jwt.claims = '{"sub":"user_field"}';
select folder, count(*) from deal_files group by folder order by folder;
select count(*) as crew_sees_objects from storage.objects;
insert into deal_files (deal_id, folder, photo_tag, storage_path, mime_type, size_bytes)
values (:'d1', 'photos', 'progress', :'base' || '/photos/day1.jpg', 'image/jpeg', 700000);
insert into storage.objects (bucket_id, name) values ('deal-files', :'base' || '/photos/day1.jpg');
do $$ begin
  insert into deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
  values ('00000000-0000-0000-0000-00000000e001', 'contract',
          (select '00000000-0000-0000-0000-00000000c001/' || deal_year || '/' || deal_number || '/contract/x.pdf'
             from deals where id = '00000000-0000-0000-0000-00000000e001'), 'application/pdf', 100);
  raise exception 'FAIL: crew added a contract';
exception when insufficient_privilege then raise notice 'OK: crew cannot add contract files';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name)
  values ('deal-files', (select '00000000-0000-0000-0000-00000000c001/' || deal_year || '/' || deal_number || '/payments/x.pdf'
                           from deals where id = '00000000-0000-0000-0000-00000000e001'));
  raise exception 'FAIL: crew uploaded to payments';
exception when insufficient_privilege then raise notice 'OK: crew cannot upload outside photos';
end $$;
update deal_files set deleted_at = now() where folder = 'photos';  -- no crew update policy: affects 0 rows
select count(*) as crew_deleted_nothing from deal_files where deleted_at is not null;

\echo '--- unassigned crew sees nothing'
set request.jwt.claims = '{"sub":"user_field2"}';
select (select count(*) from deal_files) files, (select count(*) from storage.objects) objects;

\echo '--- close gate + recap'
set request.jwt.claims = '{"sub":"user_team"}';
insert into payments (project_id, label, amount, received_at, status)
select '00000000-0000-0000-0000-0000000000b0', 'Deposit 50%', approved_price_cents / 2, now(), 'received'
from quotes where deal_id = :'d1' and status = 'approved';
insert into change_orders (project_id, description, price_change, cost_change, approved_at)
values ('00000000-0000-0000-0000-0000000000b0', 'Add pantry pull-out', 85000, 52000, now());
update costs set actual_amount = estimated_amount + 1500 where project_id = '00000000-0000-0000-0000-0000000000b0';
select deal_number, contract_value_cents, change_orders_cents, revenue_cents, collected_cents, balance_due_cents,
       estimated_cost_cents, actual_cost_cents, estimated_profit_cents, actual_profit_cents, actual_margin
from deal_recap where deal_id = :'d1';
do $$ begin
  update projects set closed_at = now() where id = '00000000-0000-0000-0000-0000000000b0';
  raise exception 'FAIL: closed without final paperwork';
exception when check_violation then raise notice 'OK: %', sqlerrm;
end $$;
