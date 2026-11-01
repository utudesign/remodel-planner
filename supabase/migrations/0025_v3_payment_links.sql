-- =====================================================================
-- 0025 — change request v3, batch G: installments with Melio payment links (PLAN v3 item 16, §4)
--
-- Melio has no API for payment requests, so this is manual: the job has installments (payments rows);
-- paste the Melio link → Text it (amount, what for, link) → Mark paid with the Melio reference.
-- The 0005 rule still applies: no payment can be marked received before the contract is signed.
--   1. payments: company_id, link_url, link_sent_at, provider, provider_ref, sort_order, created_at
--   2. payment_steps (Settings → Jobs): the standard schedule (Deposit 30 % · Cabinet delivery 40 % · Completion 30 %)
--      add_payment_schedule(project): splits revenue (sold + change orders) by the steps; each rounds down,
--      the last absorbs the remainder (CLAUDE.md money rule)
--   3. job_customer_payments: the customer sees their installments + pay link (it's their money; workers never see it)
-- =====================================================================

alter table public.payments
  add column if not exists company_id   uuid references public.companies (id) on delete cascade,
  add column if not exists link_url     text check (link_url is null or (link_url ~ '^https://' and length(link_url) <= 500)),
  add column if not exists link_sent_at timestamptz,
  add column if not exists provider     text check (provider is null or provider in ('melio', 'check', 'cash', 'zelle', 'other')),
  add column if not exists provider_ref text check (provider_ref is null or length(provider_ref) <= 120),
  add column if not exists sort_order   int not null default 0,
  add column if not exists created_at   timestamptz not null default now();
update public.payments pm set company_id = p.company_id from public.projects p where p.id = pm.project_id and pm.company_id is null;
alter table public.payments add constraint payments_amount_positive check (amount > 0) not valid;

create or replace function public.payments_fill() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select company_id into new.company_id from public.projects where id = new.project_id;
  new.status := case when new.received_at is not null then 'paid'
                     when new.link_sent_at is not null then 'sent'
                     else 'due' end;
  return new;
end $$;
-- runs before 0005's payments_compliance (alphabetical): status is set, then the contract rule is checked
create trigger payments_a_fill before insert or update on public.payments
  for each row execute function public.payments_fill();

-- ---------------------------------------------------------------------
-- Standard schedule
-- ---------------------------------------------------------------------
create table public.payment_steps (
  company_id  uuid not null references public.companies (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label       text not null check (length(btrim(label)) between 1 and 60),
  pct         numeric(5, 2) not null check (pct > 0 and pct <= 100),
  sort_order  int not null default 0,
  active      boolean not null default true,
  primary key (company_id, key)
);
alter table public.payment_steps enable row level security;
create policy payment_steps_team_read on public.payment_steps for select to authenticated
  using (company_id = public.current_company_id() and public.is_team());
create policy payment_steps_owner on public.payment_steps for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

create or replace function public.seed_payment_steps_v3(p_company uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.payment_steps (company_id, key, label, pct, sort_order) values
    (p_company, 'deposit', 'Deposit', 30, 1),
    (p_company, 'cabinet_delivery', 'Cabinet delivery', 40, 2),
    (p_company, 'completion', 'Completion', 30, 3)
  on conflict do nothing
$$;
revoke execute on function public.seed_payment_steps_v3(uuid) from public, anon, authenticated;
create or replace function private.companies_seed_payment_steps() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_payment_steps_v3(new.id);
  return new;
end $$;
create trigger companies_zz_payment_steps after insert on public.companies
  for each row execute function private.companies_seed_payment_steps();
select public.seed_payment_steps_v3(id) from public.companies;

-- Invoker: payments RLS (team, workspace) decides. Only on a job with no installments yet.
create or replace function public.add_payment_schedule(p_project uuid)
returns int language plpgsql security invoker set search_path = public as $$
declare v_total bigint; v_left bigint; v_n int; v_i int := 0; v_sum numeric; st record; v_amt bigint;
begin
  if not public.is_team() then raise exception 'Only the team plans payments' using errcode = '42501'; end if;
  select coalesce(d.sold_price_cents, 0) + coalesce(d.change_orders_cents, 0) into v_total
    from public.projects p join public.deals d on d.id = p.deal_id
   where p.id = p_project and p.company_id = public.current_company_id();
  if not found then raise exception 'Job not found' using errcode = '42501'; end if;
  if coalesce(v_total, 0) <= 0 then raise exception 'Set the sold price first' using errcode = 'check_violation'; end if;
  perform 1 from public.projects where id = p_project for update;   -- a double tap waits, then sees the rows
  if exists (select 1 from public.payments where project_id = p_project) then
    raise exception 'This job already has installments' using errcode = 'check_violation';
  end if;
  select count(*), sum(pct) into v_n, v_sum from public.payment_steps where company_id = public.current_company_id() and active;
  if v_n = 0 then raise exception 'Add payment steps in Settings → Jobs' using errcode = 'check_violation'; end if;
  if v_sum <> 100 then raise exception 'Payment steps add up to % %%, not 100 %% (Settings → Jobs)', v_sum using errcode = 'check_violation'; end if;
  v_left := v_total;
  for st in select * from public.payment_steps where company_id = public.current_company_id() and active order by sort_order, key loop
    v_i := v_i + 1;
    v_amt := case when v_i = v_n then v_left else floor(v_total * st.pct / 100)::bigint end;
    insert into public.payments (project_id, label, amount, sort_order) values (p_project, st.label, v_amt, v_i);
    v_left := v_left - v_amt;
  end loop;
  return v_n;
end $$;
revoke execute on function public.add_payment_schedule(uuid) from public, anon;
grant execute on function public.add_payment_schedule(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Customer view
-- ---------------------------------------------------------------------
create or replace view public.job_customer_payments with (security_barrier) as
select pm.id, pm.project_id, pm.label, pm.amount as amount_cents, pm.due_date, pm.received_at, pm.status,
       pm.receipt_number,
       case when pm.received_at is null then pm.link_url end as link_url,
       pm.sort_order
  from public.payments pm
 where public.is_customer_of_project(pm.project_id);
revoke all on public.job_customer_payments from public, anon;
grant select on public.job_customer_payments to authenticated;

notify pgrst, 'reload schema';
