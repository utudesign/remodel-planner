-- =============================================================================
-- 0005 Deal numbers + deal jacket (docs/DEALS.md).
-- Adapted from the design handoff's 0004_deal_jacket.sql to this schema
-- (reconciliation approved 2026-10-23, see docs/DECISIONS.md):
--   * helpers: private.company_id()/is_team()/is_owner()/user_id()/can_see_project()
--   * money columns *_cents, payments.received_on, overdue derived; stage via pipeline_stages
--   * "before order" gate fires on the Materials Ordered milestone (we keep dates in milestones)
-- Deal number rules are unchanged: MMDD + that day's count, Eastern Time, restart each year.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Deal numbers
-- ---------------------------------------------------------------------------
-- Defaults are placeholders: the deals_number trigger always assigns the real values on insert,
-- so clients can't choose a number (and generated types don't require one).
alter table public.deals
  add column deal_year       int  not null default 0,
  add column deal_date       date not null default '1970-01-01',
  add column deal_seq        int  not null default 0,
  add column deal_number     text not null default '',
  add column permit_required boolean not null default false,
  add column deleted_at      timestamptz;

create table public.deal_number_counters (
  company_id  uuid not null references public.companies (id) on delete cascade,
  deal_date   date not null,
  last_seq    int  not null,
  constraint deal_number_counters_pkey primary key (company_id, deal_date)
);
alter table public.deal_number_counters enable row level security;  -- no policies: no direct access
revoke all on public.deal_number_counters from anon, authenticated;

-- Concurrency-safe: the upsert locks the day's row, so two deals opened at the same moment
-- get 10231 and 10232, never the same number.
create or replace function public.next_deal_number(p_company_id uuid, p_at timestamptz default now())
returns table (deal_year int, deal_date date, deal_seq int, deal_number text)
language plpgsql security definer set search_path = ''
as $$
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

create or replace function private.deals_assign_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare n record;
begin
  -- Always assigned here; whatever the client sent is ignored.
  select * into n from public.next_deal_number(new.company_id, coalesce(new.created_at, now()));
  new.deal_year := n.deal_year;
  new.deal_date := n.deal_date;
  new.deal_seq := n.deal_seq;
  new.deal_number := n.deal_number;
  return new;
end $$;
create trigger deals_number before insert on public.deals
  for each row execute function private.deals_assign_number();

-- Number existing rows (dev databases) in creation order, then make the columns required.
do $$
declare r record; n record;
begin
  for r in select id, company_id, created_at from public.deals where deal_number = '' order by created_at, id loop
    select * into n from public.next_deal_number(r.company_id, r.created_at);
    update public.deals set deal_year = n.deal_year, deal_date = n.deal_date, deal_seq = n.deal_seq,
                            deal_number = n.deal_number
     where id = r.id;
  end loop;
end $$;
create unique index deals_number_unique on public.deals (company_id, deal_year, deal_number);

-- Numbers are permanent: never edited, never reused (deals are soft-deleted).
create or replace function private.deals_guard_number() returns trigger
language plpgsql
as $$
begin
  if (new.deal_year, new.deal_date, new.deal_seq, new.deal_number)
     is distinct from (old.deal_year, old.deal_date, old.deal_seq, old.deal_number) then
    raise exception 'Deal numbers cannot be changed (deal %)', old.deal_number using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger deals_number_guard before update on public.deals
  for each row execute function private.deals_guard_number();

-- Crew is "on a deal" when they can see its job (project_members, PM or task assignee).
create or replace function private.is_assigned_to_deal(p_deal_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.projects p where p.deal_id = p_deal_id and private.can_see_project(p.id))
$$;

-- Crew reads jobs through this view (no money). Now carries the deal number for links.
drop view public.crew_projects;
create view public.crew_projects with (security_barrier = true) as
  select p.id, p.company_id, p.contact_id, p.name, p.status, p.project_manager_id, p.created_at, p.closed_at,
         p.deal_id, d.deal_year, d.deal_number
    from public.projects p
    left join public.deals d on d.id = p.deal_id
   where private.can_see_project(p.id);
