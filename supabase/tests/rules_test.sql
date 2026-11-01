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
insert into public.deal_files (deal_id, folder, photo_tag, storage_path, mime_type, size_bytes, requirement_id, title)
select d.id, 'photos', 'before', d.company_id || '/' || d.deal_year || '/' || d.deal_number || '/photos/' || gen_random_uuid() || '.jpg',
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

-- 0016 workspaces + sharing -------------------------------------------------------------
do $$
declare c uuid := '00000000-0000-0000-0000-0000000000c1';
begin
  if (select count(*) from public.workspaces where company_id = c) <> 1 then raise exception 'one workspace per company'; end if;
  if exists (select 1 from public.deals where company_id = c and workspace_id is distinct from private.first_workspace(c)) then
    raise exception 'existing deals stay in the first workspace'; end if;
  if not (select workspace_admin from public.users where clerk_id = 'seed_tugu') then raise exception 'owner admins the workspace'; end if;
  raise notice 'OK: workspaces backfilled: one per company, all deals in it, owner is its admin';
end $$;
set role authenticated;
-- A teammate can't make workspaces; the owner gives Ahn her own.
select pg_temp.act_as('user_kim');
select pg_temp.expect_error($$select public.create_workspace_for('00000000-0000-0000-0000-0000000000a5', 'Ahn Studio')$$, 'Only the owner%');
select pg_temp.act_as('seed_tugu');
select public.create_workspace_for('00000000-0000-0000-0000-0000000000a5', 'Ahn Studio') as ahn_ws \gset
select pg_temp.act_as('seed_ahn');
do $$
declare v_contact uuid; v_deal uuid;
begin
  if not public.is_ws_admin() then raise exception 'Ahn admins her workspace'; end if;
  if (select count(*) from public.deals) <> 0 then raise exception 'new workspace starts empty (sees %)', (select count(*) from public.deals); end if;
  if (select count(*) from public.contacts) <> 0 then raise exception 'new workspace sees no contacts'; end if;
  if (select count(*) from public.quotes) <> 0 or (select count(*) from public.deal_files) <> 0
     or (select count(*) from public.projects) <> 0 or (select count(*) from public.activities) <> 0 then
    raise exception 'new workspace sees no quotes, files, jobs or activity'; end if;
  if (select count(*) from public.workspaces) <> 2 then raise exception 'workspace names are visible to share with'; end if;
  insert into public.contacts (company_id, name) values (public.current_company_id(), 'Pat Ahnclient') returning id into v_contact;
  insert into public.deals (id, company_id, contact_id, source, stage, scope, title)
  values ('00000000-0000-0000-0000-0000000000e1', public.current_company_id(), v_contact, 'referral', 'new', 'kitchen', 'Ahn own')
  returning id into v_deal;
  if (select owner_id from public.deals where id = v_deal) <> '00000000-0000-0000-0000-0000000000a5' then
    raise exception 'a new deal goes to the workspace admin'; end if;
  insert into public.team_invites (company_id, email, name) values (public.current_company_id(), 'sam@example.com', 'Sam');
  if (select count(*) from public.team_invites) <> 1 then raise exception 'Ahn sees only her own invites'; end if;
  raise notice 'OK: Ahn''s own workspace starts empty; her deals, contacts and invites are hers';
end $$;
select pg_temp.expect_error($$update public.users set workspace_id = null where clerk_id = 'seed_ahn'$$, '%');
select pg_temp.expect_error($$select public.share_deal('00000000-0000-0000-0000-0000000000d1', public.current_workspace_id())$$, 'Only the deal''s own workspace%');
select pg_temp.act_as('seed_tugu');
do $$ begin
  if exists (select 1 from public.deals where id = '00000000-0000-0000-0000-0000000000e1') then raise exception 'Tugu can''t see Ahn''s deal'; end if;
  if exists (select 1 from public.contacts where name = 'Pat Ahnclient') then raise exception 'Tugu can''t see Ahn''s contact'; end if;
  if exists (select 1 from public.team_invites where email = 'sam@example.com') then raise exception 'Tugu can''t see Ahn''s invites'; end if;
  if (select count(*) from public.deals) < 8 then raise exception 'Tugu still sees his own deals'; end if;
  raise notice 'OK: the owner does not see a deal from another workspace until it''s shared';
end $$;
select pg_temp.expect_error($$select public.share_deal('00000000-0000-0000-0000-0000000000e1', private.first_workspace(public.current_company_id()))$$,
                            'Only the deal''s own workspace%');
-- Ahn shares; Tugu sees and edits it fully; only Ahn can stop sharing.
select pg_temp.act_as('seed_ahn');
select public.share_deal('00000000-0000-0000-0000-0000000000e1', (select id from public.workspaces where name <> 'Ahn Studio'));
select public.share_deal('00000000-0000-0000-0000-0000000000e1', (select id from public.workspaces where name <> 'Ahn Studio'));
select pg_temp.act_as('seed_tugu');
do $$ begin
  if not exists (select 1 from public.deals where id = '00000000-0000-0000-0000-0000000000e1') then raise exception 'shared deal visible'; end if;
  if not exists (select 1 from public.contacts where name = 'Pat Ahnclient') then raise exception 'shared deal''s contact visible'; end if;
  update public.deals set title = 'Ahn own (edited by Tugu)' where id = '00000000-0000-0000-0000-0000000000e1';
  if not found then raise exception 'shared deal editable'; end if;
  update public.contacts set phone = '(703) 555-0199' where name = 'Pat Ahnclient';
  if not found then raise exception 'shared contact editable'; end if;
  insert into public.activities (company_id, deal_id, type, summary)
  values (public.current_company_id(), '00000000-0000-0000-0000-0000000000e1', 'call', 'Tugu called');
  if (select count(*) from public.notifications where deal_id = '00000000-0000-0000-0000-0000000000e1') <> 1 then
    raise exception 'Tugu notified once about the share'; end if;
  if (select count(*) from public.deal_shares) <> 1 then raise exception 'Tugu sees the share'; end if;
  raise notice 'OK: a shared deal is visible and fully editable in the other workspace; one notification';
