-- =====================================================================
-- 0010_handoff.sql — hand-off + partner login (master prompt v2, Step 4)
--   1. partner invites (Crystal signs in with the email I invited)
--   2. a partner reads the customer + site visit of deals handed to her
--   3. every job update (from her or typed by me) is logged on the deal and notifies me
-- =====================================================================

create table public.partner_invites (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  partner_id   uuid not null references public.partners (id) on delete cascade,
  email        text not null check (email = lower(email) and email like '%@%'),
  name         text,
  invited_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references public.users (id),
  unique (company_id, email)
);
alter table public.partner_invites enable row level security;
create policy partner_invites_owner on public.partner_invites for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());

-- First sign-in with an invited email: create the partner login. Service role only.
create or replace function public.accept_partner_invite(p_clerk_user_id text, p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.partner_invites%rowtype; v_user uuid;
begin
  select * into v_inv from public.partner_invites
   where email = lower(p_email) and accepted_at is null
   order by invited_at desc limit 1;
  if not found then return null; end if;
  insert into public.users (company_id, clerk_id, name, email, role, partner_id)
  values (v_inv.company_id, p_clerk_user_id, coalesce(nullif(p_name, ''), v_inv.name), lower(p_email), 'partner', v_inv.partner_id)
  on conflict (clerk_id) do update set active = true
  returning id into v_user;
  update public.partner_invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_user;
end $$;
revoke execute on function public.accept_partner_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.accept_partner_invite(text, text, text) to service_role;

-- The partner needs the customer and the visit to do the job.
create policy contacts_partner_read on public.contacts for select to authenticated
  using (exists (select 1 from public.deals d
                 where d.contact_id = contacts.id and d.partner_id = public.current_partner_id()
                   and d.handed_off_at is not null and d.deleted_at is null));
create policy site_visits_partner_read on public.site_visits for select to authenticated
  using (exists (select 1 from public.deals d
                 where d.id = site_visits.deal_id and d.partner_id = public.current_partner_id()
                   and d.handed_off_at is not null and d.deleted_at is null));

-- Job updates → activity on the deal + a notification for the owner (whoever typed them).
create or replace function private.deals_job_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_parts text[] := '{}';
  v_who   text := coalesce((select name from public.users where id = public.current_user_id()), 'Partner');
  v_role  text := public.current_app_role();
begin
  if new.handed_off_at is not null and old.handed_off_at is null then
    insert into public.activities (company_id, deal_id, type, summary, created_by)
    values (new.company_id, new.id, 'system',
            'Handed off to ' || coalesce((select name from public.partners where id = new.partner_id), 'partner'),
            public.current_user_id());
    return null;
  end if;
  if new.job_status is distinct from old.job_status then v_parts := v_parts || ('status: ' || new.job_status); end if;
  if new.sold_price_cents is distinct from old.sold_price_cents then
    v_parts := v_parts || ('sold price $' || to_char(coalesce(new.sold_price_cents, 0) / 100.0, 'FM999,999,990.00')); end if;
  if new.change_orders_cents is distinct from old.change_orders_cents then
    v_parts := v_parts || ('change orders $' || to_char(new.change_orders_cents / 100.0, 'FM999,999,990.00')); end if;
  if new.deposit_received_at is distinct from old.deposit_received_at and new.deposit_received_at is not null then
    v_parts := v_parts || 'deposit received'::text; end if;
  if new.paid_in_full_at is distinct from old.paid_in_full_at and new.paid_in_full_at is not null then
    v_parts := v_parts || 'paid in full'::text; end if;
  if new.job_completed_at is distinct from old.job_completed_at and new.job_completed_at is not null then
    v_parts := v_parts || 'job completed'::text; end if;
  if new.partner_note is distinct from old.partner_note and new.partner_note is not null then
    v_parts := v_parts || ('note: ' || left(new.partner_note, 120)); end if;
  if array_length(v_parts, 1) is null then return null; end if;

  insert into public.activities (company_id, deal_id, type, summary, created_by)
  values (new.company_id, new.id, 'system', 'Job update: ' || array_to_string(v_parts, ', '), public.current_user_id());

  if v_role = 'partner' then
    insert into public.notifications (company_id, user_id, kind, title, body, url, deal_id)
    select new.company_id, u.id, 'partner_update', v_who || ' updated #' || new.deal_number,
           array_to_string(v_parts, ', '), '/deals/' || new.deal_number || '?tab=partner', new.id
      from public.users u where u.company_id = new.company_id and u.role = 'owner' and u.active;
  end if;
  return null;
end $$;
create trigger deals_job_events after update on public.deals
  for each row execute function private.deals_job_events();
