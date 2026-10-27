-- =====================================================================
-- 0015_one_company.sql — RenoDesign's own tool (Tugu, 2026-10-27; docs/DECISIONS.md).
-- One company tracks every sale from the first contact to the end of the job.
-- No hand-off to a partner, no commission.
--   1. Everyone signs in as a team member (role 'team'); old partner logins become team.
--      The owner (Tugu) keeps Settings and invites.
--   2. Team invites (More → Team) replace partner invites.
--   3. "Sold" replaces the hand-off: mark_sold() checks the job-ready checklist, records the
--      sold price (and deposit), moves the deal to Sold and starts the job timeline.
--   4. Labels: Ready to hand off → Contract + deposit, Handed off → Sold. Sold deals have no
--      sales follow-up (job steps take over). Hand-off texts → welcome text.
--   5. The company is RenoDesign; its license moves to the company settings.
-- The partner / commission tables stay (nothing is deleted); the app stops using them.
-- No applied migration is edited.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Partner logins become team members
-- ---------------------------------------------------------------------
update public.users set role = 'team', partner_id = null where role = 'partner';

-- ---------------------------------------------------------------------
-- 2. Team invites
-- ---------------------------------------------------------------------
create table public.team_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  email        text not null check (email = lower(email) and email like '%@%'),
  name         text,
  invited_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references public.users (id),
  unique (company_id, email)
);
alter table public.team_invites enable row level security;
create policy team_invites_owner on public.team_invites for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Pending partner invites carry over (Crystal may not have signed in yet).
insert into public.team_invites (company_id, email, name, invited_at)
select company_id, email, name, invited_at from public.partner_invites where accepted_at is null
on conflict (company_id, email) do nothing;