end $$;
select pg_temp.expect_error($$select public.unshare_deal('00000000-0000-0000-0000-0000000000e1', public.current_workspace_id())$$,
                            'Only the deal''s own workspace%');
do $$ begin
  delete from public.deal_shares;
  if (select count(*) from public.deal_shares) <> 1 then raise exception 'only the home workspace removes a share'; end if;
end $$;
select pg_temp.expect_error($$update public.deals set workspace_id = public.current_workspace_id() where id = '00000000-0000-0000-0000-0000000000e1'$$,
                            '%another workspace%');
select pg_temp.act_as('user_other_rep');
select pg_temp.expect_error($$select public.share_deal('00000000-0000-0000-0000-0000000000e1', public.current_workspace_id())$$,
                            'Only the deal''s own workspace%');
select pg_temp.act_as('seed_ahn');
do $$ begin
  if (select title from public.deals where id = '00000000-0000-0000-0000-0000000000e1') <> 'Ahn own (edited by Tugu)' then
    raise exception 'Ahn sees Tugu''s edit'; end if;
  if (select count(*) from public.deals) <> 1 then raise exception 'sharing is one deal, not the workspace'; end if;
  perform public.unshare_deal('00000000-0000-0000-0000-0000000000e1', (select id from public.workspaces where name <> 'Ahn Studio'));
end $$;
select pg_temp.act_as('seed_tugu');
do $$ begin
  if exists (select 1 from public.deals where id = '00000000-0000-0000-0000-0000000000e1') then raise exception 'unshared deal hidden again'; end if;
  if exists (select 1 from public.activities where deal_id = '00000000-0000-0000-0000-0000000000e1') then raise exception 'its activity hidden too'; end if;
  -- Both ways: Tugu shares one of his with Ahn.
  perform public.share_deal('00000000-0000-0000-0000-0000000000d1', (select id from public.workspaces where name = 'Ahn Studio'));
  raise notice 'OK: stop sharing hides it again (deal + activity); the owner can share his own deal the other way';
end $$;
select pg_temp.act_as('seed_ahn');
do $$ begin
  if (select count(*) from public.deals) <> 2 then raise exception 'Ahn sees her deal + the one Tugu shared'; end if;
  if exists (select 1 from public.deals where id = '00000000-0000-0000-0000-0000000000d2') then raise exception 'not the unshared ones'; end if;
  raise notice 'OK: sharing works both ways';
end $$;
select pg_temp.expect_error($$select public.move_to_workspace((select id from public.users where clerk_id = 'user_kim'), public.current_workspace_id())$$,
                            'Only the owner%');
select pg_temp.act_as('seed_tugu');
select public.move_to_workspace((select id from public.users where clerk_id = 'user_kim'), (select id from public.workspaces where name = 'Ahn Studio'));
select pg_temp.act_as('user_kim');
do $$ begin
  if public.is_ws_admin() then raise exception 'a moved member is not the admin'; end if;
  if (select count(*) from public.deals) <> 2 then raise exception 'Kim now sees Ahn Studio''s deals only (%)', (select count(*) from public.deals); end if;
  raise notice 'OK: the owner moves a teammate into another workspace as a member';
end $$;
reset role;


-- 0017 (v3 batch A): estimates delete / archive, file types per folder ------------------
select pg_temp.act_as('seed_tugu');
set role authenticated;
do $$
declare q_draft uuid; q_sent uuid; q_sold uuid; n int; open_deal uuid;
begin
  insert into public.deals (company_id, source, stage, scope, title)
  values ('00000000-0000-0000-0000-0000000000c1', 'manual', 'new', 'kitchen', '0017 open deal') returning id into open_deal;
  perform set_config('test.open_deal', open_deal::text, false);
  insert into public.quotes (deal_id, version, name) values (open_deal, 901, 'draft to delete') returning id into q_draft;
  insert into public.quotes (deal_id, version, name, sent_at) values (open_deal, 902, 'sent', now()) returning id into q_sent;
  insert into public.quotes (deal_id, version, name) values ('00000000-0000-0000-0000-0000000000d1', 903, 'on a sold deal') returning id into q_sold;

  update public.quotes set deleted_at = now() where id = q_draft;
  if (select deleted_by from public.quotes where id = q_draft) is null then raise exception 'delete records who'; end if;
  begin
    update public.quotes set deleted_at = null where id = q_draft;
    raise exception 'undelete should fail';
  exception when check_violation then null; end;
  begin
    insert into public.quote_line_items (quote_id, section_id, name, qty, unit_cost_cents)
    select q_draft, id, 'x', 1, 100 from public.quote_sections limit 1;
    raise exception 'lines on a deleted estimate should fail';
  exception when check_violation then null; end;

  begin
    update public.quotes set deleted_at = now() where id = q_sent;
    raise exception 'deleting a sent estimate should fail';
  exception when check_violation then
    if sqlerrm not like '%archive it instead%' then raise; end if;
  end;
  begin
    update public.quotes set deleted_at = now() where id = q_sold;
    raise exception 'deleting an estimate on a sold deal should fail';
  exception when check_violation then null; end;

  update public.quotes set archived_at = now() where id = q_sent;
  if (select archived_by from public.quotes where id = q_sent) is null then raise exception 'archive records who'; end if;
  update public.quotes set archived_at = null where id = q_sent;
  if (select archived_by from public.quotes where id = q_sent) is not null then raise exception 'unarchive clears who'; end if;

  delete from public.quotes where id = q_draft;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'no hard deletes through the API'; end if;
  raise notice 'OK: drafts soft-delete (who + when, no undo, frozen); sent / sold estimates only archive; no hard deletes';
