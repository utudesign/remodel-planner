-- Business-rule + RLS checks. Run against a fresh `supabase db reset` (needs seed.sql):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rules_test.sql
-- Every block raises on failure; success prints "ALL RULE TESTS PASSED".
\set QUIET on

-- Link the demo company to a fake Clerk org and add an admin + an unassigned field user.
update public.companies set clerk_org_id = 'org_test' where id = '00000000-0000-0000-0000-0000000000c1';
select public.bootstrap_membership('org_test', 'RenoDesign (demo)', 'user_admin', 'Admin', 'a@x.com', 'crew');
select public.bootstrap_membership('org_test', 'RenoDesign (demo)', 'user_field_other', 'Other', 'o@x.com', 'crew');

create or replace function pg_temp.act_as(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub, 'o', json_build_object('id', 'org_test'))::text, false);
$$;
create or replace function pg_temp.expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like p_like then raise exception 'Expected error like "%", got "%"', p_like, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected an error like "%" but the statement succeeded: %', p_like, p_sql;
end $$;
-- File every required document for a gate (what the jacket's "Add" buttons do).
create or replace function pg_temp.file_gate(p_deal uuid, p_gate text) returns void language sql as $$
  insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes, requirement_id, title)
  select d.id, r.folder,
         d.company_id || '/' || d.deal_year || '/' || d.deal_number || '/' || r.folder || '/' || gen_random_uuid() || '.pdf',
         'application/pdf', 1000, r.id, r.label
    from public.deals d join public.document_requirements r on r.company_id = d.company_id
   where d.id = p_deal and r.gate = p_gate and r.required
     and (r.applies_when = 'always' or d.permit_required)
$$;
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;

-- 1. Visibility -------------------------------------------------------------------
select pg_temp.act_as('user_admin');
do $$ begin
  if (select count(*) from public.projects) <> 2 then raise exception 'admin should see 2 projects'; end if;
  if (select count(*) from public.deals) <> 5 then raise exception 'admin should see 5 deals'; end if;
end $$;

select pg_temp.act_as('seed_crew');
do $$ begin
  -- crew never reads the projects table (money columns); they use crew_projects
  if (select count(*) from public.projects) <> 0 then raise exception 'crew must not read projects (money columns)'; end if;
  if (select count(*) from public.crew_projects) <> 1 then raise exception 'assigned crew should see 1 job via crew_projects'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'crew_projects' and column_name like '%cents%') then
    raise exception 'crew_projects exposes money columns';
  end if;
  if (select count(*) from public.deals) <> 0 then raise exception 'crew must not see deals'; end if;
  if (select count(*) from public.payments) <> 0 then raise exception 'crew must not see payments'; end if;
  if (select count(*) from public.costs) <> 0 then raise exception 'crew must not see costs'; end if;
  if (select count(*) from public.tasks) = 0 then raise exception 'crew should see tasks on their job'; end if;
  if exists (select 1 from public.events where has_money) then raise exception 'crew sees money events'; end if;
end $$;

select pg_temp.act_as('user_field_other');
do $$ begin
  if (select count(*) from public.crew_projects) <> 0 then raise exception 'unassigned crew should see 0 jobs'; end if;
end $$;

select pg_temp.act_as('nobody');
do $$ begin
  if (select count(*) from public.contacts) <> 0 then raise exception 'non-member sees contacts'; end if;
end $$;

