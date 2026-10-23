-- Rules + access checks for 0001/0007 on top of supabase/seed.sql.
-- (The handoff's own tests in test/ cover 0002–0006.) Run with scripts/test-db.sh.
-- Every block raises on failure; success prints "ALL RULE TESTS PASSED".
\set QUIET on
\set ON_ERROR_STOP 1

create or replace function pg_temp.act_as(p_sub text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_sub)::text, false);
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

-- A second account (another rep) and a stray crew login in the demo company.
select * from public.bootstrap_owner('user_other_rep', 'Other Rep', 'o@x.com') \gset other_
insert into public.users (company_id, clerk_id, name, role)
values ('00000000-0000-0000-0000-0000000000c1', 'seed_crew', 'Installer', 'crew');

-- 0. Onboarding ------------------------------------------------------------------
do $$
declare c uuid := (select company_id from public.users where clerk_id = 'user_other_rep');
begin
  if (select count(*) from public.pipeline_stages where company_id = c) <> 8 then raise exception 'stages not seeded'; end if;
  if (select count(*) from public.partners where company_id = c) <> 1 then raise exception 'partner not seeded'; end if;
  if (select count(*) from public.commission_plans where company_id = c) <> 2 then raise exception 'plans not seeded'; end if;
  if not exists (select 1 from public.estimating_settings where company_id = c) then raise exception 'estimating not seeded'; end if;
  if (select count(*) from public.document_requirements where company_id = c and gate = 'before_handoff') <> 5 then
    raise exception 'hand-off checklist not seeded'; end if;
  if (select (settings_json->>'mileage_rate_cents')::numeric from public.companies where id = c) <> 72.5 then
    raise exception 'mileage rate default'; end if;
  if (select role from public.users where clerk_id = 'user_other_rep') <> 'owner' then raise exception 'first user is owner'; end if;
  -- idempotent
  perform public.bootstrap_owner('user_other_rep', 'Other Rep', 'o@x.com');
  perform public.seed_company_defaults(c);
  if (select count(*) from public.companies) <> 2 then raise exception 'bootstrap twice made a 2nd company'; end if;
  if (select count(*) from public.commission_plans where company_id = c) <> 2 then raise exception 'plans duplicated'; end if;
  raise notice 'OK: onboarding seeds stages, partner, plans, estimating, checklist; idempotent';
end $$;

set role authenticated;

-- 1. Who sees what ----------------------------------------------------------------
select pg_temp.act_as('seed_tugu');
do $$ begin
  if (select count(*) from public.deals) <> 8 then raise exception 'owner should see 8 deals, sees %', (select count(*) from public.deals); end if;
  if (select count(*) from public.business_expenses) <> 1 then raise exception 'owner sees expenses'; end if;
  if (select count(*) from public.companies) <> 1 then raise exception 'owner sees only own company'; end if;
  raise notice 'OK: owner sees all 8 demo deals, own company only';
end $$;

select pg_temp.act_as('user_other_rep');
do $$ begin
  if (select count(*) from public.deals) <> 0 then raise exception 'other rep sees demo deals'; end if;
  if (select count(*) from public.contacts) <> 0 then raise exception 'other rep sees contacts'; end if;
  if (select count(*) from public.partners) <> 1 then raise exception 'other rep should see only own partner'; end if;
  raise notice 'OK: another account sees nothing of the demo company';
end $$;

select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.deals) <> 3 then raise exception 'partner should see 3 handed-off deals, sees %', (select count(*) from public.deals); end if;
  if (select count(*) from public.contacts) <> 0 then raise exception 'partner must not read contacts table'; end if;
  if (select count(*) from public.business_expenses) + (select count(*) from public.mileage_trips) <> 0 then raise exception 'partner sees my money'; end if;
  if (select count(*) from public.activities) <> 0 then raise exception 'partner sees my activity log'; end if;
  if (select count(*) from public.deal_commissions) <> 3 then raise exception 'partner sees commissions on her deals'; end if;
  raise notice 'OK: partner sees only her 3 deals, no contacts, notes or expenses';
end $$;
select pg_temp.expect_error($$update public.deals set stage = 'new' where id = '00000000-0000-0000-0000-0000000000d3'$$,
                            'Partners can only update%');
do $$ begin
  update public.deals set job_status = 'ordered', deposit_received_at = now() where id = '00000000-0000-0000-0000-0000000000d3';
  if not found then raise exception 'partner could not update job progress'; end if;
  raise notice 'OK: partner updates job progress, not the stage';
end $$;

select pg_temp.act_as('seed_crew');
do $$ begin
  if (select count(*) from public.deals) + (select count(*) from public.contacts) + (select count(*) from public.partners) <> 0 then
    raise exception 'unassigned crew sees sales data'; end if;
  raise notice 'OK: crew login sees nothing';
end $$;

