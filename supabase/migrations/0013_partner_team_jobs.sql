-- =====================================================================
-- 0013_partner_team_jobs.sql — Crystal works in the app; jobs get a timeline.
-- Decisions (Tugu, 2026-10-26; docs/DECISIONS.md):
--   * The partner login (Crystal) is a team member of the rep's company: she sees every deal,
--     creates deals and estimates, books visits, uploads photos, uses the texts.
--     The rep's money (expenses, mileage, recording commission payments), settings,
--     partners/plans and share links stay owner-only. She sees the commission on deals.
--   * Deals she creates are RenoDesign's own (origin = 'partner'): never a commission,
--     never handed off; they become a job when she marks the contract signed.
--   * On the rep's deals she still changes only job progress + price (0006 rule).
--   * Jobs (the contractor module, CONTEXT §5 "projects"): one per deal, with milestones
--     (planned / done dates), tasks and costs. Milestone list + cost categories are config.
-- Replaces 0006's partner guard and 0001/0002's is_team(); no applied migration is edited.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Crystal is part of the team
-- ---------------------------------------------------------------------
create or replace function public.is_team()
returns boolean language sql stable set search_path = public as $$
  select coalesce(public.current_app_role() in ('owner', 'team', 'partner'), false)
$$;

-- Her deals vs mine
alter table public.deals
  add column if not exists origin text not null default 'rep' check (origin in ('rep', 'partner'));

-- A deal she creates is RenoDesign's own deal (no plan, no hand-off, hers to manage).
create or replace function private.deals_origin_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.current_app_role() = 'partner' then
    new.origin := 'partner';
    new.partner_id := public.current_partner_id();
    new.owner_id := public.current_user_id();
    new.commission_plan_id := null;
    new.handed_off_at := null;
  end if;
  if new.origin = 'partner' and (new.commission_plan_id is not null or new.handed_off_at is not null) then
    raise exception 'RenoDesign''s own deals have no commission and are not handed off' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger deals_aa_origin before insert on public.deals
  for each row execute function private.deals_origin_insert();

-- Updates: on the rep's deals the partner changes only job fields (0006); on her own deals
-- anything but who owns it. Her deal leaves the sales pipeline once the contract is signed.
create or replace function public.deals_partner_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_handed text;
begin
  if new.origin is distinct from old.origin then
    raise exception 'A deal''s origin can''t change' using errcode = 'check_violation';
  end if;
  if public.current_app_role() = 'partner' then
    if old.origin = 'partner' then
      if (new.partner_id, new.commission_plan_id, new.handed_off_at, new.company_id)
         is distinct from (old.partner_id, old.commission_plan_id, old.handed_off_at, old.company_id) then
        raise exception 'Partners can''t change who a deal belongs to' using errcode = 'insufficient_privilege';
      end if;
    elsif (to_jsonb(new) - array['job_status','sold_price_cents','change_orders_cents','partner_gross_profit_cents',
                                  'deposit_received_at','paid_in_full_at','job_completed_at','cancelled_at','partner_note',
                                  'updated_at','partner_updated_at'])
          is distinct from
          (to_jsonb(old) - array['job_status','sold_price_cents','change_orders_cents','partner_gross_profit_cents',
                                  'deposit_received_at','paid_in_full_at','job_completed_at','cancelled_at','partner_note',
                                  'updated_at','partner_updated_at']) then
      raise exception 'Partners can only update job progress and price' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.origin = 'partner' then
    if new.commission_plan_id is not null or new.handed_off_at is not null then
      raise exception 'RenoDesign''s own deals have no commission and are not handed off' using errcode = 'check_violation';
    end if;
    -- Won: contract signed (or later) moves her deal to the "with partner" stage.
    if old.job_status = 'not_started' and new.job_status not in ('not_started', 'cancelled') then
      select s.key into v_handed from public.pipeline_stages s
       where s.company_id = new.company_id and s.kind = 'handed_off' and s.active
       order by s.sort_order limit 1;
      if v_handed is not null then new.stage := v_handed; end if;
    end if;
  end if;
  return new;
end $$;

-- The deal's form answers and the texts are team data now.
create policy deal_intake_team_read on public.deal_intake for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy text_templates_team_read on public.text_templates for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy text_sends_team on public.text_sends for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());