-- 2. Deal guards -------------------------------------------------------------------
select pg_temp.act_as('user_admin');
select pg_temp.expect_error(
  $q$update public.deals set next_follow_up_at = null where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%next follow-up%');
select pg_temp.expect_error(
  $q$update public.deals set stage_id = (select id from public.pipeline_stages where key = 'lost')
     where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%lost reason%');
select pg_temp.expect_error(
  $q$update public.deals set stage_id = (select id from public.pipeline_stages where key = 'won')
     where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%deposit%');

-- New deal gets owner = default owner and follow-up ≈ now + 1h; stage change is logged.
do $$
declare v_deal uuid; v_contact uuid;
begin
  insert into public.contacts (company_id, name) values (private.company_id(), 'Test Person') returning id into v_contact;
  insert into public.deals (company_id, contact_id, stage_id)
  values (private.company_id(), v_contact, (select id from public.pipeline_stages where key = 'new'))
  returning id into v_deal;
  if (select owner_id from public.deals where id = v_deal) <> private.user_id() then
    raise exception 'new deal should be owned by the default owner (first admin)';
  end if;
  if (select abs(extract(epoch from next_follow_up_at - (now() + interval '1 hour'))) from public.deals where id = v_deal) > 5 then
    raise exception 'new deal follow-up should be now + 1h';
  end if;
  update public.deals set stage_id = (select id from public.pipeline_stages where key = 'contacted') where id = v_deal;
  if not exists (select 1 from public.activities where deal_id = v_deal and type = 'stage_change') then
    raise exception 'stage change should be logged';
  end if;
end $$;

-- 3. Convert to project ------------------------------------------------------------
select pg_temp.expect_error($q$
  select public.convert_deal_to_project(
    (select l.id from public.deals l join public.contacts c on c.id = l.contact_id where c.name = 'Maria Gonzalez'),
    'Bad sum', 1000000, null, null,
    '[{"label":"Deposit","amount_cents":500000},{"label":"Rest","amount_cents":400000,"due_trigger":"final_inspection"}]',
    current_date, 'check', '1', null, null)$q$, '%add up%');

do $$
declare v_project uuid;
begin
  v_project := public.convert_deal_to_project(
    (select l.id from public.deals l join public.contacts c on c.id = l.contact_id where c.name = 'Maria Gonzalez'),
    'Gonzalez cabinets', 1000000,
    (select id from public.payment_templates where name = 'Cabinets only'),
    (select id from public.task_templates where is_default),
    '[{"label":"Deposit","amount_cents":700000},{"label":"Balance","amount_cents":300000,"due_trigger":"materials_delivered"}]',
    current_date, 'check', '2001', current_date + 14, null);
  if (select count(*) from public.milestones where project_id = v_project) <> 9 then raise exception 'milestones not generated'; end if;
  if (select count(*) from public.tasks where project_id = v_project) <> 16 then raise exception 'tasks not generated'; end if;
  if (select status from public.payments where project_id = v_project and sort_order = 1) <> 'received' then
    raise exception 'deposit should be received';
  end if;
  if (select s.key from public.deals l join public.pipeline_stages s on s.id = l.stage_id
       join public.projects p on p.deal_id = l.id where p.id = v_project) <> 'won' then
    raise exception 'deal should be won';
  end if;

  -- 4. Deal jacket gate: can't order without contract + design + deposit papers.
  begin
    perform public.move_project_to_milestone(v_project, 'project_start');
    raise exception 'order gate should block';
  exception when check_violation then
    if sqlerrm not like 'Deal jacket is missing before ordering%' then raise; end if;
  end;
  perform pg_temp.file_gate((select deal_id from public.projects where id = v_project), 'before_order');

  -- Moving past "Materials Delivered" makes the balance due.
  perform public.move_project_to_milestone(v_project, 'project_start');
  if (select status from public.payments where project_id = v_project and sort_order = 2) <> 'due' then
    raise exception 'balance should be due after delivery';
  end if;
  -- Moving back reverts it.
  perform public.move_project_to_milestone(v_project, 'materials_delivered');
  if (select status from public.payments where project_id = v_project and sort_order = 2) <> 'pending' then
    raise exception 'balance should revert to pending';
  end if;
end $$;

-- 5. Close gate + margin lock --------------------------------------------------------
select pg_temp.expect_error($q$select public.close_project('00000000-0000-0000-0000-0000000000a2')$q$, '%Balance due%punch list%');

select pg_temp.act_as('seed_office');
select pg_temp.expect_error($q$select public.close_project('00000000-0000-0000-0000-0000000000a2')$q$, '%Only an owner%');
update public.payments set status = 'received', received_on = current_date, method = 'check', check_number = '555'
 where project_id = '00000000-0000-0000-0000-0000000000a2' and status = 'due';
update public.tasks set status = 'done' where project_id = '00000000-0000-0000-0000-0000000000a2' and kind = 'punch';

select pg_temp.act_as('user_admin');
select pg_temp.expect_error($q$select public.close_project('00000000-0000-0000-0000-0000000000a2')$q$, '%missing before closing%');
select pg_temp.file_gate((select deal_id from public.projects where id = '00000000-0000-0000-0000-0000000000a2'), 'before_close');
select public.close_project('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  -- revenue 1,450,000; cost 1,045,000 → margin 27.93%
  if (select locked_margin_bps from public.projects where id = '00000000-0000-0000-0000-0000000000a2') <> 2793 then
    raise exception 'locked margin should be 2793 bps, got %',
      (select locked_margin_bps from public.projects where id = '00000000-0000-0000-0000-0000000000a2');
  end if;
  if (select actual_date from public.milestones where project_id = '00000000-0000-0000-0000-0000000000a2' and key = 'final_payment') is null then
    raise exception 'final payment milestone should be set when everything is received';
  end if;
end $$;

-- 6. Post-close edits: designer blocked, admin allowed + audited.
select pg_temp.act_as('seed_office');
select pg_temp.expect_error($q$update public.costs set actual_amount_cents = 1 where project_id = '00000000-0000-0000-0000-0000000000a2'$q$, '%closed%');
select pg_temp.act_as('user_admin');
update public.costs set vendor = 'CabinetCo Inc.' where project_id = '00000000-0000-0000-0000-0000000000a2' and vendor = 'CabinetCo';
do $$ begin
  if not exists (select 1 from public.audit_log where table_name = 'costs' and action = 'update') then
    raise exception 'admin post-close edit should be audited';
  end if;
end $$;

-- 7. Settings are admin-only.
select pg_temp.act_as('seed_office');
do $$ begin
  update public.lost_reasons set label = 'hack' where key = 'price';
  if exists (select 1 from public.lost_reasons where label = 'hack') then raise exception 'designer edited settings'; end if;
end $$;

-- 8. Team engine: events + notifications written in the same transaction --------------
select pg_temp.act_as('seed_office');
do $$
declare v_contact uuid; v_deal uuid; v_owner uuid;
begin
  insert into public.contacts (company_id, name) values (private.company_id(), 'Event Test') returning id into v_contact;
  insert into public.deals (company_id, contact_id, stage_id)
  values (private.company_id(), v_contact, (select id from public.pipeline_stages where key = 'new'))
  returning id, owner_id into v_deal, v_owner;
  if not exists (select 1 from public.events where deal_id = v_deal and verb = 'deal.created') then
    raise exception 'deal.created event missing';
  end if;
  insert into public.activities (company_id, deal_id, type, direction, summary)
  values (private.company_id(), v_deal, 'call', 'out', 'left VM');
  if (select first_response_at from public.deals where id = v_deal) is null then
    raise exception 'first outbound touch should start the response clock';
  end if;
  if not exists (select 1 from public.events where deal_id = v_deal and verb = 'activity.call') then
    raise exception 'activity event missing';
  end if;
end $$;

-- the owner (default deal owner) got a new-deal notification; the actor did not
select pg_temp.act_as('user_admin');
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'new_deal' and title like '%Event Test%') then
    raise exception 'deal owner should be notified of a new deal';
  end if;
end $$;
select pg_temp.act_as('seed_office');
do $$ begin
  if exists (select 1 from public.notifications where kind = 'new_deal' and title like '%Event Test%') then
    raise exception 'the person who created the deal should not be notified';
  end if;
end $$;

-- @mention notifies the mentioned person only
do $$
declare v_deal uuid; v_crystal uuid;
begin
  select l.id into v_deal from public.deals l join public.contacts c on c.id = l.contact_id where c.name = 'Event Test';
  select id into v_crystal from public.users where clerk_id = 'seed_crystal';
  insert into public.comments (company_id, entity_type, entity_id, deal_id, author_id, body, mentions)
  values (private.company_id(), 'deal', v_deal, v_deal, private.user_id(), '@Crystal can you measure Sat?', array[v_crystal]);
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'mention' and title like '%mentioned you%') then
    raise exception 'mentioned user should be notified';
  end if;
end $$;

-- events can't be forged; team can't change settings or work windows
select pg_temp.act_as('seed_office');
select pg_temp.expect_error($q$insert into public.events (company_id, entity_type, verb, summary) values (private.company_id(), 'x', 'x', 'x')$q$, '%permission denied%');
do $$ begin
  insert into public.work_windows (company_id, user_id, weekday, start_time, end_time, kind)
  values (private.company_id(), private.user_id(), 1, '09:00', '10:00', 'live');
  raise exception 'team should not be able to edit work windows';
exception when insufficient_privilege then null;
end $$;

-- crew: sees events for their job only, never money or sales
select pg_temp.act_as('seed_crew');
do $$ begin
  if exists (select 1 from public.events where deal_id is not null) then raise exception 'crew sees sales events'; end if;
  if exists (select 1 from public.events where has_money) then raise exception 'crew sees money events'; end if;
end $$;

-- 9. Deal numbers ----------------------------------------------------------------------
reset role;
do $$
declare a record; b record; late record; jan record;
begin
  -- two deals at the same instant get consecutive numbers
  select * into a from public.next_deal_number('00000000-0000-0000-0000-0000000000c1', timestamptz '2026-03-14 15:00:00-04');
  select * into b from public.next_deal_number('00000000-0000-0000-0000-0000000000c1', timestamptz '2026-03-14 15:00:00-04');
  if a.deal_number <> '03141' or b.deal_number <> '03142' then raise exception 'got % / %', a.deal_number, b.deal_number; end if;
  -- 11:30 PM ET still belongs to that day (already Mar 15 in UTC)
  select * into late from public.next_deal_number('00000000-0000-0000-0000-0000000000c1', timestamptz '2026-03-14 23:30:00-04');
  if late.deal_number <> '03143' then raise exception '11:30 PM ET should be 03143, got %', late.deal_number; end if;
  select * into jan from public.next_deal_number('00000000-0000-0000-0000-0000000000c1', timestamptz '2027-01-05 09:00:00-05');
  if jan.deal_number <> '01051' or jan.deal_year <> 2027 then raise exception 'Jan 5 should be 01051/2027'; end if;
end $$;
set role authenticated;
select pg_temp.act_as('user_admin');
do $$ begin
  if exists (select 1 from public.deals where deal_number = '' or deal_year < 2000) then raise exception 'every deal needs a number'; end if;
  begin
    update public.deals set deal_number = '99999' where deal_number is not null;
    raise exception 'deal numbers must be permanent';
  exception when check_violation then null;
  end;
end $$;
-- crew sees photos of their job but never money documents
select pg_temp.act_as('seed_crew');
do $$ begin
  if exists (select 1 from public.deal_files where folder in ('payments', 'contract', 'invoices_receipts')) then
    raise exception 'crew sees money documents';
  end if;
end $$;

reset role;
\echo ALL RULE TESTS PASSED