-- First sign-in with an invited email: create the team login. Service role only.
create or replace function public.accept_team_invite(p_clerk_user_id text, p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.team_invites%rowtype; v_user uuid;
begin
  select * into v_inv from public.team_invites
   where email = lower(p_email) and accepted_at is null
   order by invited_at desc limit 1;
  if not found then return null; end if;
  insert into public.users (company_id, clerk_id, name, email, role)
  values (v_inv.company_id, p_clerk_user_id, coalesce(nullif(p_name, ''), v_inv.name), lower(p_email), 'team')
  on conflict (clerk_id) do update set active = true
  returning id into v_user;
  update public.team_invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_user;
end $$;
revoke execute on function public.accept_team_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.accept_team_invite(text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 3. Sold (replaces the hand-off)
-- ---------------------------------------------------------------------
alter table public.deals add column if not exists sold_at timestamptz;

-- A job starts once the deal is sold (older hand-offs and signed partner deals still count).
create or replace function public.start_job(p_deal uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_project uuid;
begin
  if not public.is_team() then
    raise exception 'Only the team can start a job' using errcode = '42501';
  end if;
  select id, company_id, origin, handed_off_at, sold_at, job_status, title, contact_id,
         coalesce(sold_price_cents, 0) + change_orders_cents as value
    into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null;
  if not found then raise exception 'Deal not found'; end if;
  if d.sold_at is null and d.handed_off_at is null
     and not (d.origin = 'partner' and d.job_status <> 'not_started') then
    raise exception 'Mark the deal sold first' using errcode = 'check_violation';
  end if;
  select id into v_project from public.projects where deal_id = p_deal;
  if v_project is null then
    insert into public.projects (company_id, deal_id, contact_id, name, status, contract_value)
    values (d.company_id, d.id, d.contact_id, d.title, 'active', nullif(d.value, 0))
    returning id into v_project;
    insert into public.job_milestones (company_id, project_id, key, label, sort_order, planned_on)
    select d.company_id, v_project, t.key, t.label, t.sort_order, current_date + t.plan_days
      from public.job_milestone_templates t
     where t.company_id = d.company_id and t.active
    on conflict (project_id, key) do nothing;
  end if;
  return v_project;
end $$;
revoke execute on function public.start_job(uuid) from public, anon;
grant execute on function public.start_job(uuid) to authenticated;

-- Mark sold: the job-ready checklist must be complete and the price set. Then the deal moves
-- to the Sold stage, the job starts and "Contract signed" (+ "Deposit received") are ticked.
create or replace function public.mark_sold(p_deal uuid, p_price_cents bigint,
                                            p_signed_on date default null, p_deposit_on date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_missing text; v_sold text; v_project uuid; v_tz text;
begin
  if not public.is_team() then
    raise exception 'Only the team can mark a deal sold' using errcode = '42501';
  end if;
  select id, company_id, sold_at into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null
   for update;
  if not found then raise exception 'Deal not found'; end if;
  if coalesce(p_price_cents, 0) <= 0 then
    raise exception 'Enter the sold price' using errcode = 'check_violation';
  end if;
  select string_agg(m, ', ') into v_missing from public.deal_gate_missing(p_deal, 'before_handoff') m;
  if v_missing is not null then
    raise exception 'Job-ready checklist is missing: %', v_missing using errcode = 'check_violation';
  end if;
  select s.key into v_sold from public.pipeline_stages s
   where s.company_id = d.company_id and s.kind = 'handed_off' and s.active
   order by s.sort_order limit 1;
  if v_sold is null then
    raise exception 'Add a Sold stage in Settings → Pipeline' using errcode = 'check_violation';
  end if;
  select timezone into v_tz from public.companies where id = d.company_id;

  update public.deals
     set sold_price_cents    = p_price_cents,
         sold_at             = coalesce(sold_at, now()),
         job_status          = case when job_status = 'not_started' then 'signed' else job_status end,
         deposit_received_at = coalesce(deposit_received_at,
                                 case when p_deposit_on is not null
                                      then (p_deposit_on + time '12:00') at time zone v_tz end),
         stage               = v_sold
   where id = p_deal;

  v_project := public.start_job(p_deal);
  update public.projects set contract_value = p_price_cents where id = v_project;
  update public.job_milestones
     set done_on = coalesce(done_on, p_signed_on, (now() at time zone v_tz)::date)
   where project_id = v_project and key = 'contract_signed';
  if p_deposit_on is not null then
    update public.job_milestones set done_on = coalesce(done_on, p_deposit_on)
     where project_id = v_project and key = 'deposit';
  end if;
  return v_project;
end $$;
revoke execute on function public.mark_sold(uuid, bigint, date, date) from public, anon;
grant execute on function public.mark_sold(uuid, bigint, date, date) to authenticated;

-- Only Mark sold (or an older hand-off) moves a deal into the Sold stage: the checklist can't be skipped.
create or replace function private.deals_sold_gate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_new text; v_old text;
begin
  if new.stage is distinct from old.stage then
    select kind into v_new from public.pipeline_stages where company_id = new.company_id and key = new.stage;
    select kind into v_old from public.pipeline_stages where company_id = new.company_id and key = old.stage;
    if v_new = 'handed_off' and v_old is distinct from 'handed_off'
       and new.sold_at is null and new.handed_off_at is null
       and not (new.origin = 'partner' and new.job_status <> 'not_started') then
      raise exception 'Use Mark sold on the Job tab: it checks the job-ready checklist first' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger deals_sold_gate before update on public.deals
  for each row execute function private.deals_sold_gate();

-- Sold (and lost) deals have no sales follow-up: the job steps take over.
create or replace function private.next_follow_up(p_company uuid, p_stage text, p_from timestamptz)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select case
    when s.kind in ('lost', 'handed_off') then null
    else p_from + coalesce(
      (select make_interval(days => r.offset_days, hours => r.offset_hours)
         from public.follow_up_rules r
        where r.company_id = p_company and r.stage_key = p_stage
        order by r.sequence limit 1),
      interval '1 day')
  end
  from (select coalesce((select kind from public.pipeline_stages
                          where company_id = p_company and key = p_stage), 'open') as kind) s
$$;

-- ---------------------------------------------------------------------
-- 4 + 5. One-company labels, texts, name and license (idempotent; only touches defaults)
-- ---------------------------------------------------------------------
create or replace function public.seed_one_company(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_partner public.partners%rowtype;
begin
  update public.pipeline_stages set label = 'Contract + deposit'
   where company_id = p_company and key = 'ready' and label = 'Ready to hand off';
  update public.pipeline_stages set label = 'Sold'
   where company_id = p_company and key = 'handed_off' and label = 'Handed off';
  update public.follow_up_rules set description = 'Get the contract signed + deposit'
   where company_id = p_company and stage_key = 'ready' and description = 'Hand off to the partner';
  delete from public.follow_up_rules
   where company_id = p_company and stage_key = 'handed_off' and description = 'Ask the partner for an update';

  update public.text_templates
     set label = 'Welcome aboard',
         body  = 'Great news, {first}! Your kitchen is on our schedule. Next is the final measure, and I''ll text you the dates. Thank you for choosing {brand}!'
   where company_id = p_company and key = 'handoff_intro' and body like '%from our office will call you%';

  -- The company is RenoDesign: take the name and license from the RenoDesign partner record.
  select * into v_partner from public.partners
   where company_id = p_company and name ilike 'RenoDesign%' order by created_at limit 1;
  if found then
    update public.companies
       set name = 'RenoDesign',
           settings_json = settings_json
             || jsonb_strip_nulls(jsonb_build_object('license_number', v_partner.license_number,
                                                     'license_class', v_partner.license_class))
     where id = p_company and name is distinct from 'RenoDesign';
  end if;
end $$;
revoke execute on function public.seed_one_company(uuid) from public, anon, authenticated;
grant execute on function public.seed_one_company(uuid) to service_role;

-- New accounts: 0013's body + the one-company step.
create or replace function public.seed_company_defaults(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_partner uuid;
begin
  perform public.seed_sales_defaults(p_company);
  perform public.seed_default_estimating(p_company);
  perform public.seed_default_deal_jacket(p_company);
  perform public.seed_default_handoff(p_company);

  update public.companies
     set settings_json = jsonb_build_object(
           'mileage_rate_cents', 72.5,
           'tax_set_aside_pct', 30,
           'workday', jsonb_build_object('days', jsonb_build_array(1,2,3,4,5), 'start', '07:00', 'end', '15:30'),
           'digest_time', '15:30',
           'booking', jsonb_build_object(
             'minutes', 90,
             'weekday', jsonb_build_object('start', '17:30', 'end', '20:00'),
             'saturday', jsonb_build_object('start', '09:00', 'end', '17:00'))
         ) || settings_json
   where id = p_company;

  -- Kept so older code paths and tests that look for it still work; the app no longer uses it.
  select id into v_partner from public.partners where company_id = p_company and name = 'RenoDesign Inc.';
  if v_partner is null then
    insert into public.partners (company_id, name, contact_name)
    values (p_company, 'RenoDesign Inc.', 'Crystal') returning id into v_partner;
  end if;
  insert into public.commission_plans (company_id, partner_id, name, basis, rate, first_payout_pct, min_cents) values
    (p_company, v_partner, 'Kitchens 5% (50% at deposit)',                  'contract_price', 0.05, 0.5, 0),
    (p_company, v_partner, 'Cabinets only 8% (all at deposit, $250 floor)', 'contract_price', 0.08, 1.0, 25000)
  on conflict (partner_id, name) do nothing;

  perform public.seed_text_templates(p_company);
  perform public.seed_job_defaults(p_company);
  perform public.seed_one_company(p_company);
end $$;
revoke execute on function public.seed_company_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_company_defaults(uuid) to service_role;

select public.seed_one_company(id) from public.companies;

-- Any deal already in the Sold stage drops its sales follow-up.
update public.deals d set next_follow_up_at = null
  from public.pipeline_stages s
 where s.company_id = d.company_id and s.key = d.stage and s.kind = 'handed_off'
   and d.next_follow_up_at is not null;
