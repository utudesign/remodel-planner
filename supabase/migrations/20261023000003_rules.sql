-- =============================================================================
-- 0003 Business rules, automations and RPCs.
--   * Deal guards: follow-up required while open, lost reason required, won only via deposit.
--   * Stage changes are logged as activities.
--   * Milestone done → linked installment becomes "due".
--   * All installments received → "Final Payment" milestone done.
--   * Closed projects: only owners can edit children; every edit is audited.
--   * RPCs: convert_deal_to_project, move_project_to_milestone, close_project.
--   * Company bootstrap + default settings (service role only).
-- =============================================================================

-- Today in the company's timezone (default America/New_York).
create or replace function private.company_today(p_company uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select c.timezone from public.companies c where c.id = p_company), 'America/New_York'))::date
$$;

-- True when running outside a signed-in request (migrations, seed, service-role jobs).
create or replace function private.is_system() returns boolean
language sql stable
as $$ select (auth.jwt() ->> 'sub') is null $$;

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------
create or replace function private.deals_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_key   text;
  v_rule  record;
begin
  select s.key into v_key from public.pipeline_stages s
   where s.id = new.stage_id and s.company_id = new.company_id;
  if v_key is null then
    raise exception 'Stage does not belong to this company' using errcode = 'check_violation';
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is null then
      select u.id into new.owner_id from public.users u
       where u.company_id = new.company_id and u.is_default_owner and u.active;
    end if;
    if new.next_follow_up_at is null and v_key not in ('won', 'lost') then
      select r.offset_days, r.offset_hours into v_rule from public.follow_up_rules r
       where r.stage_id = new.stage_id order by r.sequence limit 1;
      new.next_follow_up_at := now()
        + make_interval(days => coalesce(v_rule.offset_days, 0),
                        hours => coalesce(v_rule.offset_hours, case when v_rule is null then 1 else 0 end));
    end if;
  else
    if new.stage_id is distinct from old.stage_id then
      new.stage_entered_at := now();
    end if;
    new.updated_at := now();
  end if;

  if v_key = 'lost' then
    if new.lost_reason_id is null then
      raise exception 'A lost reason is required' using errcode = 'check_violation';
    end if;
    new.next_follow_up_at := null;
  elsif v_key = 'won' then
    if not exists (select 1 from public.projects p where p.deal_id = new.id) then
      raise exception 'A deal is won only when the deposit is recorded (use “Deposit received”)'
        using errcode = 'check_violation';
    end if;
    new.next_follow_up_at := null;
  else
    new.lost_reason_id := null;
    new.lost_note := null;
    if new.next_follow_up_at is null then
      raise exception 'Open deals need a next follow-up date' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

create trigger deals_guard before insert or update on public.deals
  for each row execute function private.deals_guard();

create or replace function private.deals_log_stage_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_from text; v_to text;
begin
  select label into v_from from public.pipeline_stages where id = old.stage_id;
  select label into v_to   from public.pipeline_stages where id = new.stage_id;
  insert into public.activities (company_id, deal_id, type, summary, created_by)
  values (new.company_id, new.id, 'stage_change', format('%s → %s', v_from, v_to), private.user_id());
  return null;
end $$;

create trigger deals_log_stage_change after update of stage_id on public.deals
  for each row when (old.stage_id is distinct from new.stage_id)
  execute function private.deals_log_stage_change();

-- ---------------------------------------------------------------------------
-- Payments ↔ milestones
-- ---------------------------------------------------------------------------
create or replace function private.milestone_triggers_payments() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.actual_date is not null and old.actual_date is null then
    update public.payments
       set status = 'due', due_date = coalesce(due_date, new.actual_date)
     where project_id = new.project_id and due_trigger = new.key and status = 'pending';
  elsif new.actual_date is null and old.actual_date is not null then
    update public.payments
       set status = 'pending', due_date = null
     where project_id = new.project_id and due_trigger = new.key and status = 'due';
  end if;
  return null;
end $$;

create trigger milestone_triggers_payments after update of actual_date on public.milestones
  for each row execute function private.milestone_triggers_payments();

