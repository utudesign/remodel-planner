-- =====================================================================
-- 0007_sales_setup.sql — glue between 0001 and the handoff migrations.
--   1. Full deal guard (needs 0005/0006 columns): lost reason, hand-off moves
--      the stage, partner-update timestamp, deleted deals drop off the queue.
--   2. rep_year_summary() with a fractional mileage rate (IRS 2026 = 72.5¢).
--   3. seed_company_defaults(): everything a new account needs.
--   4. bootstrap_owner(): first sign-in creates the rep's company.
-- 0002–0006 are untouched (tested handoff files).
-- =====================================================================

alter table public.deals add column if not exists partner_updated_at timestamptz;

-- ---------------------------------------------------------------------
-- 1. Deal guard (replaces the 0001 version; same trigger)
-- ---------------------------------------------------------------------
create or replace function private.deals_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  v_handed text;
begin
  select s.kind into v_kind from public.pipeline_stages s
   where s.company_id = new.company_id and s.key = new.stage;
  if v_kind is null and not private.is_system() then
    raise exception 'Unknown stage "%"', new.stage using errcode = 'check_violation';
  end if;

  -- Hand-off (validated by 0006's deals_handoff, which runs before this trigger)
  -- moves the deal to the company's hand-off stage.
  if new.handed_off_at is not null and (tg_op = 'INSERT' or old.handed_off_at is null) then
    select s.key into v_handed from public.pipeline_stages s
     where s.company_id = new.company_id and s.kind = 'handed_off' and s.active
     order by s.sort_order limit 1;
    if v_handed is not null then
      new.stage := v_handed;
      v_kind := 'handed_off';
    end if;
  end if;

  if v_kind = 'lost' and nullif(btrim(coalesce(new.lost_reason, '')), '') is null then
    raise exception 'A lost reason is required' using errcode = 'check_violation';
  end if;
  if v_kind is distinct from 'lost' then
    new.lost_reason := null;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is null then
      select u.id into new.owner_id from public.users u
       where u.company_id = new.company_id and u.is_default_owner and u.active;
    end if;
    if new.next_follow_up_at is null then
      new.next_follow_up_at := private.next_follow_up(new.company_id, new.stage, coalesce(new.created_at, now()));
    end if;
  else
    if new.stage is distinct from old.stage then
      new.stage_entered_at := now();
      new.next_follow_up_at := private.next_follow_up(new.company_id, new.stage, now());
    end if;
    if (new.job_status, new.sold_price_cents, new.change_orders_cents, new.partner_gross_profit_cents,
        new.deposit_received_at, new.paid_in_full_at, new.job_completed_at, new.cancelled_at, new.partner_note)
       is distinct from
       (old.job_status, old.sold_price_cents, old.change_orders_cents, old.partner_gross_profit_cents,
        old.deposit_received_at, old.paid_in_full_at, old.job_completed_at, old.cancelled_at, old.partner_note) then
      new.partner_updated_at := now();
      -- the next "ask the partner" nudge is a week after their last update
      if v_kind = 'handed_off' then
        new.next_follow_up_at := private.next_follow_up(new.company_id, new.stage, now());
      end if;
    end if;
    new.updated_at := now();
  end if;

  if v_kind = 'lost' or new.deleted_at is not null or new.paid_in_full_at is not null
     or new.cancelled_at is not null then
    new.next_follow_up_at := null;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 2. Year summary with a fractional mileage rate (cents per mile, e.g. 72.5)
-- ---------------------------------------------------------------------
create or replace function public.rep_year_summary(p_year int, p_rate_cents_per_mile numeric)
returns table (commissions_paid_cents bigint, commissions_owed_cents bigint, commissions_pipeline_cents bigint,
               expenses_cents bigint, miles numeric, mileage_deduction_cents bigint, net_cents bigint)
language sql stable security invoker set search_path = public as $$
  with s as (select * from public.rep_year_summary(p_year, 0))
  select s.commissions_paid_cents, s.commissions_owed_cents, s.commissions_pipeline_cents,
         s.expenses_cents, s.miles,
         round(s.miles * p_rate_cents_per_mile)::bigint,
         (s.commissions_paid_cents - s.expenses_cents - round(s.miles * p_rate_cents_per_mile))::bigint
  from s
$$;

-- ---------------------------------------------------------------------
-- 3. Everything a new account needs. Idempotent; service role only.
--    (The TimberPeak price list is imported by the app at sign-up from
--    supabase/seed/timberpeak-msrp-sheets.json via import_price_list().)
-- ---------------------------------------------------------------------
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
           'mileage_rate_cents', 72.5,      -- IRS 2026 business rate; check every January
           'tax_set_aside_pct', 30,         -- income tax + ~15.3% self-employment tax
           'workday', jsonb_build_object('days', jsonb_build_array(1,2,3,4,5), 'start', '07:00', 'end', '15:30'),
           'digest_time', '15:30',
           'booking', jsonb_build_object(
             'minutes', 90,
             'weekday', jsonb_build_object('start', '17:30', 'end', '20:00'),
             'saturday', jsonb_build_object('start', '09:00', 'end', '17:00'))
         ) || settings_json
   where id = p_company;

  -- The partner and placeholder plans (edit them to match the written agreement).
  select id into v_partner from public.partners where company_id = p_company and name = 'RenoDesign Inc.';
  if v_partner is null then
    insert into public.partners (company_id, name, contact_name)
    values (p_company, 'RenoDesign Inc.', 'Crystal') returning id into v_partner;
  end if;
  insert into public.commission_plans (company_id, partner_id, name, basis, rate, first_payout_pct, min_cents) values
    (p_company, v_partner, 'Kitchens 5% (50% at deposit)',                  'contract_price', 0.05, 0.5, 0),
    (p_company, v_partner, 'Cabinets only 8% (all at deposit, $250 floor)', 'contract_price', 0.08, 1.0, 25000)
  on conflict (partner_id, name) do nothing;