end $$;

do $$
declare d record;
begin
  select id, company_id || '/' || deal_year || '/' || deal_number as p into d from public.deals
   where id = current_setting('test.open_deal')::uuid;
  insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
  values (d.id, 'design', d.p || '/design/' || gen_random_uuid() || '-plan.pdf', 'application/pdf', 100),
         (d.id, 'contract', d.p || '/contract/' || gen_random_uuid() || '-c.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 100),
         (d.id, 'other', d.p || '/other/' || gen_random_uuid() || '-old.doc', 'application/msword', 100),
         (d.id, 'design', d.p || '/design/' || gen_random_uuid() || '-measurements.txt', 'text/plain', 100),
         (d.id, 'photos', d.p || '/photos/' || gen_random_uuid() || '.jpg', 'image/jpeg', 100);
  begin
    insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
    values (d.id, 'design', d.p || '/design/' || gen_random_uuid() || '.jpg', 'image/jpeg', 100);
    raise exception 'an image in Files should fail';
  exception when check_violation then
    if sqlerrm not like '%Photos go on the Photos tab%' then raise; end if;
  end;
  begin
    insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
    values (d.id, 'contract', d.p || '/contract/' || gen_random_uuid() || '.xlsx', 'application/pdf', 100);
    raise exception 'type and extension must agree';
  exception when check_violation then null; end;
  begin
    insert into public.deal_files (deal_id, folder, storage_path, mime_type, size_bytes)
    values (d.id, 'contract', d.p || '/contract/' || gen_random_uuid() || '.txt', 'text/plain', 100);
    raise exception 'text notes only in design / other';
  exception when check_violation then null; end;
  begin
    insert into public.deal_files (deal_id, folder, photo_tag, storage_path, mime_type, size_bytes)
    values (d.id, 'photos', 'before', d.p || '/photos/' || gen_random_uuid() || '.pdf', 'application/pdf', 100);
    raise exception 'a PDF in Photos should fail';
  exception when check_violation then null; end;
  raise notice 'OK: Files take PDF / Word (type + extension), the app''s own .txt notes, photos take images only';
end $$;
reset role;


-- 0018 (v3 batch B): checklist ticks by hand, History audit trail ----------------------------
select pg_temp.act_as('seed_tugu');
set role authenticated;
do $$
declare dl uuid; n int; a record; c uuid;
begin
  insert into public.contacts (company_id, name, phone) values ('00000000-0000-0000-0000-0000000000c1', 'Ruby K', '7035550100') returning id into c;
  insert into public.deals (company_id, source, stage, scope, title, contact_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'manual', 'new', 'kitchen', '0018 deal', c) returning id into dl;
  perform set_config('test.d18', dl::text, false);

  -- Hand ticks: who + when; every required item ticked → Mark sold goes through without a single file.
  begin
    perform public.mark_sold(dl, 4500000);
    raise exception 'mark_sold should need the checklist';
  exception when check_violation then null; end;
  insert into public.deal_checklist_checks (deal_id, requirement_id, note)
  select dl, r.id, 'checked on site'
    from public.document_requirements r
   where r.company_id = '00000000-0000-0000-0000-0000000000c1' and r.gate = 'before_handoff' and r.required;
  if exists (select 1 from public.deal_checklist_checks where deal_id = dl and (checked_by is null or checked_at is null)) then
    raise exception 'a tick records who and when'; end if;
  if exists (select 1 from public.deal_jacket_checklist where deal_id = dl and gate = 'before_handoff' and required and not satisfied) then
    raise exception 'ticked items show as satisfied'; end if;
  if (select checked_by from public.deal_jacket_checklist where deal_id = dl and gate = 'before_handoff' and required limit 1)
     <> public.current_user_id() then raise exception 'the view shows who ticked'; end if;
  if exists (select 1 from public.deal_gate_missing(dl, 'before_handoff')) then raise exception 'gate accepts ticks'; end if;

  -- Untick one: the gate wants it again.
  delete from public.deal_checklist_checks
   where deal_id = dl and requirement_id = (select requirement_id from public.deal_jacket_checklist
                                             where deal_id = dl and gate = 'before_handoff' and required limit 1);
  if not exists (select 1 from public.deal_gate_missing(dl, 'before_handoff')) then raise exception 'untick reopens the item'; end if;
  insert into public.deal_checklist_checks (deal_id, requirement_id)
  select dl, r.id from public.deal_gate_missing(dl, 'before_handoff') m(label)
    join public.document_requirements r on r.label = m.label and r.company_id = '00000000-0000-0000-0000-0000000000c1'
                                        and r.gate = 'before_handoff'
  on conflict do nothing;

  -- History: stage move, contact edit, checklist ticks, all with who + old → new.
  update public.deals set stage = 'qualified' where id = dl;
  select * into a from public.audit_log where deal_id = dl and table_name = 'deals' and action = 'update'
   order by id desc limit 1;
  if a.before ->> 'stage' <> 'new' or a.after ->> 'stage' <> 'qualified' or a.actor_id <> public.current_user_id() then
    raise exception 'stage move logged old → new + who (%, %)', a.before, a.after; end if;
  if a.after ? 'updated_at' or a.after ? 'stage_entered_at' then raise exception 'bookkeeping columns stay out of History'; end if;
  update public.contacts set phone = '7035550199' where id = c;
  if not exists (select 1 from public.audit_log where deal_id = dl and table_name = 'contacts'
                  and before ->> 'phone' = '7035550100' and after ->> 'phone' = '7035550199') then
    raise exception 'contact edits show on the deal'; end if;
  select count(*) into n from public.audit_log where deal_id = dl and table_name = 'deal_checklist_checks';
  if n < 3 then raise exception 'ticks and unticks are logged (%)', n; end if;
  update public.deals set stage = 'qualified' where id = dl;   -- no real change
  if (select count(*) from public.audit_log where deal_id = dl and table_name = 'deals' and action = 'update') <> 1 then
    raise exception 'an update that changes nothing is not logged'; end if;

  perform public.mark_sold(dl, 4500000);
  raise notice 'OK: hand ticks (who + when) satisfy the gate and Mark sold; untick reopens; History logs old → new + who';
end $$;
select pg_temp.act_as('seed_ahn');
do $$ begin
  if exists (select 1 from public.audit_log where deal_id = current_setting('test.d18')::uuid) then
    raise exception 'another workspace can''t read this deal''s History'; end if;
  begin
    insert into public.deal_checklist_checks (deal_id, requirement_id)
    select current_setting('test.d18')::uuid, id from public.document_requirements limit 1;
    raise exception 'another workspace can''t tick';
  exception when insufficient_privilege or check_violation then null;
            when raise_exception then if sqlerrm <> 'Deal not found' then raise; end if;
  end;
  raise notice 'OK: History and ticks stay inside the deal''s workspace';
end $$;
select pg_temp.act_as('seed_crew');
do $$ begin
  if exists (select 1 from public.audit_log) then raise exception 'crew read no History'; end if;
  raise notice 'OK: crew reads no History';
end $$;
reset role;


-- 0019 (v3 batch C): brands + colors, bulk-add groups, accessories, special work, estimate color ------------
select pg_temp.act_as('seed_tugu');
set role authenticated;
do $$
declare q uuid; d uuid; sky uuid; tp uuid; n int; r record; grp text;
begin
  -- Both brands are loaded, with named Skyline colors that point at the right price group.
  if (select count(distinct pl.vendor) from public.catalog_colors c join public.price_lists pl on pl.id = c.price_list_id) <> 2 then
    raise exception 'two brands with colors'; end if;
  select c.collection_id into sky from public.catalog_colors c join public.price_lists pl on pl.id = c.price_list_id
   where pl.vendor = 'Skyline' and c.code = 'HW';
  if (select colors from public.catalog_collections where id = sky) <> array['HW','HG'] then raise exception 'HW is priced with HG'; end if;
  if (select name from public.catalog_colors where code = 'NB') <> 'Navy Blue' then raise exception 'color names'; end if;
  if (select count(*) from public.catalog_colors c join public.price_lists pl on pl.id = c.price_list_id where pl.vendor = 'Skyline') <> 32 then
    raise exception 'Skyline has 32 colors'; end if;
  -- Prices: list from the vendor sheet, cost = list x 0.35, touch-up kit at full list (excluded from discount).
  select list_price_cents, unit_cost_cents into r from public.catalog_items where collection_id = sky and code = 'B12';
  if r.list_price_cents <> 45600 or r.unit_cost_cents <> 15960 then raise exception 'B12 HW price % / %', r.list_price_cents, r.unit_cost_cents; end if;
  if (select unit_cost_cents from public.catalog_items ci join public.catalog_collections c on c.id = ci.collection_id
       where c.name = 'Skyline Essential & Charm SW/GR' and ci.code = 'TUK') <> 2200 then raise exception 'TUK at full list'; end if;
  -- Groups for bulk add.
  for r in select * from (values ('W3030','wall'), ('B24','base'), ('BBC39','corner'), ('U249624','pantry'), ('V3021DL','vanity'),
                                 ('CM8','accessories'), ('TKC','accessories'), ('CSB36','corner'), ('SD','skip')) v(code, want) loop
    select group_key into grp from public.catalog_items_grouped g join public.catalog_collections c on c.id = g.collection_id
     where c.name = 'Skyline Essential & Charm SW/GR' and g.code = r.code;
    if grp is distinct from r.want and not (r.code = 'SD' and grp is null) then
      raise exception '% should be %, got %', r.code, r.want, grp; end if;
  end loop;
  if exists (select 1 from public.catalog_items_grouped where group_key is null and collection_id is not null) then
    raise exception 'every vendor item has a group (%)', (select string_agg(distinct code, ', ') from public.catalog_items_grouped
                                                         where group_key is null and collection_id is not null); end if;

  -- An estimate: color code + price group; switching brand re-prices cabinets with the same code.
  insert into public.deals (company_id, source, stage, scope, title)
  values ('00000000-0000-0000-0000-0000000000c1', 'manual', 'new', 'kitchen', '0019 deal') returning id into d;
  insert into public.quotes (deal_id, version, name) values (d, 1, 'Estimate') returning id into q;
  select c.collection_id into tp from public.catalog_colors c join public.price_lists pl on pl.id = c.price_list_id
   where pl.vendor = 'TimberPeak' and c.code = 'TSW';
  perform public.set_quote_collection(q, tp);
  insert into public.quote_line_items (quote_id, section_id, category_id, catalog_item_id, collection_id, code, name, qty, unit_cost_cents)
  select q, cc.default_section_id, ci.category_id, ci.id, ci.collection_id, ci.code, ci.name, 2, ci.unit_cost_cents
    from public.catalog_items ci join public.catalog_categories cc on cc.id = ci.category_id
   where ci.collection_id = tp and ci.code = 'B24';
  perform public.set_quote_collection(q, sky);
  update public.quotes set color_code = 'HW' where id = q;
  if (select unit_cost_cents from public.quote_line_items where quote_id = q and code = 'B24')
     <> (select unit_cost_cents from public.catalog_items where collection_id = sky and code = 'B24') then
    raise exception 'B24 re-priced in Skyline HW'; end if;
  if (select color_code from public.quotes where id = q) <> 'HW' then raise exception 'color saved'; end if;

  -- Accessories + special work types are set up per company.
  select count(*) into n from public.estimate_accessories where vendor = 'Skyline';
  if n < 6 then raise exception 'Skyline accessory rows (%)', n; end if;
  if not exists (select 1 from public.catalog_items where collection_id = sky and code = (select code from public.estimate_accessories where vendor = 'Skyline' and key = 'toe_kick')) then
    raise exception 'the Skyline toe kick code exists in its price list'; end if;
  if (select count(*) from public.estimate_special_types) <> 5 then raise exception 'five special work types'; end if;
  raise notice 'OK: Skyline + TimberPeak colors, cost x0.35 (TUK full list), bulk-add groups, color switch re-prices, accessories, special work';
end $$;
-- Config is owner-only: a team member reads but can't change it.
select pg_temp.act_as('seed_ahn');
do $$
declare n int;
begin
  if not exists (select 1 from public.catalog_colors) then raise exception 'team reads colors'; end if;
  update public.estimate_accessories set label = 'x';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'team can''t edit accessories'; end if;
  begin
    insert into public.cabinet_group_rules (company_id, group_key, match_on, pattern)
    values ('00000000-0000-0000-0000-0000000000c1', 'wall', 'code', '^X');
    raise exception 'team can''t add group rules';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: estimate config is read-only for the team';
end $$;
select pg_temp.act_as('seed_crew');
do $$ begin
  if exists (select 1 from public.catalog_colors) or exists (select 1 from public.estimate_accessories) then
    raise exception 'crew read no price config'; end if;
  raise notice 'OK: crew read no colors / accessories';
end $$;
reset role;


-- 0020 (batch C review fixes): locked estimates, atomic color pick, grants ---------------------------------
select pg_temp.act_as('seed_tugu');
set role authenticated;
do $$
declare d uuid; q uuid; tp uuid; sky uuid; wf uuid; r record; n int; msg text;
begin
  insert into public.deals (company_id, source, stage, scope, title)
  values ('00000000-0000-0000-0000-0000000000c1', 'manual', 'new', 'kitchen', '0020 deal') returning id into d;
  insert into public.quotes (deal_id, version, name) values (d, 1, 'E') returning id into q;
  select id into tp from public.catalog_colors where code = 'TSW';
  select id into sky from public.catalog_colors where code = 'SW';
  perform * from public.pick_quote_color(q, tp);
  -- TimberPeak: 2 x B24 + 3 x filler (WF342).
  perform public.add_quote_item(q, (select id from public.catalog_items where collection_id = (select collection_id from public.quotes where id = q) and code = 'B24'), 2);
  wf := public.accessory_item('00000000-0000-0000-0000-0000000000c1', 'filler', 'TimberPeak', (select collection_id from public.quotes where id = q));
  perform public.add_quote_item(q, wf, 3);
  -- Switch to Skyline Shaker White in one call: B24 re-priced, filler moved to F342 with the same qty.
  for r in select * from public.pick_quote_color(q, sky) loop
    if r.code = 'WF342' and r.status <> 'moved' then raise exception 'WF342 reported as %', r.status; end if;
  end loop;
  if (select color_code from public.quotes where id = q) <> 'SW' then raise exception 'color saved'; end if;
  if exists (select 1 from public.quote_line_items where quote_id = q and code = 'WF342') then raise exception 'old filler removed'; end if;
  if (select qty from public.quote_line_items where quote_id = q and code = 'F342') <> 3 then raise exception 'filler qty moved'; end if;
  if (select unit_cost_cents from public.quote_line_items where quote_id = q and code = 'B24')
     <> (select ci.unit_cost_cents from public.catalog_items ci join public.catalog_colors c on c.collection_id = ci.collection_id
          where c.code = 'SW' and ci.code = 'B24') then raise exception 'B24 re-priced'; end if;

  -- Archived: no line changes (add, change, delete) and no color change.
  update public.quotes set archived_at = now() where id = q;
  begin perform public.add_quote_item(q, wf, 1); raise exception 'add on archived';
  exception when check_violation then null; end;
  begin delete from public.quote_line_items where quote_id = q; raise exception 'delete on archived';
  exception when check_violation then null; end;
  begin perform * from public.pick_quote_color(q, tp); raise exception 'color on archived';
  exception when check_violation then null; end;
  begin update public.quotes set color_code = 'X' where id = q; raise exception 'color column on archived';
  exception when check_violation then null; end;
  update public.quotes set archived_at = null where id = q;   -- restore works

  -- Approved: color locked too (0002 locked pricing only).
  update public.quotes set status = 'approved' where id = q;
  begin update public.quotes set color_code = 'GR' where id = q; raise exception 'color on approved';
  exception when check_violation then null; end;
  raise notice 'OK: one-call color pick (re-price + accessory moved); archived / approved estimates locked in the database';
end $$;
do $$ begin
  begin perform public.sync_collection_colors('00000000-0000-0000-0000-0000000000c1'); raise exception 'sync is server-only';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: sync_collection_colors is service-role only';
end $$;
reset role;
set role anon;
do $$ begin
  begin perform public.cabinet_group_of('00000000-0000-0000-0000-0000000000c1', 'W3030', 'Cabinets'); raise exception 'anon can call cabinet_group_of';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: anon can''t probe group rules';
end $$;
reset role;

-- 0021 job PM: phase tasks, status/% in step, board moves, comments, site rules ---------------------
select pg_temp.act_as('seed_tugu');
set role authenticated;
do $$
declare d uuid := '00000000-0000-0000-0000-0000000000d2'; j uuid; t uuid; n int; st text; pc int;
begin
  j := public.start_job(d);
  select count(*) into n from public.tasks where project_id = j and phase_key is not null;
  if n <> (select count(*) from public.job_phase_templates where company_id = public.current_company_id() and active) or n < 9 then
    raise exception 'one task per active phase, got %', n; end if;
  if exists (select 1 from public.tasks where project_id = j and phase_key is not null and (start_on is null or end_on < start_on)) then
    raise exception 'phase tasks are planned with dates'; end if;
  -- % and status stay in step.
  select id into t from public.tasks where project_id = j and phase_key = 'demo';
  update public.tasks set pct = 40 where id = t;
  select status, pct into st, pc from public.tasks where id = t;
  if st <> 'doing' then raise exception '40%% → doing, got %', st; end if;
  update public.tasks set pct = 100 where id = t;
  if (select status from public.tasks where id = t) <> 'done' or (select done_at from public.tasks where id = t) is null then
    raise exception '100%% → done + done_at'; end if;
  update public.tasks set status = 'doing' where id = t;
  if (select pct from public.tasks where id = t) <> 90 or (select done_at from public.tasks where id = t) is not null then
    raise exception 'reopen → 90%%, done_at cleared'; end if;
  begin update public.tasks set pct = 120 where id = t; raise exception 'pct over 100';
  exception when check_violation then null; end;
  -- Board move: earlier phases done, this one doing; moving back reopens later ones.
  perform public.move_job_to_phase(j, 'countertop_install');
  if exists (select 1 from public.tasks x where x.project_id = j and x.phase_key is not null
               and x.sort_order < (select sort_order from public.tasks where project_id = j and phase_key = 'countertop_install')
               and x.status <> 'done') then raise exception 'earlier phases done'; end if;
  if (select status from public.tasks where project_id = j and phase_key = 'countertop_install') <> 'doing' then raise exception 'phase doing'; end if;
  perform public.move_job_to_phase(j, 'cabinet_install');
  if (select status from public.tasks where project_id = j and phase_key = 'countertop_template') <> 'todo' then raise exception 'moving back reopens'; end if;
  begin perform public.move_job_to_phase(j, 'nope'); raise exception 'unknown phase';
  exception when others then if sqlerrm not like '%no nope phase%' then raise; end if; end;
  -- Comments + site rules (both land in the deal's History).
  insert into public.task_comments (task_id, body) values (t, 'Demo done, dumpster full');
  begin insert into public.task_comments (task_id, body) values (t, '   '); raise exception 'empty comment';
  exception when check_violation then null; end;
  insert into public.site_rules (deal_id, building_type, loud_until, gate_code) values (d, 'condo', '17:00', '#1234');
  if (select company_id from public.site_rules where deal_id = d) <> public.current_company_id() then raise exception 'rules company filled'; end if;
  if not exists (select 1 from public.audit_log where deal_id = d and table_name = 'task_comments') then raise exception 'comment in History'; end if;
  if not exists (select 1 from public.audit_log where deal_id = d and table_name = 'site_rules') then raise exception 'rules in History'; end if;
  raise notice 'OK: jobs get one dated task per phase; status/%% stay in step; board move sets phases; comments + site rules logged';
end $$;
-- Another workspace sees none of it and can't move the job.
select pg_temp.act_as('seed_ahn');
do $$ begin
  if exists (select 1 from public.task_comments) or exists (select 1 from public.site_rules where deal_id = '00000000-0000-0000-0000-0000000000d2') then
    raise exception 'other workspace sees comments / rules'; end if;
  begin
    perform public.move_job_to_phase((select id from public.projects where deal_id = '00000000-0000-0000-0000-0000000000d2'), 'demo');
    raise exception 'other workspace moved the job';
  exception when insufficient_privilege then null; end;
  begin insert into public.site_rules (deal_id, notes) values ('00000000-0000-0000-0000-0000000000d2', 'x'); raise exception 'other ws wrote rules';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: another workspace can''t see or change job comments, site rules or phases';
end $$;
select pg_temp.act_as('seed_crew');
do $$ begin
  if exists (select 1 from public.task_comments) or exists (select 1 from public.site_rules) then raise exception 'crew sees team-only PM data'; end if;
  raise notice 'OK: crew sees no team PM data (crew views come in batch F1)';
end $$;
reset role;

-- 0022 worker + customer logins: money-free views only ----------------------------------------------
reset role;
do $$
declare j uuid := (select id from public.projects where deal_id = '00000000-0000-0000-0000-0000000000d2');
        crew uuid := (select id from public.users where clerk_id = 'seed_crew');
        other_deal uuid; contact uuid;
begin
  update public.users set trade_key = 'installer' where id = crew;
  update public.tasks set assignee_id = crew where project_id = j and phase_key = 'cabinet_install';
  -- a second job the worker is not on
  select id into other_deal from public.deals where company_id = '00000000-0000-0000-0000-0000000000c1'
     and id <> '00000000-0000-0000-0000-0000000000d2' and contact_id is not null and deleted_at is null
     and contact_id <> (select contact_id from public.deals where id = '00000000-0000-0000-0000-0000000000d2') limit 1;
  insert into public.projects (company_id, deal_id, name, contract_value) values ('00000000-0000-0000-0000-0000000000c1', other_deal, 'Other job', 4000000);
  select contact_id into contact from public.deals where id = '00000000-0000-0000-0000-0000000000d2';
  insert into public.users (company_id, clerk_id, name, role, contact_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'seed_customer', 'Client', 'customer', contact);
  insert into public.users (company_id, clerk_id, name, role, contact_id)
  values ('00000000-0000-0000-0000-0000000000c1', 'seed_customer2', 'Other client', 'customer',
          (select contact_id from public.deals where id = other_deal));
  begin
    insert into public.users (company_id, clerk_id, name, role) values ('00000000-0000-0000-0000-0000000000c1', 'x_cust', 'X', 'customer');
    raise exception 'customer needs a contact';
  exception when check_violation then null; end;
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name in ('job_worker_view', 'job_worker_tasks', 'job_worker_visit', 'job_customer_view', 'job_customer_tasks')
              and column_name ~ '(cent|price|cost|value|amount|ballpark|margin)') then
    raise exception 'a worker/customer view has a money column'; end if;
  raise notice 'OK: worker/customer views carry no money columns; a customer login needs its contact';
end $$;
set role authenticated;
select pg_temp.act_as('seed_crew');
do $$
declare j uuid; my_task uuid; other uuid;
begin
  if (select count(*) from public.deals) + (select count(*) from public.projects) + (select count(*) from public.tasks)
     + (select count(*) from public.payments) + (select count(*) from public.costs) + (select count(*) from public.quotes)
     + (select count(*) from public.site_visits) + (select count(*) from public.contacts) <> 0 then
    raise exception 'crew reads a base table with money'; end if;
  if (select count(*) from public.job_worker_view) <> 1 then raise exception 'worker sees exactly their one job, got %', (select count(*) from public.job_worker_view); end if;
  select project_id into j from public.job_worker_view;
  if (select deal_id from public.job_worker_view) <> '00000000-0000-0000-0000-0000000000d2' then raise exception 'the right job'; end if;
  if exists (select 1 from public.job_worker_tasks where project_id <> j) then raise exception 'tasks of other jobs'; end if;
  select id into my_task from public.job_worker_tasks w where w.mine;
  select id into other from public.job_worker_tasks w where not w.mine limit 1;
  if other is null then raise exception 'test needs a task that is not mine'; end if;
  perform public.worker_update_task(my_task, 60, null);
  if (select pct from public.job_worker_tasks where id = my_task) <> 60 then raise exception 'worker set %%'; end if;
  begin perform public.worker_update_task(other, 50, null); raise exception 'worker changed someone else''s task';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.site_rules) <> 1 then raise exception 'worker reads the job''s site rules'; end if;
  insert into public.task_comments (task_id, body) values (my_task, 'Uppers hung');
  if (select count(*) from public.task_comments) < 2 then raise exception 'worker reads the job''s comments'; end if;
  raise notice 'OK: crew reads only job_worker_* views (1 job, its tasks, rules, comments), changes only own task %%';
