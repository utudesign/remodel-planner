-- =====================================================================
-- 0017_v3_quick_fixes.sql — change request v3, batch A (docs/PLAN.md v3, Oct 31 2026)
--   1. Estimates: soft delete for drafts, archive for anything sent or on a sold deal (item 6)
--   2. Deal files: the Files tab takes PDF and Word only; photos are images (item 8)
--   3. Storage bucket 'deal-files': allowed types + 25 MB per file (item 8)
-- Additive only: no applied migration is edited, no existing row is changed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Estimates: delete (draft) or archive (sent / sold)
-- ---------------------------------------------------------------------
alter table public.quotes
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references public.users (id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.users (id) on delete set null;

-- Was this estimate already in the client's hands, or is the deal sold? Then it's a record: archive only.
create or replace function public.quote_is_record(q public.quotes)
returns boolean language sql stable security definer set search_path = public as $$
  select q.sent_at is not null
      or q.doc_number is not null
      or q.status in ('sent', 'approved', 'superseded')
      or exists (select 1 from public.deals d
                 left join public.pipeline_stages ps on ps.company_id = d.company_id and ps.key = d.stage
                 where d.id = q.deal_id
                   and (d.sold_at is not null or d.handed_off_at is not null or ps.kind = 'handed_off'))
$$;
revoke execute on function public.quote_is_record(public.quotes) from public, anon;
grant execute on function public.quote_is_record(public.quotes) to authenticated, service_role;

create or replace function public.quotes_delete_archive_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'A deleted estimate cannot be brought back; make a new one' using errcode = 'check_violation';
  end if;
  if new.deleted_at is not null and old.deleted_at is null then
    if public.quote_is_record(old) then
      raise exception 'This estimate was sent to the client or the deal is sold: archive it instead'
        using errcode = 'check_violation';
    end if;
    new.deleted_by := coalesce(new.deleted_by, public.current_user_id());
  end if;
  if new.archived_at is not null and old.archived_at is null then
    new.archived_by := coalesce(new.archived_by, public.current_user_id());
  elsif new.archived_at is null then
    new.archived_by := null;
  end if;
  -- A deleted estimate is frozen except for being archived later (it never is in the app).
  if old.deleted_at is not null and (new.status, new.name, new.sent_at, new.doc_number)
       is distinct from (old.status, old.name, old.sent_at, old.doc_number) then
    raise exception 'This estimate was deleted' using errcode = 'check_violation';
  end if;
  return new;
end $$;
-- "quotes_guard" (0002) fires first by name; this one runs after it.
create trigger quotes_soft_delete before update on public.quotes
  for each row execute function public.quotes_delete_archive_guard();

-- No hard deletes through the API (soft delete above). Referential cascades are not subject to RLS.
create policy quotes_no_hard_delete on public.quotes as restrictive for delete to authenticated using (false);

-- Line items of a deleted estimate can't change either.
create or replace function public.quote_lines_deleted_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_deleted timestamptz;
begin
  select deleted_at into v_deleted from public.quotes where id = new.quote_id;
  if v_deleted is not null then
    raise exception 'This estimate was deleted' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger quote_lines_deleted before insert or update on public.quote_line_items
  for each row execute function public.quote_lines_deleted_guard();

create index if not exists quotes_deal_live on public.quotes (deal_id, version desc) where deleted_at is null;

-- ---------------------------------------------------------------------
-- 2. File types per folder (new rows only; anything uploaded before stays valid)
--    photos  → images
--    others  → PDF and Word. text/plain only for the notes the app writes itself
--              (site visit "measurements" / "appliance list", 0009 Step 3).
-- ---------------------------------------------------------------------
create or replace function public.deal_file_type_ok(p_folder text, p_mime text, p_path text)
returns boolean language sql immutable as $$
  select case
    when p_folder = 'photos' then
      lower(p_mime) in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')
    else
      (lower(p_mime) = 'application/pdf' and lower(p_path) ~ '\.pdf$')
      or (lower(p_mime) = 'application/msword' and lower(p_path) ~ '\.doc$')
      or (lower(p_mime) = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          and lower(p_path) ~ '\.docx$')
      or (lower(p_mime) = 'text/plain' and lower(p_path) ~ '\.txt$' and p_folder in ('design', 'other'))
  end
$$;

create or replace function public.deal_files_type_check()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Receipts and other money files live outside deal folders (0006); only deal folders are checked.
  if not public.deal_file_type_ok(new.folder, new.mime_type, new.storage_path) then
    raise exception '%', case when new.folder = 'photos'
                              then 'Photos must be JPEG, PNG, WebP or HEIC images'
                              else 'Files must be PDF or Word (.pdf, .doc, .docx). Photos go on the Photos tab' end
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
-- Named to run after "deal_files_insert" (0004), which fills company_id and checks the path.
create trigger deal_files_type before insert on public.deal_files
  for each row execute function public.deal_files_type_check();

-- ---------------------------------------------------------------------
-- 3. Storage bucket: the same types (the bucket holds photos too) + 25 MB per file.
--    Supabase's storage.buckets has these columns; the plain-Postgres test stand-in doesn't.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types') then
    execute $q$
      update storage.buckets
         set allowed_mime_types = array[
               'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
               'application/pdf', 'application/msword',
               'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
               'text/plain'],
             file_size_limit = 26214400
       where id = 'deal-files'
    $q$;
  end if;
end $$;
