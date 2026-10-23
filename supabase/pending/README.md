# Pending migrations (not applied)

From the design handoff (`docs/HANDOFF.md`). They belong to **Phase 3 — Estimating** and must be reconciled
with `migrations/0001–0003` before moving into `supabase/migrations/` (see `docs/ESTIMATING.md` §7 and the
reconciliation table in `docs/DECISIONS.md`). The Supabase CLI ignores this folder.

Trial run (2026-10-23): both files apply on top of the current schema and `seed_default_estimating()` loads
79 items, but they are **not usable as-is**: role helpers expect `owner/team`, `materialize_quote_into_project`
writes `costs(category, estimated_amount)` (ours: `category_id`, `estimated_amount_cents`, `company_id`), and
`projects.contract_value` (ours: `contract_value_cents`).