end $$;
reset role;
do $$
declare y text; n text;
begin
  select deal_year::text, deal_number into y, n from public.deals where id = '00000000-0000-0000-0000-0000000000d2';
  perform set_config('t.path_ok', '00000000-0000-0000-0000-0000000000c1/' || y || '/' || n || '/photos/a.jpg', false);
  perform set_config('t.path_bad', '00000000-0000-0000-0000-0000000000c1/' || y || '/' || n || '/contract/a.pdf', false);
end $$;
set role authenticated;
do $$ begin
  if not public.can_upload_deal_path(current_setting('t.path_ok')) then raise exception 'worker uploads job photos'; end if;
  if public.can_upload_deal_path(current_setting('t.path_bad')) then raise exception 'worker uploads into contract folder'; end if;
  insert into public.deal_files (deal_id, folder, photo_tag, title, storage_path, mime_type, size_bytes)
  values ('00000000-0000-0000-0000-0000000000d2', 'photos', 'completion', 'Uppers', current_setting('t.path_ok'), 'image/jpeg', 1000);
  if not exists (select 1 from public.deal_files where storage_path = current_setting('t.path_ok')) then raise exception 'worker sees own photo'; end if;
  begin
    insert into public.deal_files (deal_id, folder, title, storage_path, mime_type, size_bytes)
    values ('00000000-0000-0000-0000-0000000000d2', 'contract', 'x', current_setting('t.path_bad'), 'application/pdf', 1000);
    raise exception 'worker added a contract file';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: worker uploads photos to their job only';
