-- =====================================================================
-- 0009_quick_estimate.sql — visit, photos, quick estimate (master prompt v2, Step 3)
--   1. quotes: a document number (26-1047-E1) and an unguessable client link (/q/<token>)
--   2. site_visits: ceiling height + which visit a quote came from
-- =====================================================================

alter table public.quotes
  add column if not exists doc_number   text,
  add column if not exists client_token uuid not null default gen_random_uuid(),
  add column if not exists site_visit_id uuid references public.site_visits (id) on delete set null;
create unique index if not exists quotes_client_token on public.quotes (client_token);
create unique index if not exists quotes_doc_number on public.quotes (company_id, doc_number) where doc_number is not null;

alter table public.site_visits
  add column if not exists ceiling_in int check (ceiling_in between 72 and 240);

-- "Share with client": number the estimate once (26-1047-E1, -E2 …) and mark it sent.
create or replace function public.share_quote(p_quote_id uuid)
returns text language plpgsql security invoker set search_path = public as $$
declare q public.quotes%rowtype;
begin
  if not public.is_owner() then
    raise exception 'Only the owner can share estimates' using errcode = '42501';
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
