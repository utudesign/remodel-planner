-- =====================================================================
-- 0018_v3_deal_jacket.sql — change request v3, batch B (docs/PLAN.md v3)
--   1. Job-ready checklist: any item can be ticked by hand (who + when); a tick satisfies every gate (item 1)
--   2. History: an audit trail of every change on a deal (old → new), written by triggers (item 3)
-- Additive only. 0004/0005's checklist view and deal_gate_missing() are redefined (same columns and
-- signature, new columns appended) so a hand tick counts like a file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Checklist ticks by hand
-- ---------------------------------------------------------------------
create table public.deal_checklist_checks (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  deal_id         uuid not null references public.deals (id) on delete cascade,
  requirement_id  uuid not null references public.document_requirements (id) on delete cascade,
  checked_by      uuid references public.users (id) on delete set null,
  checked_at      timestamptz not null default now(),
  note            text check (note is null or length(note) <= 300),
  unique (deal_id, requirement_id)
);
create index deal_checklist_checks_deal on public.deal_checklist_checks (deal_id);

create or replace function public.deal_checklist_checks_fill()
returns trigger language plpgsql set search_path = public as $$
begin
  select company_id into new.company_id from public.deals where id = new.deal_id;
  if new.company_id is null then raise exception 'Deal not found'; end if;
  if not exists (select 1 from public.document_requirements r
                  where r.id = new.requirement_id and r.company_id = new.company_id) then
    raise exception 'That checklist item is not set up for this company' using errcode = 'check_violation';
  end if;
  new.checked_by := coalesce(public.current_user_id(), new.checked_by);
  new.checked_at := now();
  return new;
end $$;
create trigger deal_checklist_checks_fill before insert on public.deal_checklist_checks
  for each row execute function public.deal_checklist_checks_fill();

alter table public.deal_checklist_checks enable row level security;
-- Owner + team on deals they can see (own workspace or shared). Untick = delete (kept in History).
create policy checklist_checks_team on public.deal_checklist_checks for all to authenticated
  using (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id))
  with check (company_id = public.current_company_id() and public.is_team() and public.can_see_deal(deal_id));
grant select, insert, delete on public.deal_checklist_checks to authenticated;

-- Same columns as 0005 in the same order; the hand tick is appended.
create or replace view public.deal_jacket_checklist with (security_invoker = true) as
select d.id as deal_id, d.deal_number, r.id as requirement_id, r.gate, r.folder, r.label, r.required, r.sort_order,
       count(f.id) as file_count,
       (count(f.id) > 0 or bool_or(k.id is not null)) as satisfied,
       max(k.checked_at) as checked_at,
       (array_agg(k.checked_by) filter (where k.id is not null))[1] as checked_by
from public.deals d
join public.document_requirements r on r.company_id = d.company_id and public.requirement_applies(r.applies_when, d)
left join public.deal_files f on f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null
left join public.deal_checklist_checks k on k.deal_id = d.id and k.requirement_id = r.id
group by d.id, d.deal_number, r.id, r.gate, r.folder, r.label, r.required, r.sort_order;

-- Every gate (before_handoff = Mark sold, before_order, before_start, before_close) accepts a hand tick.
create or replace function public.deal_gate_missing(p_deal_id uuid, p_gate text)
returns setof text language sql stable security definer set search_path = public as $$
  select r.label
  from public.deals d
  join public.document_requirements r on r.company_id = d.company_id and r.gate = p_gate and r.required
       and public.requirement_applies(r.applies_when, d)
  where d.id = p_deal_id
    and not exists (select 1 from public.deal_files f
                    where f.deal_id = d.id and f.requirement_id = r.id and f.deleted_at is null)
    and not exists (select 1 from public.deal_checklist_checks k
                    where k.deal_id = d.id and k.requirement_id = r.id)
  order by r.sort_order
$$;

-- ---------------------------------------------------------------------
-- 2. History: audit trail per deal
-- ---------------------------------------------------------------------
alter table public.audit_log add column if not exists deal_id uuid references public.deals (id) on delete cascade;
create index if not exists audit_log_deal on public.audit_log (deal_id, created_at desc) where deal_id is not null;

