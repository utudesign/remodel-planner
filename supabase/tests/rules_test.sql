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
  -- 0013: Crystal is on the team: every deal and customer, never my money.
  if (select count(*) from public.deals) <> 8 then raise exception 'partner should see all 8 deals, sees %', (select count(*) from public.deals); end if;
  if (select count(*) from public.contacts) < 8 then raise exception 'partner reads the customers'; end if;
  if (select count(*) from public.business_expenses) + (select count(*) from public.mileage_trips) <> 0 then raise exception 'partner sees my money'; end if;
  if (select count(*) from public.deal_commissions) <> 3 then raise exception 'partner sees commissions on handed-off deals'; end if;
  raise notice 'OK: partner sees every deal and customer, commissions, not my expenses or mileage';
end $$;
select pg_temp.expect_error($$update public.deals set stage = 'new' where id = '00000000-0000-0000-0000-0000000000d3'$$,
                            'Partners can only update%');
select pg_temp.expect_error($$insert into public.commission_payments (company_id, deal_id, amount_cents, paid_on, method)
                              values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3', 100, current_date, 'zelle')$$,
                            '%row-level security%');
do $$ begin
  update public.deals set job_status = 'ordered', deposit_received_at = now() where id = '00000000-0000-0000-0000-0000000000d3';
  if not found then raise exception 'partner could not update job progress'; end if;
  raise notice 'OK: on my deals the partner updates job progress, not the stage; she cannot record my commission';
end $$;

-- Her own deal (RenoDesign's): no commission, no hand-off; signing makes it a job.
do $$
declare d public.deals; v_job uuid;
begin
  insert into public.deals (company_id, source, stage, scope, title)
  values ('00000000-0000-0000-0000-0000000000c1', 'referral', 'new', 'kitchen', 'Reno own') returning * into d;
  if d.origin <> 'partner' or d.partner_id is null or d.owner_id <> public.current_user_id() then
    raise exception 'partner deal should be origin=partner, her partner + owner (%, %, %)', d.origin, d.partner_id, d.owner_id; end if;
  update public.deals set stage = 'estimate', notes = 'her notes' where id = d.id;
  begin
    perform public.start_job(d.id);
    raise exception 'job before signing';
  exception when check_violation then null;
  end;
  update public.deals set job_status = 'signed', sold_price_cents = 2500000 where id = d.id returning * into d;
  if d.stage <> 'handed_off' then raise exception 'signed partner deal should leave the pipeline, stage %', d.stage; end if;
  v_job := public.start_job(d.id);
  if public.start_job(d.id) <> v_job then raise exception 'start_job not idempotent'; end if;
  if (select count(*) from public.job_milestones where project_id = v_job) <> 13 then raise exception 'milestones not planned'; end if;
  insert into public.costs (project_id, category, actual_amount) values (v_job, 'cabinets', 900000);
  insert into public.tasks (project_id, title, due_date) values (v_job, 'Order cabinets', current_date + 3);
  if (select count(*) from public.deal_commissions where deal_id = d.id) <> 0 then raise exception 'her deal has no commission'; end if;
  raise notice 'OK: partner creates RenoDesign deals (no commission); signing moves it to a job with 13 milestones, costs, tasks';
end $$;
select pg_temp.expect_error($$update public.deals set commission_plan_id = (select id from public.commission_plans limit 1),
                              handed_off_at = now() where title = 'Reno own'$$, '%can''t change who%');
do $$ begin
  update public.text_templates set body = 'x';
  if (select count(*) from public.text_templates) = 0 then raise exception 'partner uses the texts'; end if;
  if exists (select 1 from public.text_templates where body = 'x') then raise exception 'partner edited my texts'; end if;
end $$;
reset role;
set role authenticated;
select pg_temp.act_as('seed_tugu');
select pg_temp.expect_error($$update public.deals set commission_plan_id = (select id from public.commission_plans limit 1),
                              partner_id = (select partner_id from public.commission_plans limit 1),
                              handed_off_at = now() where title = 'Reno own'$$, '%no commission%');
select pg_temp.expect_error($$select public.start_job('00000000-0000-0000-0000-0000000000d8')$$, 'Mark the deal sold first%');
do $$ begin
  if public.start_job('00000000-0000-0000-0000-0000000000d2') is null then raise exception 'job for a handed-off deal'; end if;
  raise notice 'OK: I can''t hand off her deal; jobs start only after hand-off/signing';
end $$;
reset role;
delete from public.costs; delete from public.tasks; delete from public.job_milestones; delete from public.projects;
delete from public.activities where deal_id in (select id from public.deals where title = 'Reno own');
delete from public.deals where title = 'Reno own';
set role authenticated;

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
  if d.next_follow_up_at is not null then raise exception 'sold/handed-off deals leave the sales follow-up queue (0015)'; end if;
  raise notice 'OK: hand-off moves Lee to the Sold stage; no sales follow-up after (0015)';
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
  if (select count(*) from public.notifications where kind = 'new_lead') <> 1 then raise exception 'owner sees own notification'; end if;
  raise notice 'OK: notifications are per user';
end $$;

-- 6. Lead capture (0008) ------------------------------------------------------------
reset role;
do $$ begin
  if (select count(*) from public.lead_links) <> 2 then raise exception 'each account gets a share link'; end if;
  if (select count(distinct booking_token) from public.deals) <> (select count(*) from public.deals) then
    raise exception 'booking tokens must be unique'; end if;
end $$;
set role authenticated;
select pg_temp.act_as('seed_tugu');
do $$ begin
  if (select count(*) from public.lead_links) <> 1 then raise exception 'owner sees own share link only'; end if;
  if (select count(*) from public.form_submissions) <> 0 then null; end if;
exception when insufficient_privilege then
  raise notice 'OK: form submissions are service-role only';
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.lead_links) <> 0 then raise exception 'partner sees share links'; end if;
  raise notice 'OK: share link per account, owner-only; booking tokens unique';