grant select on public.crew_projects to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Required documents (owner-editable, per company)
-- ---------------------------------------------------------------------------
create table public.document_requirements (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  gate          text not null check (gate in ('before_order', 'before_start', 'before_close')),
  folder        text not null,
  label         text not null,
  required      boolean not null default true,
  applies_when  text not null default 'always' check (applies_when in ('always', 'permit_required')),
  sort_order    int not null default 0,
  unique (company_id, gate, label)
);

-- ---------------------------------------------------------------------------
-- 3. Deal files (photos + documents)
-- ---------------------------------------------------------------------------
create table public.deal_files (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  deal_id         uuid not null references public.deals (id) on delete cascade,
  folder          text not null check (folder in
                    ('photos', 'estimates', 'design', 'contract', 'permits', 'invoices_receipts',
                     'payments', 'change_orders', 'warranty', 'other')),
  photo_tag       text check (photo_tag in
                    ('before', 'measurement', 'sketch', 'appliance_label', 'under_sink', 'panel',
                     'delivery', 'progress', 'issue', 'after', 'other')),
  title           text,
  storage_path    text not null unique,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes > 0),
  width           int,
  height          int,
  taken_at        timestamptz,
  site_visit_id   uuid references public.site_visits (id) on delete set null,
  quote_id        uuid references public.quotes (id) on delete set null,
  requirement_id  uuid references public.document_requirements (id) on delete set null,
  crew_visible    boolean,
  uploaded_by     uuid references public.users (id),
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  deleted_by      uuid references public.users (id),
  constraint deal_files_photo_tag check (photo_tag is null or folder = 'photos'),
  -- money documents are never visible to crew
  constraint deal_files_crew_folders check (not coalesce(crew_visible, false)
                                            or folder in ('photos', 'design', 'permits', 'warranty'))
);
create index deal_files_deal on public.deal_files (deal_id, folder, created_at desc);

alter table public.site_visits
  add constraint site_visits_sketch_file_fk foreign key (sketch_file_id) references public.deal_files (id) on delete set null;

create or replace function private.deal_files_before_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
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
  new.crew_visible := coalesce(new.crew_visible, new.folder in ('photos', 'design'));
  new.uploaded_by := coalesce(new.uploaded_by, private.user_id());
  return new;
end $$;
create trigger deal_files_insert before insert on public.deal_files
  for each row execute function private.deal_files_before_insert();

-- Files are permanent records: only title/tag/requirement/visibility and soft-delete can change.
create or replace function private.deal_files_before_update() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.deal_id, new.folder, new.storage_path, new.mime_type, new.size_bytes, new.uploaded_by, new.created_at)
     is distinct from (old.deal_id, old.folder, old.storage_path, old.mime_type, old.size_bytes, old.uploaded_by, old.created_at) then
    raise exception 'File records are permanent; upload a new file instead' using errcode = 'check_violation';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    new.deleted_by := coalesce(new.deleted_by, private.user_id());
  end if;
  return new;
end $$;
create trigger deal_files_update before update on public.deal_files
  for each row execute function private.deal_files_before_update();

-- Uploads show in the activity feed (photos are crew-visible; money folders are has_money).
create or replace function private.deal_files_events() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_project uuid;
begin
  select id into v_project from public.projects where deal_id = new.deal_id;
  perform private.add_event(new.company_id, 'file', new.id,
    case when new.crew_visible then null else new.deal_id end,   -- crew-visible files show on the job feed
    v_project, 'file.added',
    format('%s added to %s', case when new.folder = 'photos' then 'Photo' else coalesce(new.title, 'File') end,
           replace(new.folder, '_', ' ')),
    new.folder in ('payments', 'invoices_receipts', 'estimates', 'change_orders', 'contract'));
  return null;
end $$;
create trigger deal_files_events after insert on public.deal_files
  for each row execute function private.deal_files_events();

