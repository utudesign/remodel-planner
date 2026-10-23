# Prompt: build the estimating module

Paste into Claude Code from the repo root when starting **Phase 3** (after Phases 1–2 are live). Step 5 below waits for Phase 4.

---

Build the estimating module described in `docs/ESTIMATING.md`. These files are already in the repo and are tested — use them, don't rewrite them:

- `supabase/migrations/0002_estimating.sql` — tables, views, RLS, workflow functions
- `supabase/migrations/0003_estimating_seed.sql` — `seed_default_estimating(company_id)` with the starter price book and the 10x10 template
- `lib/estimating/pricing.ts`, `takeoff.ts`, `ballpark.ts` + `__tests__` + `__fixtures__/` (fixtures were exported from Postgres)

## Step 0 — Reconcile, then stop
1. Read `docs/ESTIMATING.md` §7 and compare every assumption against our real `0001` migration (users, quotes, projects, costs, tasks, RLS helper names, money column names).
2. List each mismatch and the exact edit you propose to 0002/0003. If 0001 already defines `current_company_id()` or similar helpers with different logic, keep 0001's version and remove the duplicate from 0002.
3. Check that `quote_line_items_priced` etc. are not exposed to crew users through any existing API route.
4. STOP and wait for my approval before changing any SQL.

## Step 1 — Database
- Apply 0002 and 0003 locally (`supabase db reset`). Call `seed_default_estimating` for the dev company in `supabase/seed.sql` and from the company-onboarding server action (service role).
- Generate types (`supabase gen types typescript`) and commit them.
- Add `vitest` tests that run `pnpm test` green with the provided `lib/estimating` tests.

## Step 2 — Price book + settings (owners edit settings; team edits price book + templates)
- Settings → Price book: table grouped by category, inline cost edit, "stale" badge when `cost_updated_at` is older than `estimating_settings.cost_stale_days`, CSV export/import (upsert by code + name), deactivate instead of delete.
- Settings → Estimating: edit `estimating_settings`, quote sections (one `absorbs_project_costs`), pick phases.
- Settings → Templates: edit template items, qty and `default_takeoff`.

## Step 3 — Quote builder (Lead → Quotes tab)
- Versions list with status chips; "New from template" calls `create_quote_from_template`; "Duplicate" calls `duplicate_quote`.
- Takeoff form bound to `quotes.takeoff` (`TakeoffInputs`). On save: `computeTakeoff()` → `applyTakeoff()` → update only the changed lines in one server action. Show warnings inline.
- Line grid grouped by section: qty, unit, unit cost, margin override, price, line margin. Add items from the price book (copies cost into the line). Labor lines show the quote labor rate.
- Sticky totals footer computed client-side with `quoteTotals()`; after save, reload from the `quote_totals` view. Amber banner when `belowTarget`.
- Approve button calls `approve_quote`. Locked quotes render read-only with a "Duplicate to edit" action.

## Step 3b — Phone ballpark
- Screen from the floating + button and inside a site visit: pick template, enter rough sizes and toggles, show the range from `ballpark()` big, with "Final price after design" and any warnings. "Save to visit" writes `ballpark_low_cents`, `ballpark_high_cents`, `ballpark_inputs` on the site visit.
- Read `ballpark_low_pct`, `ballpark_high_pct`, `ballpark_round_cents` from `estimating_settings`. Mark cabinet lines with `scalesWithCabinets` when their category is "Cabinets".

## Step 4 — Client quote
- Preview + PDF from `quote_section_totals`: section names, descriptions and prices only. Plus allowances (lines with `is_allowance`), exclusions (from settings, editable text), payment schedule via `paymentSchedule()` using the project's payment template, license number. Never show costs or line prices.

## Step 5 — Conversion + materials (do this in Phase 4)
- In the existing "Deposit received → create project" action, after the project row exists, call `materialize_quote_into_project(approved_quote_id, project_id)` in the same transaction.
- Project → Materials tab: grouped by pick phase, order status per line, bulk "mark vendor as ordered", received/backordered/damaged. Damaged or backordered creates an `issues` row (type `damage` / `delay`).
- Crew pack mode (phone, 375px): big checkboxes, grouped by phase, shows only qty/unit/name/note.

## Rules
- Money is cents everywhere; format only at render with `formatUsd`.
- Never compute saved totals in TS — the views are the source of truth; TS is for live preview and must match them (the fixture test enforces it).
- If you change any pricing SQL, re-export `__fixtures__/ten-by-ten.json` from the `quote_totals` view and keep the parity test green.
- Lint, typecheck, test and build after each step; commit per step; summarize what to click to test it.