create or replace function private.payments_final_milestone() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_project uuid := coalesce(new.project_id, old.project_id);
begin
  if exists (select 1 from public.payments where project_id = v_project)
     and not exists (select 1 from public.payments where project_id = v_project and status <> 'received') then
    update public.milestones
       set actual_date = (select max(received_on) from public.payments where project_id = v_project)
     where project_id = v_project and key = 'final_payment' and actual_date is null;
  end if;
  return null;
end $$;

create trigger payments_final_milestone after insert or update of status on public.payments
  for each row execute function private.payments_final_milestone();

-- ---------------------------------------------------------------------------
-- Closed-project lock + audit
-- ---------------------------------------------------------------------------
create or replace function private.closed_project_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_project uuid;
  v_company uuid;
  v_closed  boolean;
begin
  if tg_table_name = 'projects' then
    v_project := coalesce(old.id, new.id);
    v_closed  := tg_op <> 'INSERT' and old.status = 'closed';
    -- close_project() flips status itself; allow that one transition.
    if v_closed is false then return coalesce(new, old); end if;
  else
    v_project := coalesce(new.project_id, old.project_id);
    select p.status = 'closed' into v_closed from public.projects p where p.id = v_project;
  end if;

  if not coalesce(v_closed, false) or private.is_system() then
    return coalesce(new, old);
  end if;

  select p.company_id into v_company from public.projects p where p.id = v_project;

  if private.user_role() is distinct from 'owner' then
    raise exception 'This project is closed. Only an owner can edit it.' using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_log (company_id, actor_id, table_name, record_id, action, before, after)
  values (v_company, private.user_id(), tg_table_name,
          case when tg_table_name = 'projects' then v_project else coalesce(new.id, old.id) end,
          lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects','payments','costs','change_orders','tasks','milestones'] loop
    execute format('create trigger %1$s_closed_guard before insert or update or delete on public.%1$I
                    for each row execute function private.closed_project_guard()', t);
  end loop;
end $$;

-- Role changes are audited too.
create or replace function private.users_audit_role() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (company_id, actor_id, table_name, record_id, action, before, after)
  values (new.company_id, private.user_id(), 'users', new.id, 'role_change',
          jsonb_build_object('role', old.role), jsonb_build_object('role', new.role));
  return null;
end $$;

create trigger users_audit_role after update of role on public.users
  for each row when (old.role is distinct from new.role)
  execute function private.users_audit_role();

-- ---------------------------------------------------------------------------
-- RPC: convert a deal into a project when the deposit arrives (atomic).
-- Installments are computed in TypeScript (lib/payment-schedule.ts) and re-checked here.
-- ---------------------------------------------------------------------------
create or replace function public.convert_deal_to_project(
  p_deal_id              uuid,
  p_name                 text,
  p_contract_value_cents bigint,
  p_payment_template_id  uuid,
  p_task_template_id     uuid,
  p_installments         jsonb,   -- [{label, amount_cents, due_trigger}], first = deposit
  p_deposit_received_on  date,
  p_deposit_method       text,
  p_deposit_check_number text,
  p_planned_start_date   date default null,
  p_project_manager_id   uuid default null
) returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_deal     public.deals%rowtype;
  v_project  uuid;
  v_won      uuid;
  v_sum      bigint;
  v_count    int;
  v_inst     jsonb;
  v_i        int := 0;
begin
  select * into v_deal from public.deals where id = p_deal_id for update;
  if not found then raise exception 'Deal not found'; end if;
  if not private.is_team(v_deal.company_id) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.projects where deal_id = p_deal_id) then
    raise exception 'This deal already has a job started';
  end if;
  if exists (select 1 from public.pipeline_stages where id = v_deal.stage_id and key = 'lost') then
    raise exception 'Lost deals cannot be converted. Move it back to an open stage first.';
  end if;

  select count(*), coalesce(sum((e ->> 'amount_cents')::bigint), 0)
    into v_count, v_sum from jsonb_array_elements(p_installments) e;
  if v_count < 1 then raise exception 'Payment schedule is empty'; end if;
  if v_sum <> p_contract_value_cents then
    raise exception 'Installments (% cents) must add up to the contract value (% cents)', v_sum, p_contract_value_cents;
  end if;

  insert into public.projects (company_id, deal_id, contact_id, name, contract_value_cents,
                               payment_template_id, project_manager_id)
  values (v_deal.company_id, v_deal.id, v_deal.contact_id, p_name, p_contract_value_cents,
          p_payment_template_id, coalesce(p_project_manager_id, v_deal.owner_id))
  returning id into v_project;

  insert into public.milestones (company_id, project_id, key, name, sort_order, planned_date, actual_date)
  select v_deal.company_id, v_project, d.key, d.label, d.sort_order,
         case when d.key = 'project_start' then p_planned_start_date end,
         case when d.key = 'deposit_received' then p_deposit_received_on end
    from public.milestone_definitions d where d.company_id = v_deal.company_id;

  if p_task_template_id is not null then
    insert into public.tasks (company_id, project_id, milestone_id, title, kind, sort_order)
    select v_deal.company_id, v_project, m.id, i.title, i.kind, i.sort_order
      from public.task_template_items i
      join public.task_templates t on t.id = i.template_id and t.company_id = v_deal.company_id
      left join public.milestones m on m.project_id = v_project and m.key = i.milestone_key
     where i.template_id = p_task_template_id;
  end if;

  for v_inst in select * from jsonb_array_elements(p_installments) loop
    v_i := v_i + 1;
    if v_i = 1 then
      insert into public.payments (company_id, project_id, label, amount_cents, due_trigger, due_date,
                                   received_on, method, check_number, status, sort_order)
      values (v_deal.company_id, v_project, v_inst ->> 'label', (v_inst ->> 'amount_cents')::bigint,
              'deposit_received', p_deposit_received_on, p_deposit_received_on, p_deposit_method,
              nullif(p_deposit_check_number, ''), 'received', v_i);
    else
      insert into public.payments (company_id, project_id, label, amount_cents, due_trigger, status, sort_order)
      values (v_deal.company_id, v_project, v_inst ->> 'label', (v_inst ->> 'amount_cents')::bigint,
              nullif(v_inst ->> 'due_trigger', ''), 'pending', v_i);
    end if;
  end loop;

  select id into v_won from public.pipeline_stages where company_id = v_deal.company_id and key = 'won';
  update public.deals set stage_id = v_won where id = v_deal.id;

  insert into public.activities (company_id, deal_id, project_id, type, summary, created_by)
  values (v_deal.company_id, v_deal.id, v_project, 'system',
          'Deposit received. Project created.', private.user_id());

  return v_project;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: move a project on the board. Marks every earlier milestone done (today if no date),
-- clears the target and later ones. Deposit and Closed can't be targeted.
-- ---------------------------------------------------------------------------
create or replace function public.move_project_to_milestone(p_project_id uuid, p_milestone_key text)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_order   int;
  v_today   date;
begin
  select * into v_project from public.projects where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
  if not private.is_team(v_project.company_id) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if v_project.status = 'closed' then raise exception 'This project is closed'; end if;
  if p_milestone_key in ('deposit_received', 'closed') then
    raise exception 'Use Convert to project / Close project for that step';
  end if;

  select sort_order into v_order from public.milestones
   where project_id = p_project_id and key = p_milestone_key;
  if v_order is null then raise exception 'Unknown milestone'; end if;
  v_today := private.company_today(v_project.company_id);

  update public.milestones set actual_date = coalesce(actual_date, v_today)
   where project_id = p_project_id and sort_order < v_order and actual_date is null;
  update public.milestones set actual_date = null
   where project_id = p_project_id and sort_order >= v_order and key not in ('deposit_received', 'closed')
     and actual_date is not null;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: close a project (owner). Enforces the close gate and locks margin.
-- Mirrors lib/close-rule.ts, which renders the same reasons in the UI.
-- ---------------------------------------------------------------------------
create or replace function public.close_project(p_project_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_project    public.projects%rowtype;
  v_revenue    bigint;
  v_collected  bigint;
  v_cost       bigint;
  v_cost_rows  int;
  v_cost_null  int;
  v_open_punch int;
  v_reasons    text[] := '{}';
begin
  select * into v_project from public.projects where id = p_project_id for update;
  if not found then raise exception 'Project not found'; end if;
  if not private.is_owner(v_project.company_id) then
    raise exception 'Only an owner can close a project' using errcode = 'insufficient_privilege';
  end if;
  if v_project.status = 'closed' then raise exception 'Already closed'; end if;

  select v_project.contract_value_cents + coalesce(sum(price_change_cents), 0) into v_revenue
    from public.change_orders where project_id = p_project_id and approved_at is not null;
  select coalesce(sum(amount_cents), 0) into v_collected
    from public.payments where project_id = p_project_id and status = 'received';
  select count(*), count(*) filter (where actual_amount_cents is null), coalesce(sum(actual_amount_cents), 0)
    into v_cost_rows, v_cost_null, v_cost from public.costs where project_id = p_project_id;
  select count(*) into v_open_punch
    from public.tasks where project_id = p_project_id and kind = 'punch' and status <> 'done';

  if v_revenue - v_collected <> 0 then
    v_reasons := v_reasons || format('Balance due is not $0 (%s cents)', v_revenue - v_collected);
  end if;
  if v_open_punch > 0 then
    v_reasons := v_reasons || format('%s punch list item(s) still open', v_open_punch);
  end if;
  if v_cost_rows = 0 then
    v_reasons := v_reasons || 'No costs entered';
  elsif v_cost_null > 0 then
    v_reasons := v_reasons || format('%s cost line(s) missing an actual amount', v_cost_null);
  end if;
  if array_length(v_reasons, 1) > 0 then
    raise exception 'Cannot close: %', array_to_string(v_reasons, '; ') using errcode = 'check_violation';
  end if;

  update public.projects
     set status = 'closed', closed_at = now(), closed_by = private.user_id(),
         locked_revenue_cents = v_revenue, locked_cost_cents = v_cost,
         locked_margin_bps = case when v_revenue = 0 then 0
                                  else round((v_revenue - v_cost) * 10000.0 / v_revenue)::int end
   where id = p_project_id;

  update public.milestones set actual_date = private.company_today(v_project.company_id)
   where project_id = p_project_id and key = 'closed';
end $$;

-- The closed-guard skips projects whose OLD status is active, and milestone updates above run
-- after status = 'closed' — let the owner's closing write through (it is audited, which is fine).

grant execute on function public.convert_deal_to_project(uuid, text, bigint, uuid, uuid, jsonb, date, text, text, date, uuid) to authenticated;
grant execute on function public.move_project_to_milestone(uuid, text) to authenticated;
grant execute on function public.close_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Default settings for a new company (spec §3, §6). Service role / seed only.
-- ---------------------------------------------------------------------------
create or replace function public.seed_company_defaults(p_company uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_stage uuid;
  v_tpl   uuid;
begin
  if exists (select 1 from public.pipeline_stages where company_id = p_company) then
    return; -- already seeded
  end if;

  insert into public.pipeline_stages (company_id, key, label, sort_order) values
    (p_company, 'new',             'New Deal',               1),
    (p_company, 'contacted',       'Contacted / Qualifying', 2),
    (p_company, 'meeting_booked',  'Meeting Booked',         3),
    (p_company, 'meeting_done',    'Initial Meeting Done',   4),
    (p_company, 'quote_sent',      'Design / Quote Sent',    5),
    (p_company, 'design_approved', 'Design Approved',        6),
    (p_company, 'won',             'Won — Deposit Received', 7),
    (p_company, 'lost',            'Lost',                   8);

  insert into public.follow_up_rules (company_id, stage_id, sequence, offset_days, offset_hours, description)
  select p_company, s.id, r.seq, r.d, r.h, r.descr
    from (values
      ('new',             1, 0,  1, 'Respond within 1 hour'),
      ('contacted',       1, 1,  0, 'Follow up +1 day if no reply'),
      ('contacted',       2, 3,  0, 'Follow up +3 days'),
      ('contacted',       3, 7,  0, 'Follow up +7 days'),
      ('meeting_booked',  1, 1,  0, 'Confirm the meeting (remind client 24h before)'),
      ('meeting_done',    1, 5,  0, 'Design due within 5 days'),
      ('quote_sent',      1, 2,  0, 'Follow up +2 days'),
      ('quote_sent',      2, 5,  0, 'Follow up +5 days'),
      ('quote_sent',      3, 10, 0, 'Follow up +10 days'),
      ('design_approved', 1, 0,  2, 'Request the deposit same day')
    ) as r(stage_key, seq, d, h, descr)
    join public.pipeline_stages s on s.company_id = p_company and s.key = r.stage_key;

  insert into public.lost_reasons (company_id, key, label, sort_order) values
    (p_company, 'price',        'Price',                    1),
    (p_company, 'competitor',   'Went with competitor',     2),
    (p_company, 'timing',       'Timing / postponed',       3),
    (p_company, 'no_response',  'No response',              4),
    (p_company, 'out_of_area',  'Out of service area',      5),
    (p_company, 'too_small',    'Scope too small',          6),
    (p_company, 'other',        'Other',                    7);

  -- Cost buckets from the Sales & Estimating Playbook §5 (estimate vs actual per bucket).
  insert into public.cost_categories (company_id, key, label, sort_order) values
    (p_company, 'cabinets',       'Cabinets',        1),
    (p_company, 'countertop',     'Countertop',      2),
    (p_company, 'materials',      'Materials',       3),
    (p_company, 'labor',          'Labor (own crew)',4),
    (p_company, 'subcontractor',  'Subcontractors',  5),
    (p_company, 'job_costs',      'Job costs (permit, delivery, haul-away)', 6),
    (p_company, 'contingency',    'Contingency',     7);

  insert into public.milestone_definitions (company_id, key, label, sort_order) values
    (p_company, 'deposit_received',    'Deposit Received',     1),
    (p_company, 'materials_ordered',   'Materials Ordered',    2),
    (p_company, 'materials_delivered', 'Materials Delivered',  3),
    (p_company, 'project_start',       'Project Start',        4),
    (p_company, 'mid_check',           'Mid-Project Check',    5),
    (p_company, 'install_complete',    'Install Complete',     6),
    (p_company, 'final_inspection',    'Final Inspection',     7),
    (p_company, 'final_payment',       'Final Payment',        8),
    (p_company, 'closed',              'Project Closed',       9);

  -- Payment schedules from the playbook §6.
  insert into public.payment_templates (company_id, name, sort_order)
  values (p_company, 'Cabinets + counters + install', 1) returning id into v_tpl;
  insert into public.payment_template_items (company_id, template_id, label, sort_order, kind, percent_bps, due_trigger) values
    (p_company, v_tpl, 'Deposit at signing',        1, 'percent', 5000, 'deposit_received'),
    (p_company, v_tpl, 'Cabinets installed',        2, 'percent', 2500, 'mid_check'),
    (p_company, v_tpl, 'Final walkthrough',         3, 'percent', 2500, 'final_inspection');

  insert into public.payment_templates (company_id, name, sort_order)
  values (p_company, 'Cabinets only', 2) returning id into v_tpl;
  insert into public.payment_template_items (company_id, template_id, label, sort_order, kind, percent_bps, due_trigger) values
    (p_company, v_tpl, 'Deposit at order',          1, 'percent', 7000, 'deposit_received'),
    (p_company, v_tpl, 'Balance on delivery',       2, 'percent', 3000, 'materials_delivered');

  insert into public.payment_templates (company_id, name, sort_order)
  values (p_company, 'Large full remodel', 3) returning id into v_tpl;
  insert into public.payment_template_items (company_id, template_id, label, sort_order, kind, percent_bps, due_trigger) values
    (p_company, v_tpl, 'Deposit at signing',        1, 'percent', 3000, 'deposit_received'),
    (p_company, v_tpl, 'Project start',             2, 'percent', 3000, 'project_start'),
    (p_company, v_tpl, 'Mid-project',               3, 'percent', 3000, 'mid_check'),
    (p_company, v_tpl, 'Final',                     4, 'percent', 1000, 'final_inspection');

  -- Default install plan from the playbook §7 (pick list phases) + §9 (order & handoff).
  insert into public.task_templates (company_id, name, is_default)
  values (p_company, 'Standard kitchen (playbook)', true) returning id into v_tpl;
  insert into public.task_template_items (company_id, template_id, title, milestone_key, sort_order)
  select p_company, v_tpl, t.title, t.mk, t.ord
    from (values
      ('Client signed design + itemized cabinet list',            'materials_ordered',    1),
      ('Appliance spec sheets on file; openings match',           'materials_ordered',    2),
      ('Permit applied for (or reason not needed noted)',          'materials_ordered',    3),
      ('Order cabinets; check supplier confirmation line by line', 'materials_ordered',    4),
      ('Verify delivery: every code on site, no damage',          'materials_delivered',  5),
      ('Job folder + pick list to crew lead; client prep call',    'project_start',        6),
      ('Protect & demo',                                           'project_start',        7),
      ('Layout, rough-in, LED wire pulled before uppers',         'project_start',        8),
      ('Install cabinets',                                         'mid_check',            9),
      ('Fillers, panels & trim',                                   'mid_check',           10),
      ('Countertop template (client approves seams)',              'mid_check',           11),
      ('Countertop install',                                       'install_complete',    12),
      ('Plumbing & appliance hookup',                              'install_complete',    13),
      ('Electrical finish; test every GFCI',                       'install_complete',    14),
      ('Hardware, adjust doors, clean, photos',                    'final_inspection',    15),
      ('Walkthrough with client; write punch list',                'final_inspection',    16)
    ) as t(title, mk, ord);

  perform v_stage; -- silence unused warning
  perform public.seed_default_deal_jacket(p_company);  -- defined in 0005
end $$;

revoke execute on function public.seed_company_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_company_defaults(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Clerk → DB bootstrap (webhook + first sign-in). Service role only.
-- Creates the company (with defaults) if needed and upserts the member.
-- The first member of a company becomes owner + default deal owner.
-- Existing roles are never overwritten (DB is the source of truth for roles).
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_membership(
  p_clerk_org_id  text,
  p_org_name      text,
  p_clerk_user_id text,
  p_name          text,
  p_email         text,
  p_role          text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_company uuid;
  v_user    uuid;
  v_first   boolean;
begin
  insert into public.companies (clerk_org_id, name)
  values (p_clerk_org_id, coalesce(nullif(p_org_name, ''), 'My company'))
  on conflict (clerk_org_id) do update set name = coalesce(nullif(excluded.name, ''), public.companies.name)
  returning id into v_company;

  perform public.seed_company_defaults(v_company);

  if p_clerk_user_id is null then return null; end if;

  -- Seed/demo users (clerk_id 'seed_%') don't count as real members.
  v_first := not exists (select 1 from public.users
                          where company_id = v_company and clerk_id not like 'seed\_%');
  if v_first then
    update public.users set is_default_owner = false where company_id = v_company;
  end if;

  insert into public.users (company_id, clerk_id, name, email, role, is_default_owner)
  values (v_company, p_clerk_user_id, coalesce(p_name, ''), p_email,
          case when v_first then 'owner' else coalesce(p_role, 'crew') end, v_first)
  on conflict (company_id, clerk_id) do update
     set name = coalesce(nullif(excluded.name, ''), public.users.name),
         email = coalesce(excluded.email, public.users.email),
         active = true
  returning id into v_user;

  return v_user;
end $$;

revoke execute on function public.bootstrap_membership(text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_membership(text, text, text, text, text, text) to service_role;