end $$;
select pg_temp.act_as('seed_customer');
do $$ begin
  if (select count(*) from public.deals) + (select count(*) from public.projects) + (select count(*) from public.tasks)
     + (select count(*) from public.payments) + (select count(*) from public.contacts) + (select count(*) from public.task_comments)
     + (select count(*) from public.site_rules) + (select count(*) from public.job_worker_view) <> 0 then
    raise exception 'customer reads team data'; end if;
  if (select count(*) from public.job_customer_view) <> 1 then raise exception 'customer sees their job'; end if;
  if (select count(*) from public.job_customer_tasks) < 9 then raise exception 'customer sees the schedule'; end if;
  begin perform public.worker_update_task((select id from public.job_customer_tasks limit 1), 10, null); raise exception 'customer edits tasks';
  exception when insufficient_privilege then null; end;
  if public.can_upload_deal_path(current_setting('t.path_ok')) then raise exception 'customer uploads'; end if;
  raise notice 'OK: customer sees only their own job + schedule (no team data, no edits)';
end $$;
select pg_temp.act_as('seed_customer2');
do $$ begin
  if exists (select 1 from public.job_customer_view where name <> 'Other job') or (select count(*) from public.job_customer_view) <> 1 then
    raise exception 'customer 2 sees only the other job'; end if;
  raise notice 'OK: one customer never sees another customer''s job';
