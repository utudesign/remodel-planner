-- =====================================================================
-- 0024 — change request v3, batch D: photo categories + thumbnails (PLAN v3 item 11, §3)
--
--   1. photo_categories (Settings → Photos): label, order, how many the site visit needs (min_required)
--   2. deal_files.photo_tag: the 0004 CHECK list → a trigger that checks the company's categories
--   3. old tags mapped (Q8: add Other; progress → Completion/After, no Progress category):
--        before → before · measurement, sketch, appliance_label → measurements · under_sink → plumbing
--        panel → electrical · issue → issue · after, progress → completion · delivery → damage · other/empty → other
--   4. deal_files.thumb_path: a 400 px JPEG made on the phone; grids load it, the viewer loads the original
-- =====================================================================

create table public.photo_categories (
  company_id    uuid not null references public.companies (id) on delete cascade,
  key           text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label         text not null check (length(btrim(label)) between 1 and 40),
  hint          text check (hint is null or length(hint) <= 120),   -- "Every wall, ceiling and floor"
  min_required  int not null default 0 check (min_required between 0 and 50),
  sort_order    int not null default 0,
  active        boolean not null default true,
  primary key (company_id, key)
);
alter table public.photo_categories enable row level security;
create policy photo_categories_read on public.photo_categories for select to authenticated
  using (company_id = public.current_company_id());
create policy photo_categories_owner on public.photo_categories for all to authenticated
  using (company_id = public.current_company_id() and public.is_owner())
  with check (company_id = public.current_company_id() and public.is_owner());
-- 'other' is the catch-all: it can be renamed but never turned off or removed.
create or replace function private.photo_categories_keep_other() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.key = 'other' then raise exception 'Other is the catch-all; rename it instead' using errcode = 'check_violation'; end if;
    return old;
  end if;
  if new.key = 'other' and not new.active then
    raise exception 'Other is the catch-all and stays on' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger photo_categories_keep_other before update or delete on public.photo_categories
  for each row execute function private.photo_categories_keep_other();

create or replace function public.seed_photo_categories_v3(p_company uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.photo_categories (company_id, key, label, hint, min_required, sort_order) values
    (p_company, 'before',       'Before',            'Every wall, ceiling and floor', 4, 1),
    (p_company, 'measurements', 'Measurements',      'Sketch with measurements, appliance labels', 1, 2),
    (p_company, 'plumbing',     'Plumbing',          'Under the sink, shut-offs', 1, 3),
    (p_company, 'electrical',   'Electrical',        'The panel', 1, 4),
    (p_company, 'issue',        'Issue',             null, 0, 5),
    (p_company, 'damage',       'Damage',            'Delivery check', 0, 6),
    (p_company, 'completion',   'Completion/After',  null, 0, 7),
    (p_company, 'other',        'Other',             null, 0, 8)
  on conflict do nothing
$$;
revoke execute on function public.seed_photo_categories_v3(uuid) from public, anon, authenticated;

create or replace function private.companies_seed_photo_categories() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_photo_categories_v3(new.id);
  return new;
end $$;
create trigger companies_zz_photo_categories after insert on public.companies
  for each row execute function private.companies_seed_photo_categories();
select public.seed_photo_categories_v3(id) from public.companies;

-- ---------------------------------------------------------------------
-- Tags → categories
-- ---------------------------------------------------------------------
alter table public.deal_files drop constraint if exists deal_files_photo_tag_check;
alter table public.deal_files add column if not exists thumb_path text
  check (thumb_path is null or thumb_path ~ '^[0-9a-f-]{36}/');

-- The 0004 update guard allows re-tagging. The one-time re-map is not a user edit: keep it out of History.
alter table public.deal_files disable trigger zz_audit;
update public.deal_files set photo_tag = case photo_tag
    when 'before' then 'before'
    when 'measurement' then 'measurements'
    when 'sketch' then 'measurements'
    when 'appliance_label' then 'measurements'
    when 'under_sink' then 'plumbing'
    when 'panel' then 'electrical'
    when 'issue' then 'issue'
    when 'after' then 'completion'
    when 'progress' then 'completion'
    when 'delivery' then 'damage'
    else 'other' end
 where folder = 'photos';
alter table public.deal_files enable trigger zz_audit;

create or replace function public.deal_files_photo_category() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.folder <> 'photos' then
    new.photo_tag := null;
    return new;
  end if;
  new.photo_tag := coalesce(nullif(new.photo_tag, ''), 'other');
  if tg_op = 'UPDATE' and new.photo_tag is not distinct from old.photo_tag then return new; end if;
  if not exists (select 1 from public.photo_categories c
                  where c.company_id = new.company_id and c.key = new.photo_tag and c.active) then
    raise exception 'Unknown photo category: %', new.photo_tag using errcode = 'check_violation';
  end if;
  return new;
end $$;
-- Name sorts after deal_files_insert (0004 fills company_id) and before deal_files_type (0017).
create trigger deal_files_photo_cat before insert or update of photo_tag, folder on public.deal_files
  for each row execute function public.deal_files_photo_category();

notify pgrst, 'reload schema';
