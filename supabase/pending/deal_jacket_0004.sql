-- =====================================================================
-- 0004_deal_jacket.sql
-- Deal numbers + the deal jacket (everything for one customer job in one place):
--   1. Deal numbers: MMDD + that day's sequence, Eastern Time, restart every year
--      Oct 23 first deal = 10231, second = 10232; Oct 24 first = 10241; Jan 5 first = 01051
--   2. deal_files: photos + documents in fixed folders, stored in the private
--      'deal-files' bucket at {company}/{year}/{deal number}/{folder}/{file}
--   3. Required-document gates (like a car deal jacket): before order / start / close
--   4. Deal recap: contract, change orders, payments, costs, gross profit
--   5. Storage access rules
-- Depends on 0001 (deals, projects, payments, change_orders, costs, site_visits, tasks)
-- and on 0002 (helpers, quotes).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Deal numbers
-- ---------------------------------------------------------------------
alter table public.deals
  add column if not exists deal_year       int,
  add column if not exists deal_date       date,
  add column if not exists deal_seq        int,
  add column if not exists deal_number     text,
  add column if not exists permit_required boolean not null default false,
  add column if not exists deleted_at      timestamptz;

create unique index if not exists deals_number_unique on public.deals (company_id, deal_year, deal_number);
create unique index if not exists projects_one_per_deal on public.projects (deal_id);

-- One row per company per day; only next_deal_number() touches it.
create table public.deal_number_counters (
  company_id  uuid not null references public.companies(id) on delete cascade,
  deal_date   date not null,
  last_seq    int  not null,
  constraint deal_number_counters_pkey primary key (company_id, deal_date)
);
alter table public.deal_number_counters enable row level security;  -- no policies: no direct access
revoke all on public.deal_number_counters from anon, authenticated;

-- Concurrency-safe: the upsert locks the day's row, so two deals opened at the
-- same moment get 10231 and 10232, never the same number.
create or replace function public.next_deal_number(p_company_id uuid, p_at timestamptz default now())
returns table (deal_year int, deal_date date, deal_seq int, deal_number text)
language plpgsql security definer set search_path = public as $$
declare
  v_date date;
  v_seq  int;
begin
  select (p_at at time zone coalesce(c.timezone, 'America/New_York'))::date into v_date
  from public.companies c where c.id = p_company_id;
  if v_date is null then raise exception 'Company % not found', p_company_id; end if;

  insert into public.deal_number_counters as c (company_id, deal_date, last_seq)
  values (p_company_id, v_date, 1)
  on conflict on constraint deal_number_counters_pkey do update set last_seq = c.last_seq + 1
  returning c.last_seq into v_seq;

  return query select extract(year from v_date)::int, v_date, v_seq, to_char(v_date, 'MMDD') || v_seq::text;
end $$;
revoke execute on function public.next_deal_number(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.deals_assign_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare n record;
begin
  if new.deal_number is null then
    select * into n from public.next_deal_number(new.company_id, coalesce(new.created_at, now()));
    new.deal_year := n.deal_year;
    new.deal_date := n.deal_date;
    new.deal_seq := n.deal_seq;
    new.deal_number := n.deal_number;
  end if;
  return new;
end $$;
create trigger deals_number before insert on public.deals
  for each row execute function public.deals_assign_number();

-- Numbers are permanent: never edited, never reused (deals are soft-deleted).
create or replace function public.deals_guard_number()
returns trigger language plpgsql as $$
begin
  if (new.deal_year, new.deal_date, new.deal_seq, new.deal_number)
     is distinct from (old.deal_year, old.deal_date, old.deal_seq, old.deal_number) then
    raise exception 'Deal numbers cannot be changed (deal %)', old.deal_number using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger deals_number_guard before update on public.deals
  for each row execute function public.deals_guard_number();

create or replace function public.is_assigned_to_deal(p_deal_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p
                 where p.deal_id = p_deal_id and public.is_assigned_to_project(p.id))
$$;

-- ---------------------------------------------------------------------
-- 2. Required documents (owner-editable, per company)
-- ---------------------------------------------------------------------
create table public.document_requirements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  gate          text not null check (gate in ('before_order','before_start','before_close')),
  folder        text not null,
  label         text not null,
  required      boolean not null default true,
  applies_when  text not null default 'always' check (applies_when in ('always','permit_required')),
  sort_order    int not null default 0,
  unique (company_id, gate, label)
);