-- "Show the client": the team can share estimates (was owner-only in 0009).
create or replace function public.share_quote(p_quote_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare q public.quotes%rowtype;
begin
  if not public.is_team() then
    raise exception 'Only the team can share estimates' using errcode = '42501';
  end if;
  select * into q from public.quotes where id = p_quote_id and company_id = public.current_company_id() for update;
  if not found then raise exception 'Estimate not found'; end if;
  if (select line_count from public.quote_totals where quote_id = q.id) = 0 then
    raise exception 'This estimate has no items yet';
  end if;
  if q.doc_number is null then
    q.doc_number := public.next_deal_doc_number(q.deal_id, 'E');
  end if;
  update public.quotes
     set doc_number = q.doc_number,
         status = case when status = 'draft' then 'sent' else status end,
         sent_at = coalesce(sent_at, now())
   where id = q.id;
  return q.doc_number;
end $$;
revoke execute on function public.share_quote(uuid) from public, anon;
grant execute on function public.share_quote(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Jobs: one project per deal, milestones, tasks, costs
-- ---------------------------------------------------------------------
create unique index if not exists projects_deal_unique on public.projects (deal_id) where deal_id is not null;

create table public.job_milestone_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null,
  plan_days   int not null default 0 check (plan_days between 0 and 365), -- planned date = start + days
  sort_order  int not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

create table public.job_milestones (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  key         text not null,
  label       text not null,
  sort_order  int not null default 0,
  planned_on  date,
  done_on     date,
  unique (project_id, key)
);
create index job_milestones_open_idx on public.job_milestones (company_id, planned_on) where done_on is null;

create table public.job_cost_categories (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  unique (company_id, key)
);

alter table public.job_milestone_templates enable row level security;
alter table public.job_milestones          enable row level security;
alter table public.job_cost_categories     enable row level security;
create policy job_milestone_templates_read on public.job_milestone_templates for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy job_milestone_templates_owner on public.job_milestone_templates for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
create policy job_milestones_team on public.job_milestones for all to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
create policy job_cost_categories_read on public.job_cost_categories for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy job_cost_categories_owner on public.job_cost_categories for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create or replace function public.seed_job_defaults(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.job_milestone_templates (company_id, key, label, plan_days, sort_order) values
    (p_company, 'contract_signed',     'Contract signed',        0, 10),
    (p_company, 'deposit',             'Deposit received',       0, 20),
    (p_company, 'final_measure',       'Final measure',          3, 30),
    (p_company, 'design_approved',     'Design approved',        7, 40),
    (p_company, 'cabinets_ordered',    'Cabinets ordered',       8, 50),
    (p_company, 'cabinets_delivered',  'Cabinets delivered',    28, 60),
    (p_company, 'demo',                'Demo',                  30, 70),
    (p_company, 'cabinet_install',     'Cabinets installed',    32, 80),
    (p_company, 'countertop_template', 'Countertop template',   34, 90),
    (p_company, 'countertop_install',  'Countertops installed', 45, 100),
    (p_company, 'hookups',             'Plumbing + appliances', 46, 110),
    (p_company, 'walkthrough',         'Final walkthrough',     48, 120),
    (p_company, 'paid_full',           'Paid in full',          50, 130)
  on conflict (company_id, key) do nothing;
  insert into public.job_cost_categories (company_id, key, label, sort_order) values
    (p_company, 'cabinets',    'Cabinets',              10),
    (p_company, 'countertops', 'Countertops',           20),
    (p_company, 'install',     'Install labor',         30),
    (p_company, 'plumbing',    'Plumbing',              40),
    (p_company, 'electrical',  'Electrical',            50),
    (p_company, 'materials',   'Materials + hardware',  60),
    (p_company, 'delivery',    'Delivery',              70),
    (p_company, 'permit',      'Permit',                80),
    (p_company, 'design',      'Design',                90),
    (p_company, 'other',       'Other',                100)
  on conflict (company_id, key) do nothing;
end $$;
revoke execute on function public.seed_job_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_job_defaults(uuid) to service_role;

-- Start the job for a deal (idempotent): project + milestones planned from today.
create or replace function public.start_job(p_deal uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare d record; v_project uuid;
begin
  if not public.is_team() then
    raise exception 'Only the team can start a job' using errcode = '42501';
  end if;
  select id, company_id, origin, handed_off_at, job_status, title, contact_id,
         coalesce(sold_price_cents, 0) + change_orders_cents as value
    into d from public.deals
   where id = p_deal and company_id = public.current_company_id() and deleted_at is null;
  if not found then raise exception 'Deal not found'; end if;
  if d.handed_off_at is null and not (d.origin = 'partner' and d.job_status <> 'not_started') then
    raise exception 'A job starts after the hand-off (or, for RenoDesign''s own deals, once the contract is signed)'
      using errcode = 'check_violation';
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

-- New accounts get the job lists too (0011 body + seed_job_defaults).
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
end $$;
revoke execute on function public.seed_company_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_company_defaults(uuid) to service_role;

select public.seed_job_defaults(id) from public.companies;