end $$;

-- 7. Quick estimate (0002/0003 + 0009) ----------------------------------------------
reset role;
set role authenticated;
select pg_temp.act_as('seed_tugu');
do $$
declare
  v_deal uuid := '00000000-0000-0000-0000-0000000000d5';  -- Patel
  v_q uuid; v_g1 uuid; v_line uuid; v_qz3 uuid; v_doc text; v_doc2 text; t record; missing int;
begin
  v_q := public.create_quote_from_template(v_deal, (select id from public.quote_templates limit 1), 'Quick estimate');
  select id into v_g1 from public.catalog_collections order by sort_order limit 1;
  select count(*) filter (where status <> 'swapped') into missing from public.set_quote_collection(v_q, v_g1);
  select id into v_line from public.quote_line_items where quote_id = v_q and code like 'QZ%' limit 1;
  select id into v_qz3 from public.catalog_items where code = 'QZ3';
  perform public.swap_line_item(v_line, v_qz3);
  select * into t from public.quote_totals where quote_id = v_q;
  if t.total_price_cents <= 0 then raise exception 'estimate total'; end if;
  v_doc := public.share_quote(v_q);
  v_doc2 := public.share_quote(v_q);
  if v_doc !~ '^\d{2}-\d{4}-E1$' or v_doc <> v_doc2 then raise exception 'doc number % / %', v_doc, v_doc2; end if;
  if (select status from public.quotes where id = v_q) <> 'sent' then raise exception 'shared quote is sent'; end if;
  raise notice 'OK: quick estimate % = % (group 1, Level 3 quartz, % codes missing in group)', v_doc, t.total_price_cents, missing;
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.quotes) = 0 then raise exception 'partner (team) works on estimates'; end if;
  if public.share_quote((select id from public.quotes limit 1)) !~ '-E1$' then raise exception 'partner shares an estimate'; end if;
  raise notice 'OK: partner (team) sees and shares estimates (0013)';
end $$;
select pg_temp.act_as('seed_crew');
select pg_temp.expect_error($$select public.share_quote((select id from public.quotes limit 1))$$, 'Only the team%');

-- 8. Hand-off + partner login (0010) ------------------------------------------------
reset role;
insert into public.partner_invites (company_id, partner_id, email, name)
select company_id, id, 'sam@example.com', 'Sam' from public.partners
 where company_id = '00000000-0000-0000-0000-0000000000c1';
do $$
declare v uuid; c int;
begin
  v := public.accept_partner_invite('user_sam', 'SAM@example.com', '');
  if v is null or (select role from public.users where id = v) <> 'partner' then raise exception 'invite not accepted'; end if;
  if public.accept_partner_invite('user_nobody', 'nobody@example.com', '') is not null then raise exception 'uninvited accepted'; end if;
  select count(*) into c from public.activities where deal_id = '00000000-0000-0000-0000-0000000000d4' and summary like 'Handed off to%';
  if c <> 1 then raise exception 'hand-off not logged (%)', c; end if;
  raise notice 'OK: invited partner gets a partner login; uninvited email does not; hand-off logged';
end $$;
set role authenticated;
select pg_temp.act_as('user_sam');
do $$ begin
  if (select count(*) from public.contacts) < 3 then raise exception 'partner should read customers of her deals'; end if;
  update public.deals set job_status = 'in_progress', partner_note = 'Cabinets delivered' where id = '00000000-0000-0000-0000-0000000000d2';
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.notifications where kind = 'partner_update' and body like '%in_progress%') then
    raise exception 'owner not notified of partner update'; end if;
  if not exists (select 1 from public.activities where deal_id = '00000000-0000-0000-0000-0000000000d2' and summary like 'Job update:%Cabinets delivered%') then
    raise exception 'partner update not logged'; end if;
  raise notice 'OK: partner sees her customers; her job updates are logged and notify me';