-- ---------------------------------------------------------------------
-- 3. Deal files (photos + documents)
-- ---------------------------------------------------------------------
create table public.deal_files (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  deal_id         uuid not null references public.deals(id) on delete cascade,
  folder          text not null check (folder in
                    ('photos','estimates','design','contract','permits','invoices_receipts',
                     'payments','change_orders','warranty','other')),
  photo_tag       text check (photo_tag in
                    ('before','measurement','sketch','appliance_label','under_sink','panel',
                     'delivery','progress','issue','after','other')),
  title           text,
  storage_path    text not null unique,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  width           int,
  height          int,
  taken_at        timestamptz,
  site_visit_id   uuid references public.site_visits(id) on delete set null,
  quote_id        uuid references public.quotes(id) on delete set null,
  requirement_id  uuid references public.document_requirements(id) on delete set null,
  crew_visible    boolean,
  uploaded_by     uuid references public.users(id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.users(id),
  constraint deal_files_photo_tag check (photo_tag is null or folder = 'photos'),
  -- money documents are never visible to crew
  constraint deal_files_crew_folders check (not coalesce(crew_visible, false)
                                            or folder in ('photos','design','permits','warranty'))
);
create index deal_files_deal on public.deal_files (deal_id, folder, created_at desc);

create or replace function public.deal_files_before_insert()
returns trigger language plpgsql set search_path = public as $$
declare d public.deals%rowtype;
begin
  select * into d from public.deals where id = new.deal_id;
  if not found then raise exception 'Deal % not found', new.deal_id; end if;
  new.company_id := d.company_id;
  if new.storage_path not like d.company_id::text || '/' || d.deal_year || '/' || d.deal_number
                               || '/' || new.folder || '/%' then
    raise exception 'storage_path must start with %/%/%/%/', d.company_id, d.deal_year, d.deal_number, new.folder
      using errcode = 'check_violation';
  end if;
  new.crew_visible := coalesce(new.crew_visible, new.folder in ('photos','design'));
  new.uploaded_by := coalesce(new.uploaded_by, public.current_user_id());
  return new;
end $$;
create trigger deal_files_insert before insert on public.deal_files
  for each row execute function public.deal_files_before_insert();

-- Files are permanent records: only title/tag/requirement/visibility and soft-delete can change.
create or replace function public.deal_files_before_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.deal_id, new.folder, new.storage_path, new.mime_type, new.size_bytes, new.uploaded_by, new.created_at)
     is distinct from (old.deal_id, old.folder, old.storage_path, old.mime_type, old.size_bytes, old.uploaded_by, old.created_at) then
    raise exception 'File records are permanent; upload a new file instead' using errcode = 'check_violation';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := coalesce(new.deleted_by, public.current_user_id());
  end if;
  return new;
end $$;
create trigger deal_files_update before update on public.deal_files
  for each row execute function public.deal_files_before_update();

-- ---------------------------------------------------------------------
-- 4. Jacket checklist + gates
-- ---------------------------------------------------------------------
create view public.deal_jacket_checklist with (security_invoker = true) as
select d.id as deal_id, d.deal_number, r.id as requirement_id, r.gate, r.folder, r.label, r.required, r.sort_order,
       count(f.id) as file_count,
       count(f.id) > 0 as satisfied
from public.deals d
join public.document_requirements r on r.company_id = d.company_id
     and (r.applies_when = 'always' or (r.applies_when = 'permit_required' and d.permit_required))
left join public.deal_files f on f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null
group by d.id, d.deal_number, r.id, r.gate, r.folder, r.label, r.required, r.sort_order;