-- ---------------------------------------------------------------------------
-- 4. Jacket checklist + gates
-- ---------------------------------------------------------------------------
create view public.deal_jacket_checklist with (security_invoker = true) as
select d.id as deal_id, d.deal_number, r.id as requirement_id, r.gate, r.folder, r.label, r.required, r.sort_order,
       count(f.id) as file_count,
       count(f.id) > 0 as satisfied
  from public.deals d
  join public.document_requirements r on r.company_id = d.company_id
       and (r.applies_when = 'always' or (r.applies_when = 'permit_required' and d.permit_required))
  left join public.deal_files f on f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null
 group by d.id, d.deal_number, r.id, r.gate, r.folder, r.label, r.required, r.sort_order;

create or replace function public.deal_gate_missing(p_deal_id uuid, p_gate text) returns setof text
language sql stable security definer set search_path = ''
as $$
  select r.label
    from public.deals d
    join public.document_requirements r on r.company_id = d.company_id and r.gate = p_gate and r.required
         and (r.applies_when = 'always' or (r.applies_when = 'permit_required' and d.permit_required))
   where d.id = p_deal_id
     and not exists (select 1 from public.deal_files f
                      where f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null)
   order by r.sort_order
$$;

-- Hard gate: no order (Materials Ordered milestone done) without the "before order" papers.
create or replace function private.milestones_order_gate() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_deal uuid;
  v_missing text;
begin
  if new.key <> 'materials_ordered' or new.actual_date is null or old.actual_date is not null then
    return new;
  end if;
  select deal_id into v_deal from public.projects where id = new.project_id;
  if v_deal is null then return new; end if;
  select string_agg(m, ', ') into v_missing from public.deal_gate_missing(v_deal, 'before_order') m;
  if v_missing is not null then
    raise exception 'Deal jacket is missing before ordering: %', v_missing using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger milestones_order_gate before update of actual_date on public.milestones
  for each row execute function private.milestones_order_gate();

-- Hard gate: no close without the "before close" papers (on top of balance/punch/costs in close_project()).
create or replace function private.projects_close_gate() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_missing text;
begin
  if new.closed_at is not null and old.closed_at is null and new.deal_id is not null then
    select string_agg(m, ', ') into v_missing from public.deal_gate_missing(new.deal_id, 'before_close') m;
    if v_missing is not null then
      raise exception 'Deal jacket is missing before closing: %', v_missing using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger projects_close_gate before update of closed_at on public.projects
  for each row execute function private.projects_close_gate();

-- ---------------------------------------------------------------------------
-- 5. Deal recap (financials on one screen, like a car deal recap). Owners + team only (RLS on sources).
-- ---------------------------------------------------------------------------
create view public.deal_recap with (security_invoker = true) as
with co as (
  select project_id,
         sum(price_change_cents) filter (where approved_at is not null) as co_price,
         sum(cost_change_cents)  filter (where approved_at is not null) as co_cost,
         count(*) filter (where approved_at is null) as co_pending
    from public.change_orders group by project_id
),
pay as (
  select p.project_id,
         sum(p.amount_cents) filter (where p.status = 'received') as collected,
         sum(p.amount_cents) filter (where p.status <> 'received') as scheduled_open,
         sum(p.amount_cents) filter (where p.status = 'due'
                                       and p.due_date < private.company_today(p.company_id) - 3) as overdue
    from public.payments p group by p.project_id
),
cst as (
  select project_id, sum(estimated_amount_cents) as est, sum(actual_amount_cents) as act,
         count(*) filter (where actual_amount_cents is null) as costs_without_actual
    from public.costs group by project_id
)
select d.id as deal_id, d.deal_year, d.deal_number, s.key as stage_key, s.label as stage_label, p.id as project_id,
       coalesce(p.contract_value_cents, 0)::bigint                                   as contract_value_cents,
       coalesce(co.co_price, 0)::bigint                                              as change_orders_cents,
       coalesce(co.co_pending, 0)                                                    as change_orders_pending,
       (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0))::bigint      as revenue_cents,
       coalesce(pay.collected, 0)::bigint                                            as collected_cents,
       (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0) - coalesce(pay.collected, 0))::bigint
                                                                                     as balance_due_cents,
       coalesce(pay.overdue, 0)::bigint                                              as overdue_cents,
       (coalesce(cst.est, 0) + coalesce(co.co_cost, 0))::bigint                      as estimated_cost_cents,
       cst.act::bigint                                                               as actual_cost_cents,
       coalesce(cst.costs_without_actual, 0)                                         as costs_without_actual,
       (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0)
        - coalesce(cst.est, 0) - coalesce(co.co_cost, 0))::bigint                    as estimated_profit_cents,
       case when cst.act is null then null
            else (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0) - cst.act)::bigint end
                                                                                     as actual_profit_cents,
       case when (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0)) = 0 or cst.act is null then null
            else round((coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0) - cst.act)::numeric
                       / (coalesce(p.contract_value_cents, 0) + coalesce(co.co_price, 0)), 4) end
                                                                                     as actual_margin
  from public.deals d
  join public.pipeline_stages s on s.id = d.stage_id
  left join public.projects p on p.deal_id = d.id
  left join co  on co.project_id = p.id
  left join pay on pay.project_id = p.id
  left join cst on cst.project_id = p.id
 where d.deleted_at is null;