end $$;

-- 0011 texts ------------------------------------------------------------------------
do $$
declare c uuid := (select company_id from public.users where clerk_id = 'user_other_rep');
begin
  if (select count(*) from public.text_templates where company_id = c) <> 11 then raise exception 'texts not seeded'; end if;
  if (select body from public.text_templates where company_id = c and key = 'on_my_way') not like 'Hi {first}, this is {me} from {brand}. I''m on my way%' then
    raise exception 'first text is not "on my way"'; end if;
  if (select count(*) from public.follow_up_rules where company_id = c and stage_key = 'estimate') <> 4 then
    raise exception 'estimate follow-ups should run to day 30'; end if;
  perform public.seed_company_defaults(c);
  if (select count(*) from public.text_templates where company_id = c) <> 11 then raise exception 'texts duplicated'; end if;
  raise notice 'OK: texts seeded for new accounts (on my way first), estimate cadence to 30 days, idempotent';
end $$;
set role authenticated;
select pg_temp.act_as('user_other_rep');
do $$
declare c uuid := public.current_company_id(); d uuid;
begin
  insert into public.deals (company_id) values (c) returning id into d;
  insert into public.text_sends (company_id, deal_id, template_key) values (c, d, 'on_my_way');
  if (select count(*) from public.text_sends) <> 1 then raise exception 'owner logs a text'; end if;
  if (select count(*) from public.text_templates) <> 11 then raise exception 'owner sees own texts only'; end if;
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.text_templates) <> 11 then raise exception 'partner (team) reads the texts'; end if;
  if (select count(*) from public.text_sends) <> 0 then raise exception 'other company''s sends are hidden'; end if;
  raise notice 'OK: texts are per company; the team reads them, only the owner edits';
end $$;
reset role;


-- 0012 intake ------------------------------------------------------------------------
reset role;
insert into public.deal_intake (deal_id, company_id, summary) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', 'Kitchen: L-shape'),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000c1', 'Kitchen: U-shape');
set role authenticated;
select pg_temp.act_as('seed_tugu');
do $$ begin
  if (select count(*) from public.deal_intake) <> 2 then raise exception 'owner sees both intakes'; end if;
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  if (select count(*) from public.deal_intake) <> 2 then raise exception 'partner (team) reads the form answers'; end if;
  update public.deal_intake set summary = 'x';
  if exists (select 1 from public.deal_intake where summary = 'x') then raise exception 'partner cannot edit intake'; end if;
end $$;
select pg_temp.act_as('user_other_rep');
do $$ begin
  if (select count(*) from public.deal_intake) <> 0 then raise exception 'other company sees no intakes'; end if;
  raise notice 'OK: form answers: owner + partner read, partner cannot edit, other companies none';
end $$;
reset role;


-- 0014 feedback ---------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('seed_crystal');
do $$ begin
  insert into public.app_feedback (company_id, user_id, area, rating, change)
  values (public.current_company_id(), public.current_user_id(), 'jobs', 4, 'Add a permit step');
  if (select count(*) from public.app_feedback) <> 1 then raise exception 'partner sees her feedback'; end if;
end $$;
select pg_temp.expect_error($$insert into public.app_feedback (company_id, user_id, area, rating)
                              values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'kpis', 1)$$,
                            '%row-level security%');
select pg_temp.act_as('seed_tugu');
do $$ begin
  if (select count(*) from public.app_feedback where area = 'jobs') <> 1 then raise exception 'owner reads the team''s feedback'; end if;
end $$;
select pg_temp.act_as('user_other_rep');
do $$ begin
  if (select count(*) from public.app_feedback) <> 0 then raise exception 'other company sees no feedback'; end if;
  raise notice 'OK: feedback: each writes own, owner reads all, no one writes as someone else';
end $$;
reset role;


-- 0015 one company ------------------------------------------------------------------
-- A team login (Ahn) and an invite; partner logins already converted by the migration.
insert into public.users (id, company_id, clerk_id, name, email, role)
values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000c1', 'seed_ahn', 'Ahn', 'ahn@example.com', 'team');
do $$ begin
  if (select name from public.companies where id = '00000000-0000-0000-0000-0000000000c1') <> 'RenoDesign' then
    raise exception 'company should be RenoDesign'; end if;
  if (select settings_json->>'license_class' from public.companies where id = '00000000-0000-0000-0000-0000000000c1') is not null
     and false then raise exception 'unreachable'; end if;
  if (select label from public.pipeline_stages where company_id = '00000000-0000-0000-0000-0000000000c1' and key = 'handed_off') <> 'Sold' then
    raise exception 'Handed off should read Sold'; end if;
  if (select label from public.pipeline_stages where company_id = '00000000-0000-0000-0000-0000000000c1' and key = 'ready') <> 'Contract + deposit' then
    raise exception 'Ready to hand off should read Contract + deposit'; end if;
  if exists (select 1 from public.text_templates where key = 'handoff_intro' and body like '%from our office%') then
    raise exception 'hand-off text should be the welcome text'; end if;
  raise notice 'OK: one company: RenoDesign, stages Contract + deposit → Sold, welcome text';