create or replace function public.deal_gate_missing(p_deal_id uuid, p_gate text)
returns setof text language sql stable security definer set search_path = public as $$
  select r.label
  from public.deals d
  join public.document_requirements r on r.company_id = d.company_id and r.gate = p_gate and r.required
       and (r.applies_when = 'always' or (r.applies_when = 'permit_required' and d.permit_required))
  where d.id = p_deal_id
    and not exists (select 1 from public.deal_files f
                    where f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null)
  order by r.sort_order
$$;

-- Hard gates on the project: no order without the "before order" papers, no close without "before close".
create or replace function public.projects_jacket_gates()
returns trigger language plpgsql set search_path = public as $$
declare v_missing text;
begin
  if new.order_date is not null and old.order_date is null then
    select string_agg(m, ', ') into v_missing from public.deal_gate_missing(new.deal_id, 'before_order') m;
    if v_missing is not null then
      raise exception 'Deal jacket is missing before ordering: %', v_missing using errcode = 'check_violation';
    end if;
  end if;
  if new.closed_at is not null and old.closed_at is null then
    select string_agg(m, ', ') into v_missing from public.deal_gate_missing(new.deal_id, 'before_close') m;
    if v_missing is not null then
      raise exception 'Deal jacket is missing before closing: %', v_missing using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger projects_jacket_gates before update on public.projects
  for each row execute function public.projects_jacket_gates();

-- ---------------------------------------------------------------------
-- 5. Deal recap (financials on one screen, like a car deal recap)
-- ---------------------------------------------------------------------
create view public.deal_recap with (security_invoker = true) as
with co as (
  select project_id, sum(price_change) filter (where approved_at is not null) as co_price,
         sum(cost_change) filter (where approved_at is not null) as co_cost,
         count(*) filter (where approved_at is null) as co_pending
  from public.change_orders group by project_id
),
pay as (
  select project_id,
         sum(amount) filter (where received_at is not null) as collected,
         sum(amount) filter (where received_at is null) as scheduled_open,
         sum(amount) filter (where received_at is null and status = 'overdue') as overdue
  from public.payments group by project_id
),
cst as (
  select project_id, sum(estimated_amount) as est, sum(actual_amount) as act,
         count(*) filter (where actual_amount is null) as costs_without_actual
  from public.costs group by project_id
),
aq as (
  select distinct on (deal_id) deal_id, id as quote_id, approved_price_cents, approved_cost_cents
  from public.quotes where status = 'approved' order by deal_id, approved_at desc
)
select d.id as deal_id, d.deal_year, d.deal_number, d.stage, p.id as project_id,
       aq.quote_id as approved_quote_id,
       aq.approved_price_cents, aq.approved_cost_cents,
       coalesce(p.contract_value, aq.approved_price_cents, 0)::bigint                       as contract_value_cents,
       coalesce(co.co_price, 0)::bigint                                                     as change_orders_cents,
       coalesce(co.co_pending, 0)                                                           as change_orders_pending,
       (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0))::bigint as revenue_cents,
       coalesce(pay.collected, 0)::bigint                                                   as collected_cents,
       (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0)
        - coalesce(pay.collected, 0))::bigint                                               as balance_due_cents,
       coalesce(pay.overdue, 0)::bigint                                                     as overdue_cents,
       (coalesce(cst.est, aq.approved_cost_cents, 0) + coalesce(co.co_cost, 0))::bigint      as estimated_cost_cents,
       cst.act::bigint                                                                      as actual_cost_cents,
       coalesce(cst.costs_without_actual, 0)                                                as costs_without_actual,
       (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0)
        - coalesce(cst.est, aq.approved_cost_cents, 0) - coalesce(co.co_cost, 0))::bigint    as estimated_profit_cents,
       case when cst.act is null then null
            else (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0)
                  - cst.act)::bigint end                                                     as actual_profit_cents,
       case when (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0)) = 0 or cst.act is null
            then null
            else round((coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0) - cst.act)::numeric
                       / (coalesce(p.contract_value, aq.approved_price_cents, 0) + coalesce(co.co_price, 0)), 4) end
                                                                                             as actual_margin
from public.deals d
left join public.projects p on p.deal_id = d.id
left join aq on aq.deal_id = d.id
left join co on co.project_id = p.id
left join pay on pay.project_id = p.id
left join cst on cst.project_id = p.id
where d.deleted_at is null;