-- 2. Deal rules -------------------------------------------------------------------
select pg_temp.act_as('seed_tugu');
do $$
declare d public.deals;
begin
  insert into public.deals (company_id, source, stage, scope)
  values ('00000000-0000-0000-0000-0000000000c1', 'manual', 'new', 'kitchen') returning * into d;
  if d.owner_id <> '00000000-0000-0000-0000-0000000000a1' then raise exception 'default owner'; end if;
  if d.next_follow_up_at not between now() + interval '59 minutes' and now() + interval '61 minutes' then
    raise exception 'new lead follow-up should be +1h, got %', d.next_follow_up_at; end if;
  if d.deal_number !~ '^\d{2}-\d{4}$' then raise exception 'deal number %', d.deal_number; end if;

  insert into public.activities (company_id, deal_id, type, direction, summary)
  values (d.company_id, d.id, 'call', 'out', 'Left a voicemail');
  select * into d from public.deals where id = d.id;
  if d.last_touch_at is null then raise exception 'touch not recorded'; end if;

  update public.deals set stage = 'qualified' where id = d.id returning * into d;
  if d.next_follow_up_at::date <> (now() + interval '1 day')::date then raise exception 'qualified follow-up +1 day'; end if;
  if not exists (select 1 from public.activities where deal_id = d.id and type = 'stage_change') then
    raise exception 'stage change not logged'; end if;
  raise notice 'OK: new deal gets number %, owner, +1h follow-up; touches + stage changes logged', d.deal_number;
end $$;
select pg_temp.expect_error($$update public.deals set stage = 'nope' where id = '00000000-0000-0000-0000-0000000000d6'$$, 'Unknown stage%');
select pg_temp.expect_error($$update public.deals set stage = 'lost' where id = '00000000-0000-0000-0000-0000000000d6'$$, 'A lost reason is required%');
do $$
declare d public.deals;
begin
  update public.deals set stage = 'lost', lost_reason = 'timing' where id = '00000000-0000-0000-0000-0000000000d6' returning * into d;
  if d.next_follow_up_at is not null then raise exception 'lost deals leave the follow-up queue'; end if;
  update public.deals set stage = 'qualified' where id = d.id returning * into d;
  if d.lost_reason is not null or d.next_follow_up_at is null then raise exception 'reopen clears lost reason'; end if;
  raise notice 'OK: unknown stage refused; lost needs a reason; reopening works';
end $$;

-- 3. Hand-off moves the stage; partner updates restart the 7-day nudge -------------
select pg_temp.expect_error($$update public.deals set handed_off_at = now() where id = '00000000-0000-0000-0000-0000000000d5'$$,
                            'Pick the partner%');
do $$
declare d public.deals;
begin
  update public.deals d2 set partner_id = cp.partner_id, commission_plan_id = cp.id, handed_off_at = now()
    from public.commission_plans cp
   where d2.id = '00000000-0000-0000-0000-0000000000d4' and cp.company_id = d2.company_id and cp.name like 'Kitchens%'
  returning d2.* into d;
  if d.stage <> 'handed_off' then raise exception 'hand-off should move stage, got %', d.stage; end if;
  if d.next_follow_up_at::date <> (now() + interval '7 days')::date then raise exception 'ask-partner nudge in 7 days'; end if;
  raise notice 'OK: hand-off moves Lee to "Handed off" with a 7-day partner nudge';
end $$;
reset role;
do $$ begin
  if (select partner_updated_at from public.deals where id = '00000000-0000-0000-0000-0000000000d3') < now() - interval '1 minute' then
    raise exception 'partner update not stamped'; end if;
  raise notice 'OK: partner update stamped';
end $$;
set role authenticated;

-- 4. Money -------------------------------------------------------------------------
select pg_temp.act_as('seed_tugu');
do $$
declare s record; k record;
begin
  select * into k from public.deal_commissions where deal_id = '00000000-0000-0000-0000-0000000000d2';
  if k.earned_cents <> 96250 or k.owed_cents <> 96250 then raise exception 'Kim: earned % owed %', k.earned_cents, k.owed_cents; end if;
  select * into k from public.deal_commissions where deal_id = '00000000-0000-0000-0000-0000000000d1';
  if k.commission_status <> 'paid' or k.paid_cents <> 33600 then raise exception 'Park should be paid'; end if;
  select * into s from public.rep_year_summary(2026, 72.5::numeric);
  -- 42.5 mi × 72.5¢ = 3,081.25¢ → 3,081
  if s.mileage_deduction_cents <> 3081 or s.net_cents <> 33600 - 7499 - 3081 then
    raise exception 'year summary % %', s.mileage_deduction_cents, s.net_cents; end if;
  raise notice 'OK: commissions (Kim owed $962.50, Park paid) and year net at 72.5¢/mi';
end $$;

-- 5. Notifications are private to their user ---------------------------------------
reset role;
insert into public.notifications (company_id, user_id, kind, title)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'new_lead', 'New lead');
set role authenticated;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.notifications) <> 0 then raise exception 'partner sees my notifications'; end if;
end $$;
select pg_temp.act_as('seed_tugu');
do $$ begin
  if (select count(*) from public.notifications) <> 1 then raise exception 'owner sees own notification'; end if;
  raise notice 'OK: notifications are per user';
end $$;

reset role;
\echo ALL RULE TESTS PASSED