-- ---------------------------------------------------------------------------
-- 6. Defaults (called from seed_company_defaults and for existing companies here)
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_deal_jacket(p_company_id uuid) returns void
language sql security definer set search_path = ''
as $$
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
revoke execute on function public.seed_default_deal_jacket(uuid) from public, anon, authenticated;
grant execute on function public.seed_default_deal_jacket(uuid) to service_role;

select public.seed_default_deal_jacket(id) from public.companies;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.document_requirements enable row level security;
alter table public.deal_files            enable row level security;
grant select, insert, update, delete on public.document_requirements to authenticated;
grant select, insert, update on public.deal_files to authenticated;  -- no hard delete

create policy doc_req_read on public.document_requirements for select to authenticated
  using (private.is_team(company_id));
create policy doc_req_owner on public.document_requirements for all to authenticated
  using (private.is_owner(company_id)) with check (private.is_owner(company_id));

-- Owners + team: everything (soft delete via deleted_at).
create policy deal_files_team_read on public.deal_files for select to authenticated
  using (private.is_team(company_id));
create policy deal_files_team_insert on public.deal_files for insert to authenticated
  with check (private.is_team(company_id));
create policy deal_files_team_update on public.deal_files for update to authenticated
  using (private.is_team(company_id)) with check (private.is_team(company_id));
-- Crew: see crew-visible files of assigned deals; add photos to assigned deals.
create policy deal_files_crew_read on public.deal_files for select to authenticated
  using (private.is_member(company_id) and crew_visible and deleted_at is null
         and private.is_assigned_to_deal(deal_id));
create policy deal_files_crew_insert on public.deal_files for insert to authenticated
  with check (private.is_member(company_id) and folder = 'photos' and private.is_assigned_to_deal(deal_id));

-- ---------------------------------------------------------------------------
-- 8. Storage: private bucket 'deal-files', path {company}/{year}/{deal number}/{folder}/{file}
--    (skipped where the storage schema doesn't exist, e.g. plain-Postgres tests)
-- ---------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then return; end if;
  insert into storage.buckets (id, name, public) values ('deal-files', 'deal-files', false) on conflict (id) do nothing;

  execute $p$
    create policy deal_files_storage_read on storage.objects for select to authenticated
      using (bucket_id = 'deal-files'
             and (storage.foldername(name))[1] = private.company_id()::text
             and (private.is_team(private.company_id())
                  or exists (select 1 from public.deal_files f
                              where f.storage_path = storage.objects.name and f.crew_visible and f.deleted_at is null
                                and private.is_assigned_to_deal(f.deal_id))))
  $p$;
  execute $p$
    create policy deal_files_storage_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'deal-files'
                  and (storage.foldername(name))[1] = private.company_id()::text
                  and (private.is_team(private.company_id())
                       or ((storage.foldername(name))[4] = 'photos'
                           and exists (select 1 from public.deals d
                                        where d.company_id = private.company_id()
                                          and d.deal_year::text = (storage.foldername(name))[2]
                                          and d.deal_number = (storage.foldername(name))[3]
                                          and private.is_assigned_to_deal(d.id)))))
  $p$;
  -- No update/delete policies: stored files are never overwritten or removed from the app.
end $do$;