-- ---------------------------------------------------------------------
-- 6. Defaults (call at onboarding, like seed_default_estimating)
-- ---------------------------------------------------------------------
create or replace function public.seed_default_deal_jacket(p_company_id uuid)
returns void language sql security invoker set search_path = public as $$
  insert into public.document_requirements (company_id, gate, folder, label, required, applies_when, sort_order)
  values
    (p_company_id, 'before_order', 'contract',          'Signed contract',                          true,  'always',          1),
    (p_company_id, 'before_order', 'design',            'Approved design + cabinet list (signed)',  true,  'always',          2),
    (p_company_id, 'before_order', 'payments',          'Deposit received (check photo / receipt)', true,  'always',          3),
    (p_company_id, 'before_order', 'other',             'Appliance spec sheets',                    false, 'always',          4),
    (p_company_id, 'before_start', 'permits',           'Permit issued',                            true,  'permit_required', 1),
    (p_company_id, 'before_start', 'photos',            'Before photos',                            true,  'always',          2),
    (p_company_id, 'before_close', 'payments',          'Final payment received',                   true,  'always',          1),
    (p_company_id, 'before_close', 'contract',          'Completion sign-off by client',            true,  'always',          2),
    (p_company_id, 'before_close', 'photos',            'After photos',                             true,  'always',          3),
    (p_company_id, 'before_close', 'permits',           'Final inspection passed',                  true,  'permit_required', 4),
    (p_company_id, 'before_close', 'invoices_receipts', 'Sub invoices + lien waivers',              false, 'always',          5),
    (p_company_id, 'before_close', 'warranty',          'Warranty letter sent',                     false, 'always',          6)
  on conflict (company_id, gate, label) do nothing;
$$;
revoke execute on function public.seed_default_deal_jacket(uuid) from public, anon;
grant  execute on function public.seed_default_deal_jacket(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------
alter table public.document_requirements enable row level security;
alter table public.deal_files            enable row level security;

create policy doc_req_read on public.document_requirements for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy doc_req_owner on public.document_requirements for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- Owners + team: everything (no hard delete: soft delete via deleted_at).
create policy deal_files_team_read on public.deal_files for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy deal_files_team_insert on public.deal_files for insert to authenticated
  with check (company_id = public.current_company_id() and public.is_team());
create policy deal_files_team_update on public.deal_files for update to authenticated
  using (company_id = public.current_company_id() and public.is_team())
  with check (company_id = public.current_company_id() and public.is_team());
-- Crew: see crew-visible files of assigned deals; add photos to assigned deals.
create policy deal_files_crew_read on public.deal_files for select to authenticated
  using (company_id = public.current_company_id() and crew_visible and deleted_at is null
         and public.is_assigned_to_deal(deal_id));
create policy deal_files_crew_insert on public.deal_files for insert to authenticated
  with check (company_id = public.current_company_id() and folder = 'photos'
              and public.is_assigned_to_deal(deal_id));

-- ---------------------------------------------------------------------
-- 8. Storage: private bucket 'deal-files', path {company}/{year}/{deal number}/{folder}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('deal-files', 'deal-files', false)
on conflict (id) do nothing;

create policy deal_files_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'deal-files'
         and (storage.foldername(name))[1] = public.current_company_id()::text
         and (public.is_team()
              or exists (select 1 from public.deal_files f
                         where f.storage_path = storage.objects.name and f.crew_visible and f.deleted_at is null
                           and public.is_assigned_to_deal(f.deal_id))));

create policy deal_files_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-files'
              and (storage.foldername(name))[1] = public.current_company_id()::text
              and (public.is_team()
                   or ((storage.foldername(name))[4] = 'photos'
                       and exists (select 1 from public.deals d
                                   where d.company_id = public.current_company_id()
                                     and d.deal_year::text = (storage.foldername(name))[2]
                                     and d.deal_number = (storage.foldername(name))[3]
                                     and public.is_assigned_to_deal(d.id)))));
-- No update/delete policies: stored files are never overwritten or removed from the app.
