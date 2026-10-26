-- =====================================================================
-- 0011_texts.sql — ready-made texts for each step of a deal.
--   1. text_templates: my message sequence (editable in Settings → Texts).
--      {first} {me} {brand} {partner_contact} {when} {link} {booking} are filled in the app.
--   2. text_sends: which template I sent on which deal (stable key, not the label),
--      so the app knows the next text in the sequence.
--   3. Defaults for every company (new ones via seed_company_defaults), plus
--      estimate follow-ups at 14 and 30 days.
-- New tables only; no applied table is altered.
-- =====================================================================

create table public.text_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null check (length(btrim(label)) between 1 and 60),
  body        text not null check (length(btrim(body)) between 1 and 640),
  stage_key   text,                                              -- null = any stage, only when I pick it
  after_days  int check (after_days between 0 and 365),          -- null = never suggested on its own
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (company_id, key)
);
alter table public.text_templates enable row level security;
create policy text_templates_owner on public.text_templates for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create table public.text_sends (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  deal_id       uuid not null references public.deals (id) on delete cascade,
  template_key  text not null,
  sent_at       timestamptz not null default now(),
  created_by    uuid references public.users (id) on delete set null
);
create index text_sends_deal_idx on public.text_sends (deal_id, sent_at desc);
alter table public.text_sends enable row level security;
create policy text_sends_owner on public.text_sends for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- ---------------------------------------------------------------------
-- Defaults. Short (one screen, one ask), first name, who I am, one next step.
-- ---------------------------------------------------------------------
create or replace function public.seed_text_templates(p_company uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.text_templates (company_id, key, label, stage_key, after_days, sort_order, body) values
    (p_company, 'on_my_way',     'On my way',          'visit_booked', 0,    10,
     'Hi {first}, this is {me} from {brand}. I''m on my way to our meeting at your place. See you soon!'),
    (p_company, 'running_late',  'Running late',       'visit_booked', null, 20,
     'Hi {first}, it''s {me} from {brand}. I''m running about 15 minutes late, sorry about that. See you shortly.'),
    (p_company, 'confirm_visit', 'Confirm the visit',  'visit_booked', null, 30,
     'Hi {first}, it''s {me} from {brand}. Just confirming our kitchen visit {when}. Does that still work for you?'),
    (p_company, 'thanks_visit',  'Thanks for today',   'visit_done',   0,    40,
     'Thanks for having me today, {first}! I''ll put your kitchen estimate together and send it within 2 days.'),
    (p_company, 'estimate_sent', 'Here''s the estimate', 'estimate',   0,    50,
     'Hi {first}, here''s your kitchen estimate: {link} Take a look, and text me with any questions.'),
    (p_company, 'check_2',       'Any questions?',     'estimate',     2,    60,
     'Hi {first}, did you get a chance to look over the estimate? Any questions I can answer?'),
    (p_company, 'check_5',       'Want changes?',      'estimate',     5,    70,
     'Hi {first}, anything you''d like to change in the estimate? Style, layout or budget, I can adjust it.'),
    (p_company, 'check_14',      'Still planning?',    'estimate',     14,   80,
     'Hi {first}, it''s {me} from {brand}. Is the kitchen still on your list? Happy to rework the plan if anything changed.'),
    (p_company, 'last_try',      'Close the file?',    'estimate',     30,   90,
     'Hi {first}, I don''t want to keep bugging you. Should I close your file for now, or check back in a few months?'),
    (p_company, 'handoff_intro', 'Next: the contract', 'handed_off',   0,    100,
     'Great news, {first}! {partner_contact} from our office will call you to set up the contract and schedule. I''m still here if you need anything.'),
    (p_company, 'referral',      'Ask for a referral', 'handed_off',   null, 110,
     'Hi {first}, hope you''re loving the new kitchen! If you know anyone thinking about a remodel, I''d really appreciate the referral.')
  on conflict (company_id, key) do nothing;

  -- The estimate sequence runs to 30 days (first rule stays +2 days).
  insert into public.follow_up_rules (company_id, stage_key, sequence, offset_days, offset_hours, description) values
    (p_company, 'estimate', 3, 14, 0, 'Still planning?'),
    (p_company, 'estimate', 4, 30, 0, 'Last try: close the file?')
  on conflict (company_id, stage_key, sequence) do nothing;
  update public.follow_up_rules
     set description = 'Text "on my way" before the visit'
   where company_id = p_company and stage_key = 'visit_booked' and sequence = 1
     and description = 'Confirm the visit the day before';
end $$;
revoke execute on function public.seed_text_templates(uuid) from public, anon, authenticated;
grant execute on function public.seed_text_templates(uuid) to service_role;

-- New accounts get them too (same body as 0007 + the texts).
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

  perform public.seed_text_templates(p_company);
end $$;
revoke execute on function public.seed_company_defaults(uuid) from public, anon, authenticated;
grant execute on function public.seed_company_defaults(uuid) to service_role;

-- Existing accounts
select public.seed_text_templates(id) from public.companies;