-- Columns that change on their own (bookkeeping) and would only add noise to History.
create or replace function private.audit_skip_cols() returns text[] language sql immutable as $$
  select array['updated_at', 'last_touch_at', 'stage_entered_at', 'deal_seq', 'deal_year', 'partner_updated_at',
               'cost_updated_at', 'created_at', 'company_id', 'id', 'search']
$$;

-- One trigger for every audited table. TG_ARGV[0] says how to find the deal:
--   self (deals) · deal_id (row has deal_id) · contact (deals using this contact)
--   quote (quote_line_items → quotes) · project (row has project_id → projects.deal_id)
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row  jsonb := coalesce(v_new, v_old);
  v_skip text[] := private.audit_skip_cols();
  v_before jsonb := '{}';
  v_after  jsonb := '{}';
  v_key  text;
  v_company uuid := nullif(v_row ->> 'company_id', '')::uuid;
  v_deal uuid;
  v_deals uuid[];
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key = any (v_skip) then continue; end if;
      if (v_old -> v_key) is distinct from (v_new -> v_key) then
        v_before := v_before || jsonb_build_object(v_key, v_old -> v_key);
        v_after  := v_after  || jsonb_build_object(v_key, v_new -> v_key);
      end if;
    end loop;
    if v_after = '{}'::jsonb then return null; end if;    -- nothing anyone would call a change
  elsif tg_op = 'INSERT' then
    v_after := v_new - v_skip;
  else
    v_before := v_old - v_skip;
  end if;

  case tg_argv[0]
    when 'self' then v_deals := array[(v_row ->> 'id')::uuid];
    when 'deal_id' then v_deals := array[(v_row ->> 'deal_id')::uuid];
    when 'contact' then
      select array_agg(d.id) into v_deals from public.deals d where d.contact_id = (v_row ->> 'id')::uuid;
    when 'quote' then
      select array[q.deal_id] into v_deals from public.quotes q where q.id = (v_row ->> 'quote_id')::uuid;
    when 'project' then
      select array[p.deal_id] into v_deals from public.projects p where p.id = (v_row ->> 'project_id')::uuid;
    else v_deals := null;
  end case;
  if v_deals is null then return null; end if;

  foreach v_deal in array v_deals loop
    if v_deal is null then continue; end if;
    begin
      insert into public.audit_log (company_id, actor_id, table_name, record_id, action, before, after, deal_id)
      select coalesce(v_company, d.company_id), public.current_user_id(), tg_table_name,
             nullif(v_row ->> 'id', '')::uuid, lower(tg_op),
             nullif(v_before, '{}'::jsonb), nullif(v_after, '{}'::jsonb), d.id
        from public.deals d where d.id = v_deal;
    exception when foreign_key_violation then
      null;  -- the deal itself is being deleted in the same statement (cascade): nothing left to show
    end;
  end loop;
  return null;
end $$;

-- AFTER triggers so the row is final (other BEFORE triggers already ran). "zz_" keeps them last by name.
create trigger zz_audit after insert or update on public.deals
  for each row execute function private.audit_row('self');
create trigger zz_audit after update on public.contacts
  for each row execute function private.audit_row('contact');
create trigger zz_audit after insert or update or delete on public.deal_files
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or update on public.quotes
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or update or delete on public.quote_line_items
  for each row execute function private.audit_row('quote');
create trigger zz_audit after insert or update or delete on public.meetings
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or update on public.site_visits
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or delete on public.deal_checklist_checks
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or update on public.projects
  for each row execute function private.audit_row('deal_id');
create trigger zz_audit after insert or update or delete on public.job_milestones
  for each row execute function private.audit_row('project');
create trigger zz_audit after insert or update or delete on public.tasks
  for each row execute function private.audit_row('project');
create trigger zz_audit after insert or update or delete on public.costs
  for each row execute function private.audit_row('project');
create trigger zz_audit after insert or update or delete on public.payments
  for each row execute function private.audit_row('project');
create trigger zz_audit after insert or update or delete on public.change_orders
  for each row execute function private.audit_row('project');

-- Team members read the History of deals they can see; the owner keeps reading everything (0001).
create policy audit_team_read on public.audit_log for select to authenticated
  using (company_id = public.current_company_id() and public.is_team()
         and deal_id is not null and public.can_see_deal(deal_id));