end $$;
reset role;

-- 0023 daily reports ---------------------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('seed_crew');
do $$
declare j uuid := (select project_id from public.job_worker_view limit 1);
        my_t uuid := (select id from public.job_worker_tasks w where w.mine limit 1);
        other uuid := (select id from public.job_worker_tasks w where not w.mine limit 1);
        r uuid; r2 uuid;
begin
  r := public.submit_daily_report(j, jsonb_build_array(jsonb_build_object('task_id', my_t, 'pct', 80)),
         jsonb_build_array(jsonb_build_object('type', 'missing_material', 'note', 'Short 2 fillers', 'needs_reorder', true)),
         'Finish uppers, start crown');
  if (select pct from public.job_worker_tasks where id = my_t) <> 80 then raise exception 'report set task %%'; end if;
  if (select count(*) from public.daily_report_issues where report_id = r and needs_reorder) <> 1 then raise exception 'issue saved'; end if;
  r2 := public.submit_daily_report(j, jsonb_build_array(jsonb_build_object('task_id', my_t, 'pct', 90)),
         jsonb_build_array(jsonb_build_object('type', 'missing_material', 'note', 'Short 2 fillers', 'needs_reorder', true)), 'Crown');
  if r2 <> r or (select count(*) from public.daily_reports) <> 1 or (select count(*) from public.daily_report_issues) <> 1 then
    raise exception 'one report per job, person and day (resubmit replaces)'; end if;
  begin perform public.submit_daily_report(j, jsonb_build_array(jsonb_build_object('task_id', other, 'pct', 50)), '[]', null);
        raise exception 'worker reported on someone else''s task';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_daily_report(j, '[]', jsonb_build_array(jsonb_build_object('type', 'nope', 'note', 'x')), null);
        raise exception 'unknown issue type';
  exception when check_violation then null; end;
  begin perform public.submit_daily_report((select id from public.projects limit 0), '[]', '[]', null); raise exception 'no job';
  exception when insufficient_privilege then null; end;
  begin insert into public.daily_reports (company_id, project_id, author_id, report_date) values (public.current_company_id(), j, public.current_user_id(), current_date);
        raise exception 'direct insert';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: daily report updates own task %%, saves issues, one per day; no other tasks, types or direct writes';
