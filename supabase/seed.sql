-- Demo data for local development (`supabase db reset`). Not for production.
-- One rep account with RenoDesign as partner and 8 deals across the lifecycle.
-- Clerk ids starting with seed_ are placeholders: sign in with your real Clerk
-- user and the app creates your own company (bootstrap_owner), separate from this one.

insert into public.companies (id, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'Tugu — kitchen sales (demo)');
insert into public.users (id, company_id, clerk_id, name, email, role, is_default_owner) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'seed_tugu', 'Tugu', 'tugu@example.com', 'owner', true);
select public.seed_company_defaults('00000000-0000-0000-0000-0000000000c1');

-- Crystal's optional partner login
insert into public.users (id, company_id, clerk_id, name, email, role, partner_id)
select '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'seed_crystal', 'Crystal',
       'crystal@example.com', 'partner', p.id
from public.partners p where p.company_id = '00000000-0000-0000-0000-0000000000c1' and p.name = 'RenoDesign Inc.';
update public.partners set phone = '(703) 555-0142', license_number = '[DPOR LICENSE #]', license_class = 'B'
 where company_id = '00000000-0000-0000-0000-0000000000c1';

insert into public.contacts (id, company_id, name, phone, address, city) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000c1', 'Maria Gonzalez', '(571) 555-0101', null, 'Springfield'),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-0000000000c1', 'Ahmed Rahimi',   '(703) 555-0102', null, 'Burke'),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-0000000000c1', 'Raj Patel',      '(703) 555-0103', '8812 Oak Hollow Ln', 'Fairfax'),
  ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-0000000000c1', 'Grace Lee',      '(571) 555-0104', '4120 Maple Ridge Ct', 'Fairfax'),
  ('00000000-0000-0000-0000-000000000c05', '00000000-0000-0000-0000-0000000000c1', 'David Chen',     '(703) 555-0105', '1509 Laurel Glen Rd', 'Vienna'),
  ('00000000-0000-0000-0000-000000000c06', '00000000-0000-0000-0000-0000000000c1', 'Min Kim',        '(571) 555-0106', '602 Cedar Pointe Dr', 'Centreville'),
  ('00000000-0000-0000-0000-000000000c07', '00000000-0000-0000-0000-0000000000c1', 'Sun Park',       '(703) 555-0107', '77 Brookfield Ct', 'Annandale'),
  ('00000000-0000-0000-0000-000000000c08', '00000000-0000-0000-0000-0000000000c1', 'Linh Nguyen',    '(571) 555-0108', null, 'Alexandria');

