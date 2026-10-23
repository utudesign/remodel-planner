# Handoff: kitchen remodel planner (design → build)

This bundle is the output of the design chat. The real app gets built in a separate Claude Code project using these files.

## What's inside

| Path                                           | What it is                                                                                                          | Status                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `docs/CONTEXT.md`                              | Source of truth: team, lifecycle, data model, screens, automations, analytics, **build phases**                     | Spec                  |
| `docs/FIELD-AND-OFFICE.md`                     | How the three of you work: admin split shift, lead routing, Site Visit form, ballpark, design queue, command center | Spec                  |
| `docs/ESTIMATING.md`                           | Price book, quotes, takeoff, approval, materials/pick list                                                          | Spec                  |
| `docs/PROMPT-kickoff.md`                       | Paste to start **Phase 1**                                                                                          | Prompt                |
| `docs/PROMPT-estimating.md`                    | Paste to start **Phase 3**                                                                                          | Prompt                |
| `supabase/migrations/0002_estimating.sql`      | Estimating tables, views, RLS, approve/convert functions                                                            | Tested on Postgres 16 |
| `supabase/migrations/0003_estimating_seed.sql` | `seed_default_estimating()`: 79-item starter price book + 10x10 template (**sample costs**)                         | Tested                |
| `lib/estimating/`                              | `pricing.ts`, `takeoff.ts`, `ballpark.ts` + 42 tests + fixtures exported from Postgres                              | Tested, strict TS     |

## How to use it

1. Create the repo (e.g. `~/Projects/remodel-planner`), unzip this bundle at the root, open it in VS Code, start Claude Code.
2. Add `docs/` to the Claude Project's knowledge (or keep them in the repo; `CLAUDE.md` will point to them).
3. Paste `docs/PROMPT-kickoff.md`. Approve the Step 0 plan before any code is written.
4. Phase 2 (field → design): ask Claude Code to build CONTEXT §9 Phase 2 from FIELD-AND-OFFICE §4, §6, §9.
5. Phase 3: paste `docs/PROMPT-estimating.md`. It reconciles 0002/0003 with the real 0001 before applying them.
6. Ship each phase to the team, use it for a week, then start the next one.

## Before the first real quote

- Replace every sample cost in the price book with real supplier and sub pricing.
- Confirm the admin's hours and enter them as work windows (FIELD-AND-OFFICE §2).
- Set up the shared business phone number and decide how Facebook messages reach the app (FIELD-AND-OFFICE §8).

## Verified numbers (sample costs)

| Check                             | Result                                          |
| --------------------------------- | ----------------------------------------------- |
| 10x10 cost (SQL view vs workbook) | $15,680.50 = $15,680.50                         |
| 10x10 price                       | $24,123.86 vs $24,123.85 (1¢ per-line rounding) |
| TS vs SQL totals                  | identical to the cent                           |
| Phone ballpark, 10x10             | $22,500 – $28,000                               |
