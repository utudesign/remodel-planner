-- =====================================================================
-- 0014_feedback.sql — handbook feedback from Crystal and Ahn (and me), inside the app.
-- One row per person per area (Today, New deal, Estimate…): a 1–5 rating + comments.
-- Everyone on the team writes and edits their own rows; the owner reads everyone's.
-- =====================================================================

create table public.app_feedback (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  area        text not null check (area ~ '^[a-z0-9_]{2,40}$'),
  rating      int check (rating between 1 and 5),
  works       text not null default '' check (length(works) <= 2000),   -- what works
  change      text not null default '' check (length(change) <= 2000),  -- what's missing / confusing
  updated_at  timestamptz not null default now(),
  unique (user_id, area)
);
alter table public.app_feedback enable row level security;

create policy app_feedback_own on public.app_feedback for all to authenticated
  using (company_id = public.current_company_id() and user_id = public.current_user_id() and public.is_team())
  with check (company_id = public.current_company_id() and user_id = public.current_user_id() and public.is_team());
create policy app_feedback_owner_read on public.app_feedback for select to authenticated
  using (company_id = public.current_company_id() and public.is_owner());