-- created_at drives the deal number year (Eastern Time): all 2026 → 26-1001 …
insert into public.deals (id, company_id, contact_id, source, stage, scope, title, budget_min_cents, budget_max_cents,
                          timeline, estimated_value_cents, created_at, year_built, first_response_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c07', 'marketplace', 'ready',   'cabinets_only', 'Park cabinets', 300000, 500000, 'asap', 420000, '2026-09-02 19:00-04', 1994, '2026-09-02 19:03-04'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c06', 'fb_group',    'ready',   'kitchen',       'Kim kitchen',   3000000, 4500000, '1_3_months', 3850000, '2026-09-10 18:00-04', 1988, '2026-09-10 18:20-04'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c05', 'referral',    'ready',   'kitchen',       'Chen kitchen',  3500000, 4500000, '1_3_months', 4000000, '2026-09-21 17:30-04', 2002, '2026-09-21 18:45-04'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c04', 'marketplace', 'ready',   'kitchen',       'Lee kitchen',   3500000, 4000000, '3_6_months', 3850000, '2026-10-09 19:10-04', 1979, '2026-10-09 19:12-04'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c03', 'fb_group',    'visit_booked', 'cabinets_only', 'Patel cabinets', 600000, 900000, '1_3_months', null, '2026-10-19 20:00-04', null, '2026-10-19 20:04-04'),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c02', 'fb_group',    'qualified', 'cabinets_only', 'Rahimi cabinets', null, null, 'later', null, '2026-10-21 21:00-04', null, '2026-10-21 21:30-04'),
  ('00000000-0000-0000-0000-0000000000d7', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c08', 'marketplace', 'estimate', 'kitchen',      'Nguyen kitchen', null, null, null, 2600000, '2026-10-01 18:00-04', null, '2026-10-01 18:10-04'),
  ('00000000-0000-0000-0000-0000000000d8', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000c01', 'marketplace', 'new',     'kitchen',       'Gonzalez kitchen', null, null, null, null, now() - interval '2 hours', null, null);

-- Lost: price
update public.deals set stage = 'lost', lost_reason = 'price' where id = '00000000-0000-0000-0000-0000000000d7';

-- Patel's visit tonight at 6:00 PM Eastern
insert into public.meetings (company_id, deal_id, kind, starts_at, ends_at, booked_via)
select '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d5', 'visit',
       ((now() at time zone 'America/New_York')::date + time '18:00') at time zone 'America/New_York',
       ((now() at time zone 'America/New_York')::date + time '19:30') at time zone 'America/New_York', 'link';

-- File the hand-off checklist for the 4 "ready" deals (what the jacket's Add buttons do).
insert into public.deal_files (deal_id, folder, photo_tag, storage_path, mime_type, size_bytes, requirement_id, title)
select d.id, r.folder, case when r.folder = 'photos' then 'before' end,
       d.company_id || '/' || d.deal_year || '/' || d.deal_number || '/' || r.folder || '/' || gen_random_uuid() || '.jpg',
       'image/jpeg', 250000, r.id, r.label
from public.deals d
join public.document_requirements r on r.company_id = d.company_id and r.gate = 'before_handoff' and r.required
where d.id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2',
               '00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000d4');

-- Hand off Park (cabinets plan), Kim + Chen (kitchens plan). Lee stays "ready".
update public.deals d
   set partner_id = p.id,
       commission_plan_id = cp.id,
       handed_off_at = d.created_at + interval '10 days'
  from public.partners p
  join public.commission_plans cp on cp.partner_id = p.id
 where p.company_id = d.company_id
   and ((d.id = '00000000-0000-0000-0000-0000000000d1' and cp.name like 'Cabinets only%')
     or (d.id in ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3') and cp.name like 'Kitchens%'));

-- What Crystal reported
update public.deals set job_status = 'completed', sold_price_cents = 420000,
       deposit_received_at = '2026-09-15 12:00-04', paid_in_full_at = '2026-09-30 12:00-04'
 where id = '00000000-0000-0000-0000-0000000000d1';
update public.deals set job_status = 'ordered', sold_price_cents = 3850000,
       deposit_received_at = now() - interval '16 days'
 where id = '00000000-0000-0000-0000-0000000000d2';
update public.deals set job_status = 'signed', sold_price_cents = 4000000,
       partner_updated_at = now() - interval '8 days'
 where id = '00000000-0000-0000-0000-0000000000d3';
update public.deals set partner_updated_at = now() - interval '8 days', next_follow_up_at = now() - interval '1 day'
 where id = '00000000-0000-0000-0000-0000000000d3';

-- Commission received on Park ($336, Zelle)
insert into public.commission_payments (company_id, deal_id, amount_cents, paid_on, method, reference)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 33600, '2026-10-02', 'zelle', 'Zelle 8F2K');

-- My business money
insert into public.business_expenses (company_id, spent_on, amount_cents, category, vendor, note) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-10-05', 7499, 'samples', 'TimberPeak', 'Door sample set');
insert into public.mileage_trips (company_id, trip_on, miles, purpose, deal_id) values
  ('00000000-0000-0000-0000-0000000000c1', '2026-10-09', 24.0, 'Site visit — Lee', '00000000-0000-0000-0000-0000000000d4'),
  ('00000000-0000-0000-0000-0000000000c1', '2026-09-22', 18.5, 'Site visit — Chen', '00000000-0000-0000-0000-0000000000d3');

-- A few touches on the timeline
insert into public.activities (company_id, deal_id, type, direction, summary, occurred_at) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 'fb_msg', 'in',  'Asked about a full kitchen, L-shape, starting after the holidays', '2026-10-09 19:10-04'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 'visit',  'out', 'Measured 10×12 L-shape, 24 photos, appliances reused', '2026-10-14 18:00-04'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d6', 'fb_msg', 'in',  'Wants cabinets only, maybe spring', '2026-10-21 21:00-04');