end $$;
revoke execute on function public.seed_company_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_company_defaults(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 4. First sign-in: create the rep's company + owner row (service role only).
--    Returns (user_id, company_id, created). Existing users are returned as-is.
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_owner(
  p_clerk_user_id text, p_name text, p_email text, p_company_name text default null)
returns table (user_id uuid, company_id uuid, created boolean)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_company uuid;
begin
  select u.id, u.company_id into v_user, v_company from public.users u where u.clerk_id = p_clerk_user_id;
  if v_user is not null then
    update public.users set name = coalesce(nullif(p_name, ''), name), email = coalesce(p_email, email), active = true
     where id = v_user;
    return query select v_user, v_company, false;
    return;
  end if;
  insert into public.companies (name)
  values (coalesce(nullif(p_company_name, ''), nullif(p_name, '') || ' — kitchen sales', 'My kitchen sales'))
  returning id into v_company;
  insert into public.users (company_id, clerk_id, name, email, role, is_default_owner)
  values (v_company, p_clerk_user_id, nullif(p_name, ''), p_email, 'owner', true)
  returning id into v_user;
  perform public.seed_company_defaults(v_company);
  return query select v_user, v_company, true;
end $$;
revoke execute on function public.bootstrap_owner(text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_owner(text, text, text, text) to service_role;

-- ---------------------------------------------------------------------
-- 5. Speed to lead: the first reply I log (call, text, message, email out)
--    stamps first_response_at (0005 column); every touch moves the follow-up.
-- ---------------------------------------------------------------------
create or replace function private.activities_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type in ('call', 'text', 'email', 'fb_msg', 'visit') then
    update public.deals d
       set last_touch_at = greatest(coalesce(d.last_touch_at, new.occurred_at), new.occurred_at),
           first_response_at = case
             when d.first_response_at is null and new.direction = 'out' then new.occurred_at
             else d.first_response_at end,
           next_follow_up_at = case
             when d.next_follow_up_at is null then null   -- lost / paid / cancelled stay off the queue
             else private.next_follow_up(d.company_id, d.stage, new.occurred_at) end
     where d.id = new.deal_id;
  end if;
  return null;
end $$;