end $$;
select pg_temp.act_as('seed_customer');
do $$ begin
  if exists (select 1 from public.daily_reports) or exists (select 1 from public.daily_report_issues) then raise exception 'customer reads reports'; end if;
  begin perform public.submit_daily_report((select project_id from public.job_customer_view limit 1), '[]', '[]', null); raise exception 'customer reported';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: customers neither read nor submit daily reports';
end $$;
select pg_temp.act_as('seed_ahn');
do $$ begin
  if exists (select 1 from public.daily_reports) then raise exception 'other workspace reads reports'; end if;
end $$;
select pg_temp.act_as('seed_tugu');
do $$
declare d uuid := '00000000-0000-0000-0000-0000000000d2'; i uuid;
begin
  if (select count(*) from public.daily_reports) <> 1 then raise exception 'team reads the report'; end if;
  if not exists (select 1 from public.audit_log where deal_id = d and table_name = 'daily_reports') then raise exception 'report in History'; end if;
  if (select owner_id from public.deals where id = d) is not null
     and not exists (select 1 from public.notifications where kind = 'job_issue' and deal_id = d) then raise exception 'owner told about the re-order'; end if;
  select id into i from public.daily_report_issues limit 1;
  update public.daily_report_issues set resolved_at = now() where id = i;
  if (select resolved_by from public.daily_report_issues where id = i) is distinct from public.current_user_id() then raise exception 'resolved by me'; end if;
  begin update public.daily_report_issues set note = 'edited' where id = i; raise exception 'team edited the worker''s issue';
  exception when check_violation then null; end;
  raise notice 'OK: team reads reports, gets notified, resolves issues (can''t rewrite them); report in History';
