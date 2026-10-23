-- =============================================================================
-- Local demo data. Runs after migrations on `supabase db reset`.
-- Demo company "Demo Kitchens" is linked to a Clerk org by running (once, after you create your org):
--   update public.companies set clerk_org_id = 'org_XXXX' where id = '00000000-0000-0000-0000-0000000000c1';
-- Then sign in: you become admin + default owner (seed users don't count as real members).
-- All dates are relative to today (US Eastern) so the Today screen always has something on it.
-- =============================================================================

do $$
declare
  c   uuid := '00000000-0000-0000-0000-0000000000c1';
  u_d uuid := '00000000-0000-0000-0000-0000000000d1';
  u_f uuid := '00000000-0000-0000-0000-0000000000f1';
  today date := (now() at time zone 'America/New_York')::date;
  s_new uuid; s_contacted uuid; s_quote uuid; s_won uuid; s_booked uuid;
  ct1 uuid; ct2 uuid; ct3 uuid; ct4 uuid; ct5 uuid;
  l4 uuid; l5 uuid;
  p1 uuid := '00000000-0000-0000-0000-0000000000a1';
  p2 uuid := '00000000-0000-0000-0000-0000000000a2';
  cat_mat uuid; cat_lab uuid; cat_sub uuid;
  tpl_full uuid; tpl_cab uuid; tpl_tasks uuid;
begin
  insert into public.companies (id, name) values (c, 'Demo Kitchens');
  perform public.seed_company_defaults(c);

  insert into public.users (id, company_id, clerk_id, name, email, role, is_default_owner) values
    (u_d, c, 'seed_designer', 'Dana Designer', 'dana@example.com', 'designer', true),
    (u_f, c, 'seed_field',    'Frank Field',   'frank@example.com', 'field',   false);

  select id into s_new       from public.pipeline_stages where company_id = c and key = 'new';
  select id into s_contacted from public.pipeline_stages where company_id = c and key = 'contacted';
  select id into s_booked    from public.pipeline_stages where company_id = c and key = 'meeting_booked';
  select id into s_quote     from public.pipeline_stages where company_id = c and key = 'quote_sent';
  select id into s_won       from public.pipeline_stages where company_id = c and key = 'won';
  select id into cat_mat from public.cost_categories where company_id = c and key = 'cabinets';
  select id into cat_lab from public.cost_categories where company_id = c and key = 'labor';
  select id into cat_sub from public.cost_categories where company_id = c and key = 'subcontractor';
  select id into tpl_full from public.payment_templates where company_id = c and name = 'Cabinets + counters + install';
  select id into tpl_cab  from public.payment_templates where company_id = c and name = 'Cabinets only';
  select id into tpl_tasks from public.task_templates where company_id = c and is_default;

  -- Contacts -------------------------------------------------------------------
  insert into public.contacts (company_id, name, phone, email, address, city, zip) values
    (c, 'Maria Gonzalez', '(703) 555-0141', 'maria@example.com', '12 Oak St',     'Arlington',  '22201') returning id into ct1;
  insert into public.contacts (company_id, name, phone, email, address, city, zip) values
    (c, 'James Park',     '(571) 555-0188', null,                '840 Elm Ave',   'Fairfax',    '22030') returning id into ct2;
  insert into public.contacts (company_id, name, phone, email, address, city, zip) values
    (c, 'Priya Shah',     '(703) 555-0102', 'priya@example.com', '5 Maple Ct',    'Alexandria', '22314') returning id into ct3;
  insert into public.contacts (company_id, name, phone, email, address, city, zip) values
    (c, 'Tom & Lisa Reed','(703) 555-0177', 'reeds@example.com', '77 Birch Rd',   'Vienna',     '22180') returning id into ct4;
  insert into public.contacts (company_id, name, phone, email, address, city, zip) values
    (c, 'Ahmed Karimi',   '(571) 555-0123', 'ahmed@example.com', '310 Cedar Ln',  'McLean',     '22101') returning id into ct5;

  -- 3 open leads ------------------------------------------------------------------
  insert into public.leads (company_id, contact_id, source, stage_id, owner_id, scope,
                            budget_min_cents, budget_max_cents, desired_timeline, next_follow_up_at, created_at)
  values (c, ct1, 'fb_marketplace', s_new, u_d, 'cabinets', 800000, 1200000, 'Next month',
          now() - interval '30 minutes', now() - interval '90 minutes');

  insert into public.leads (company_id, contact_id, source, stage_id, owner_id, scope,
                            budget_min_cents, budget_max_cents, desired_timeline, next_follow_up_at,
                            stage_entered_at, created_at)
  values (c, ct2, 'referral', s_contacted, u_d, 'full', 2500000, 4000000, 'Spring',
          (today::timestamp + time '14:00') at time zone 'America/New_York',
          now() - interval '3 days', now() - interval '4 days');

  insert into public.leads (company_id, contact_id, source, stage_id, owner_id, scope,
                            budget_min_cents, budget_max_cents, desired_timeline, next_follow_up_at,
                            stage_entered_at, created_at)
  values (c, ct3, 'call', s_quote, u_d, 'full', 3000000, 4500000, 'ASAP',
          now() - interval '1 day', now() - interval '6 days', now() - interval '14 days');

  insert into public.meetings (company_id, lead_id, type, scheduled_at, assignee_id)
  select c, l.id, 'design_review', (today::timestamp + time '16:30') at time zone 'America/New_York', u_d
    from public.leads l where l.contact_id = ct3;

  insert into public.activities (company_id, lead_id, type, direction, summary, created_by, occurred_at)
  select c, l.id, 'call', 'out', 'Left voicemail about the quote', u_d, now() - interval '1 day'
    from public.leads l where l.contact_id = ct3;

  -- Won leads backing the 2 sample projects ---------------------------------------
  insert into public.leads (company_id, contact_id, source, stage_id, owner_id, scope, next_follow_up_at, created_at)
  values (c, ct4, 'web', s_booked, u_d, 'full', now(), now() - interval '40 days') returning id into l4;
  insert into public.leads (company_id, contact_id, source, stage_id, owner_id, scope, next_follow_up_at, created_at)
  values (c, ct5, 'referral', s_booked, u_d, 'cabinets', now(), now() - interval '75 days') returning id into l5;

  -- Project 1: full remodel, starts this week ---------------------------------------
  insert into public.projects (id, company_id, lead_id, contact_id, name, contract_value_cents,
                               payment_template_id, project_manager_id, created_at)
  values (p1, c, l4, ct4, 'Reed kitchen — full remodel', 3600000, tpl_full, u_d, now() - interval '20 days');

  insert into public.milestones (company_id, project_id, key, name, sort_order, planned_date, actual_date)
  select c, p1, d.key, d.label, d.sort_order,
         case d.key when 'materials_ordered' then today - 18
                    when 'materials_delivered' then today - 2
                    when 'project_start' then today + 2
                    when 'mid_check' then today + 12
                    when 'install_complete' then today + 25
                    when 'final_inspection' then today + 28 end,
         case d.key when 'deposit_received' then today - 20
                    when 'materials_ordered' then today - 18 end
    from public.milestone_definitions d where d.company_id = c;

  insert into public.payments (company_id, project_id, label, amount_cents, due_trigger, due_date, received_on, method, check_number, status, sort_order) values
    (c, p1, 'Deposit',             1800000, 'deposit_received', today - 20, today - 20, 'check', '1043', 'received', 1),
    (c, p1, 'Mid-project payment',  900000, 'mid_check',        null,       null,       null,    null,   'pending',  2),
    (c, p1, 'Final payment',        900000, 'final_inspection', null,       null,       null,    null,   'pending',  3);

  insert into public.costs (company_id, project_id, category_id, vendor, description, estimated_amount_cents, actual_amount_cents) values
    (c, p1, cat_mat, 'CabinetCo',    'Shaker cabinets',        1300000, 1340000),
    (c, p1, (select id from public.cost_categories where company_id = c and key = 'countertop'), 'Stone Supply', 'Quartz countertops',      550000, null),
    (c, p1, cat_lab, 'In-house',     'Install crew',            600000, null),
    (c, p1, cat_sub, 'Bright Elec.', 'Electrical rough-in',     180000, null);

  insert into public.tasks (company_id, project_id, milestone_id, title, kind, sort_order, status, assignee_id, due_date)
  select c, p1, m.id, i.title, i.kind, i.sort_order,
         case when i.sort_order <= 4 then 'done' when i.sort_order = 5 then 'blocked' else 'todo' end,
         case when i.sort_order >= 6 then u_f end,
         case when i.sort_order = 5 then today - 1 end
    from public.task_template_items i
    left join public.milestones m on m.project_id = p1 and m.key = i.milestone_key
   where i.template_id = tpl_tasks;
  update public.tasks set description = 'Supplier says 2 boxes back-ordered' where project_id = p1 and sort_order = 5;

  insert into public.project_members (project_id, user_id, company_id) values (p1, u_f, c);

  -- Project 2: cabinets only, at final inspection; final payment overdue ------------
  insert into public.projects (id, company_id, lead_id, contact_id, name, contract_value_cents,
                               payment_template_id, project_manager_id, created_at)
  values (p2, c, l5, ct5, 'Karimi — cabinet replacement', 1450000, tpl_cab, u_d, now() - interval '60 days');

  insert into public.milestones (company_id, project_id, key, name, sort_order, planned_date, actual_date)
  select c, p2, d.key, d.label, d.sort_order,
         case d.key when 'final_inspection' then today - 6 end,
         case when d.sort_order <= 6 then today - 60 + d.sort_order * 8 end
    from public.milestone_definitions d where d.company_id = c;
  -- materials_delivered done → the 30% installment became due (trigger) 3+ days ago.
  insert into public.payments (company_id, project_id, label, amount_cents, due_trigger, due_date, received_on, method, check_number, status, sort_order) values
    (c, p2, 'Deposit at order',    1015000, 'deposit_received',    today - 60, today - 60, 'zelle', null, 'received', 1),
    (c, p2, 'Balance on delivery',  435000, 'materials_delivered', today - 8,  null,       null,    null, 'due',      2);

  insert into public.costs (company_id, project_id, category_id, vendor, description, estimated_amount_cents, actual_amount_cents) values
    (c, p2, cat_mat, 'CabinetCo', 'RTA cabinets', 800000, 815000),
    (c, p2, cat_lab, 'In-house',  'Install',      250000, 230000);

  insert into public.tasks (company_id, project_id, title, kind, status, sort_order) values
    (c, p2, 'Adjust pantry door hinge', 'punch', 'todo', 1),
    (c, p2, 'Touch-up paint on end panel', 'punch', 'done', 2);

  update public.leads set stage_id = s_won where id in (l4, l5);
end $$;
