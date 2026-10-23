# Handoff: kitchen remodel planner (design → build)

This bundle is the output of the design chat. The real app gets built in a separate Claude Code project using these files.

## What's inside

| Path | What it is | Status |
|---|---|---|
| `docs/CONTEXT.md` | Source of truth: team, lifecycle, data model, screens, automations, analytics, **build phases** | Spec |
| `docs/FIELD-AND-OFFICE.md` | How the three of you work: admin split shift, lead routing, Site Visit form, ballpark, design queue, command center | Spec |
| `docs/ESTIMATING.md` | Price book, quotes, takeoff, approval, materials/pick list | Spec |
| `docs/QUICK-ESTIMATE.md` | Phone quick estimate, vendor price lists + color groups, quartz levels, Home Depot comparison, company profile, monthly price check | Spec |
| `docs/research/Kitchen remodel price research.md` | NoVA quartz market, live Home Depot prices, Hampton Bay 10x10 comparison (sources + dates) | Research, Oct 23, 2026 |
| `docs/PROMPT-kickoff.md` | Paste to start **Phase 1** | Prompt |
| `docs/PROMPT-estimating.md` | Paste to start **Phase 3** | Prompt |
| `supabase/migrations/0002_estimating.sql` | Estimating tables, views, RLS, approve/convert functions | Tested on Postgres 16 |
| `supabase/migrations/0003_estimating_seed.sql` | `seed_default_estimating()`: 86-item starter price book (38 live Home Depot prices, 6 market quartz/countertop prices, the rest placeholders), 10x10 template, Home Depot comparison prices | Tested |
| `supabase/pending/seed/timberpeak-msrp-sheets.json` + `timberpeak_msrp_2026.sql` | Your vendor list (4 color groups × 279 items) and its import, cost = MSRP × 0.33 | Tested |
| `scripts/price-list-to-sql.ts` | Builds the import SQL from a price list | Tested |
| `lib/estimating/` | `pricing.ts`, `takeoff.ts`, `ballpark.ts`, `vendorImport.ts`, `comparison.ts` + 61 tests + fixtures exported from Postgres | Tested, strict TS |

## How to use it

1. Create the repo (e.g. `~/Projects/remodel-planner`), unzip this bundle at the root, open it in VS Code, start Claude Code.
2. Add `docs/` to the Claude Project's knowledge (or keep them in the repo; `CLAUDE.md` will point to them).
3. Paste `docs/PROMPT-kickoff.md`. Approve the Step 0 plan before any code is written.
4. Phase 2 (field → design): ask Claude Code to build CONTEXT §9 Phase 2 from FIELD-AND-OFFICE §4, §6, §9.
5. Phase 3: paste `docs/PROMPT-estimating.md`. It reconciles 0002/0003 with the real 0001 before applying them.
6. Ship each phase to the team, use it for a week, then start the next one.

## Before the first real quote
- Enter your **fabricator's dealer price** for each quartz level (costs are placeholders at 70% of the market price).
- Ask TimberPeak about the **Group 3 light rail price** ($51.06, likely a typo) and the DBG/DCB label.
- Enter your **DPOR license number** (not on the website; quotes can't be sent without it).
- Replace the remaining sample costs (labor rate, plumber, electrician, haul-away, freight) with real numbers.
- Confirm the admin's hours and enter them as work windows (FIELD-AND-OFFICE §2).
- Set up the shared business phone number and decide how Facebook messages reach the app (FIELD-AND-OFFICE §8).

## Verified numbers
| Check | Result |
|---|---|
| 10x10 cabinets + trim, TimberPeak group 1, at your cost | $3,076.87 (vendor sheet: $3,076.92; cent rounding) |
| Same list in group 4 (CWO) | $6,524.56 |
| Quick estimate, group 1 + Level 3 quartz (sample labor/subs) | $20,896.43, 34.2% margin |
| Hampton Bay equivalent at Home Depot | $4,033.55 before tax (matches research) |
| Home Depot materials for the whole quote | $6,176.89 with tax; 57 of 79 lines covered |
| TS vs SQL totals | identical to the cent |