end $$;
reset role;

-- 0024 photo categories ------------------------------------------------------------------------------
set role authenticated;
select pg_temp.act_as('seed_tugu');
do $$
declare y text; n text; p text;
begin
  if (select count(*) from public.photo_categories where company_id = public.current_company_id()) <> 8 then raise exception '8 default categories'; end if;
  if exists (select 1 from public.deal_files where folder = 'photos' and photo_tag not in (select key from public.photo_categories)) then
    raise exception 'every photo has a category'; end if;
  select deal_year::text, deal_number into y, n from public.deals where id = '00000000-0000-0000-0000-0000000000d2';
  p := '00000000-0000-0000-0000-0000000000c1/' || y || '/' || n || '/photos/cat-test.jpg';
  insert into public.deal_files (deal_id, folder, photo_tag, title, storage_path, mime_type, size_bytes, thumb_path)
  values ('00000000-0000-0000-0000-0000000000d2', 'photos', null, 'x', p, 'image/jpeg', 10, '00000000-0000-0000-0000-0000000000c1/t.jpg');
  if (select photo_tag from public.deal_files where storage_path = p) <> 'other' then raise exception 'no tag → Other'; end if;
  update public.deal_files set photo_tag = 'plumbing' where storage_path = p;           -- re-tag
  begin update public.deal_files set photo_tag = 'sketch' where storage_path = p; raise exception 'old tag accepted';
  exception when check_violation then null; end;
  insert into public.photo_categories (company_id, key, label, min_required) values (public.current_company_id(), 'cabinets', 'Cabinets', 2);
  update public.deal_files set photo_tag = 'cabinets' where storage_path = p;
  update public.photo_categories set active = false where key = 'cabinets';
  begin update public.deal_files set photo_tag = 'cabinets' where storage_path = p; -- unchanged: allowed
  exception when check_violation then raise exception 'unchanged tag on an inactive category must stay'; end;
  begin update public.photo_categories set active = false where key = 'other'; raise exception 'Other turned off';
  exception when check_violation then null; end;
  begin delete from public.photo_categories where key = 'other'; raise exception 'Other deleted';
  exception when check_violation then null; end;
  if not exists (select 1 from public.audit_log where table_name = 'deal_files' and before ->> 'photo_tag' = 'other' and after ->> 'photo_tag' = 'plumbing') then
    raise exception 're-tag in History'; end if;
  raise notice 'OK: photo categories from the database; old tags mapped; re-tag logged; Other always on';
end $$;
select pg_temp.act_as('seed_crystal');
do $$ begin
  update public.photo_categories set label = 'x' where key = 'before';
  if exists (select 1 from public.photo_categories where label = 'x') then raise exception 'team edited categories'; end if;
  raise notice 'OK: only the owner edits photo categories';
end $$;
reset role;

reset role;
\echo ALL RULE TESTS PASSED