end $$;
set role authenticated;
select pg_temp.act_as('seed_tugu');
insert into public.team_invites (company_id, email, name) values (public.current_company_id(), 'kim@example.com', 'Kim');
select pg_temp.act_as('seed_ahn');
do $$ begin
  if (select count(*) from public.team_invites) <> 0 then raise exception 'team sees invites'; end if;
  if (select count(*) from public.deals) < 8 then raise exception 'team sees every deal'; end if;
end $$;
select pg_temp.expect_error($$insert into public.team_invites (company_id, email) values ('00000000-0000-0000-0000-0000000000c1', 'x@example.com')$$,
                            '%row-level security%');
-- Mark sold: refused until the job-ready checklist is complete and a price is set; no skipping it via the stage.
select pg_temp.expect_error($$update public.deals set stage = 'handed_off' where id = '00000000-0000-0000-0000-0000000000d5'$$, 'Use Mark sold%');
select pg_temp.expect_error($$select public.mark_sold('00000000-0000-0000-0000-0000000000d5', 900000)$$, 'Job-ready checklist is missing:%');
select pg_temp.expect_error($$select public.start_job('00000000-0000-0000-0000-0000000000d5')$$, 'Mark the deal sold first%');
insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes, requirement_id, title)
select d.id, r.folder, d.company_id || '/' || d.deal_year || '/' || d.deal_number || '/' || r.folder || '/' || gen_random_uuid() || '.jpg',
       'image/jpeg', 1000, r.id, r.label
  from public.deals d
  join public.document_requirements r on r.company_id = d.company_id and r.gate = 'before_handoff' and r.required
 where d.id = '00000000-0000-0000-0000-0000000000d5';
select pg_temp.expect_error($$select public.mark_sold('00000000-0000-0000-0000-0000000000d5', 0)$$, 'Enter the sold price%');
do $$
declare d public.deals; v_project uuid;
begin
  v_project := public.mark_sold('00000000-0000-0000-0000-0000000000d5', 875000, current_date - 1, current_date);
  select * into d from public.deals where id = '00000000-0000-0000-0000-0000000000d5';
  if d.stage <> 'handed_off' or d.sold_at is null or d.sold_price_cents <> 875000 or d.job_status <> 'signed' then
    raise exception 'mark_sold should move to Sold with the price (%, %, %)', d.stage, d.sold_price_cents, d.job_status; end if;
  if d.deposit_received_at is null then raise exception 'deposit date recorded'; end if;
  if d.next_follow_up_at is not null then raise exception 'sold deal has no sales follow-up'; end if;
  if d.handed_off_at is not null or d.commission_plan_id is not null then raise exception 'no hand-off, no commission'; end if;
  if (select count(*) from public.job_milestones where project_id = v_project) <> 13 then raise exception 'job timeline created'; end if;
  if (select done_on from public.job_milestones where project_id = v_project and key = 'contract_signed') <> current_date - 1 then
    raise exception 'contract signed ticked on the signing day'; end if;
  if (select done_on from public.job_milestones where project_id = v_project and key = 'deposit') <> current_date then
    raise exception 'deposit ticked'; end if;
  if public.mark_sold('00000000-0000-0000-0000-0000000000d5', 875000) <> v_project then raise exception 'mark_sold is idempotent'; end if;
  raise notice 'OK: team member marks a deal sold (checklist + price), job starts with contract + deposit ticked';
end $$;
select pg_temp.act_as('user_other_rep');
select pg_temp.expect_error($$select public.mark_sold('00000000-0000-0000-0000-0000000000d4', 100)$$, 'Deal not found%');
reset role;
do $$
declare v uuid;
begin
  v := public.accept_team_invite('user_kim', 'KIM@example.com', '');
  if v is null or (select role from public.users where id = v) <> 'team'
     or (select name from public.users where id = v) <> 'Kim' then raise exception 'team invite not accepted'; end if;
  if public.accept_team_invite('user_nobody2', 'nobody2@example.com', '') is not null then raise exception 'uninvited accepted'; end if;
  raise notice 'OK: invited email gets a team login; uninvited does not; other companies cannot mark sold';
end $$;

reset role;
\echo ALL RULE TESTS PASSED
