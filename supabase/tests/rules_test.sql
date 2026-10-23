-- Business-rule + RLS checks. Run against a fresh `supabase db reset` (needs seed.sql):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rules_test.sql
-- Every block raises on failure; success prints "ALL RULE TESTS PASSED".
\set QUIET on

-- Link the demo company to a fake Clerk org and add an admin + an unassigned field user.
update public.companies set clerk_org_id = 'org_test' where id = '00000000-0000-0000-0000-0000000000c1';
select public.bootstrap_membership('org_test', 'Demo Kitchens', 'user_admin', 'Admin', 'a@x.com', 'crew');
select public.bootstrap_membership('org_test', 'Demo Kitchens', 'user_field_other', 'Other', 'o@x.com', 'crew');

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
grant execute on all functions in schema pg_temp to authenticated;

set role authenticated;

-- 1. Visibility -------------------------------------------------------------------
select pg_temp.act_as('user_admin');
do $$ begin
  if (select count(*) from public.projects) <> 2 then raise exception 'admin should see 2 projects'; end if;
  if (select count(*) from public.leads) <> 5 then raise exception 'admin should see 5 leads'; end if;
end $$;

select pg_temp.act_as('seed_crew');
do $$ begin
  -- crew never reads the projects table (money columns); they use crew_projects
  if (select count(*) from public.projects) <> 0 then raise exception 'crew must not read projects (money columns)'; end if;
  if (select count(*) from public.crew_projects) <> 1 then raise exception 'assigned crew should see 1 job via crew_projects'; end if;
  if exists (select 1 from information_schema.columns where table_name = 'crew_projects' and column_name like '%cents%') then
    raise exception 'crew_projects exposes money columns';
  end if;
  if (select count(*) from public.leads) <> 0 then raise exception 'crew must not see leads'; end if;
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

-- 2. Lead guards -------------------------------------------------------------------
select pg_temp.act_as('user_admin');
select pg_temp.expect_error(
  $q$update public.leads set next_follow_up_at = null where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%next follow-up%');
select pg_temp.expect_error(
  $q$update public.leads set stage_id = (select id from public.pipeline_stages where key = 'lost')
     where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%lost reason%');
select pg_temp.expect_error(
  $q$update public.leads set stage_id = (select id from public.pipeline_stages where key = 'won')
     where contact_id = (select id from public.contacts where name = 'Maria Gonzalez')$q$,
  '%deposit%');

-- New lead gets owner = default owner and follow-up ≈ now + 1h; stage change is logged.
do $$
declare v_lead uuid; v_contact uuid;
begin
  insert into public.contacts (company_id, name) values (private.company_id(), 'Test Person') returning id into v_contact;
  insert into public.leads (company_id, contact_id, stage_id)
  values (private.company_id(), v_contact, (select id from public.pipeline_stages where key = 'new'))
  returning id into v_lead;
  if (select owner_id from public.leads where id = v_lead) <> private.user_id() then
    raise exception 'new lead should be owned by the default owner (first admin)';
  end if;
  if (select abs(extract(epoch from next_follow_up_at - (now() + interval '1 hour'))) from public.leads where id = v_lead) > 5 then
    raise exception 'new lead follow-up should be now + 1h';
  end if;
  update public.leads set stage_id = (select id from public.pipeline_stages where key = 'contacted') where id = v_lead;
  if not exists (select 1 from public.activities where lead_id = v_lead and type = 'stage_change') then
    raise exception 'stage change should be logged';
  end if;
end $$;

-- 3. Convert to project ------------------------------------------------------------
select pg_temp.expect_error($q$
  select public.convert_lead_to_project(
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.name = 'Maria Gonzalez'),
    'Bad sum', 1000000, null, null,
    '[{"label":"Deposit","amount_cents":500000},{"label":"Rest","amount_cents":400000,"due_trigger":"final_inspection"}]',
    current_date, 'check', '1', null, null)$q$, '%add up%');

do $$
declare v_project uuid;
begin
  v_project := public.convert_lead_to_project(
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.name = 'Maria Gonzalez'),
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
  if (select s.key from public.leads l join public.pipeline_stages s on s.id = l.stage_id
       join public.projects p on p.lead_id = l.id where p.id = v_project) <> 'won' then
    raise exception 'lead should be won';
  end if;

  -- 4. Moving past "Materials Delivered" makes the balance due.
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
declare v_contact uuid; v_lead uuid; v_owner uuid;
begin
  insert into public.contacts (company_id, name) values (private.company_id(), 'Event Test') returning id into v_contact;
  insert into public.leads (company_id, contact_id, stage_id)
  values (private.company_id(), v_contact, (select id from public.pipeline_stages where key = 'new'))
  returning id, owner_id into v_lead, v_owner;
  if not exists (select 1 from public.events where lead_id = v_lead and verb = 'lead.created') then
    raise exception 'lead.created event missing';
  end if;
  insert into public.activities (company_id, lead_id, type, direction, summary)
  values (private.company_id(), v_lead, 'call', 'out', 'left VM');
  if (select first_response_at from public.leads where id = v_lead) is null then
    raise exception 'first outbound touch should start the response clock';
  end if;
  if not exists (select 1 from public.events where lead_id = v_lead and verb = 'activity.call') then
    raise exception 'activity event missing';
  end if;
end $$;

-- the owner (default lead owner) got a new-lead notification; the actor did not
select pg_temp.act_as('user_admin');
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'new_lead' and title like '%Event Test%') then
    raise exception 'lead owner should be notified of a new lead';
  end if;
end $$;
select pg_temp.act_as('seed_office');
do $$ begin
  if exists (select 1 from public.notifications where kind = 'new_lead' and title like '%Event Test%') then
    raise exception 'the person who created the lead should not be notified';
  end if;
end $$;

-- @mention notifies the mentioned person only
do $$
declare v_lead uuid; v_crystal uuid;
begin
  select l.id into v_lead from public.leads l join public.contacts c on c.id = l.contact_id where c.name = 'Event Test';
  select id into v_crystal from public.users where clerk_id = 'seed_crystal';
  insert into public.comments (company_id, entity_type, entity_id, lead_id, author_id, body, mentions)
  values (private.company_id(), 'lead', v_lead, v_lead, private.user_id(), '@Crystal can you measure Sat?', array[v_crystal]);
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
  if exists (select 1 from public.events where lead_id is not null) then raise exception 'crew sees sales events'; end if;
  if exists (select 1 from public.events where has_money) then raise exception 'crew sees money events'; end if;
end $$;

reset role;
\echo ALL RULE TESTS PASSED
