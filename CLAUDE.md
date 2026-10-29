# CLAUDE.md — RenoDesign Kitchen Sales Tool (one company, first contact → paid in full)

**Since 0015 (2026-10-27) this is RenoDesign's own tool: no hand-off, no commission.** The newest
`docs/DECISIONS.md` entry ("One company") wins over older docs, including SALES-REP-MODE's hand-off/commission parts.

Read first, in this order (earlier wins on conflict): `docs/DECISIONS.md` (0015 entry), `docs/SALES-REP-MODE.md`, `docs/DEALS.md`,
`docs/QUICK-ESTIMATE.md` + `docs/ESTIMATING.md`, `docs/COMPLIANCE-AND-OPS.md` §0, `docs/CONTEXT.md`
(its team/admin/crew parts are an optional contractor module: no screens now), `docs/research/`.
The approved build plan is `docs/PLAN.md`; decisions go in `docs/DECISIONS.md`.
If a request conflicts with the spec, flag it and propose a spec update. Never diverge silently.

Roles: `owner` (Tugu: everything + Settings + Team invites), `team` (Crystal, Ahn, …: every deal, estimate,
visit, job, KPI **in their workspace**; invited from More → Team), `partner` (legacy; 0015 turned existing ones into `team`), `crew` unused.
**Workspaces (0016):** each deal lives in one workspace; another workspace sees it only when it's shared (`deal_shares`,
full edit, both ways). Workspace admins (owner, Crystal) run their own Team page. Settings/texts/stages stay company-wide.

**Tested handoff code — use it, don't rewrite it:** `supabase/migrations/0002`–`0006`,
`lib/estimating/*`, `lib/deals/dealNumber.ts`, `lib/commission/commission.ts`, `supabase/seed/*`,
`scripts/price-list-to-sql.ts`, `test/*`. Changes go in new migrations (`0007`, `0008`, …).

## Stack (no substitutions without asking)

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| App        | Next.js (latest, App Router), TypeScript strict, pnpm                      |
| UI         | Tailwind, shadcn/ui, lucide-react, dnd-kit (kanban), Recharts              |
| Data       | Supabase Postgres + Storage + RLS, Supabase CLI, SQL migrations            |
| Auth       | Clerk (user id → `public.users`; no Organizations). Roles in the DB      |
| Validation | Zod in every server action / route handler                                 |
| Dates      | date-fns + date-fns-tz. Store UTC, display `America/New_York`              |
| Tests      | Vitest                                                                     |
| Deploy     | Vercel (Framework Preset: Next.js)                                         |

Ask before adding any dependency not listed here.

## Conventions

- **Money:** integer cents everywhere (`*_cents bigint`). Format only at the UI edge via `lib/money.ts`.
  Percentage splits: round each installment down, last installment absorbs the remainder.
- **Time:** events = `timestamptz` (UTC); calendar days = `date`. Convert with `lib/dates.ts` only.
- **Mutations:** server actions in `server/actions/*`. Each one: Zod parse → `requireRole()` →
  query scoped by `company_id` (RLS adds the workspace) → `revalidatePath`. Never trust client-side role checks.
- **Config lives in the DB:** pipeline stages, follow-up rules, payment templates, task templates,
  cost categories, lost reasons. Never hard-code them. Use stable `key` columns for logic, not labels.
- **Migrations:** new file per change in `/supabase/migrations`, RLS policies in the same file.
  Never edit an applied migration. Ask before altering a table whose migration is applied.
- **RLS:** every table is scoped by `company_id` via `public.current_company_id()` (Clerk `sub` →
  `users`). Deal data also needs `can_see_deal()` (own workspace or shared, 0016); Settings and config
  writes are owner-only (`is_owner()`); invites/lead links are per workspace admin (`is_ws_admin()`).
- **UI:** iPhone first at 375 px, 44 px tap targets, one hand. Every list has empty, loading, error and
  overdue states (overdue = red). A database refusal becomes a checklist with **Add** buttons, never a raw error.
- **Photos are never lost:** offline queue (IndexedDB) until the `deal_files` row exists.
- **Secrets:** `.env.local` only (gitignored). Every var documented in `.env.example`.

## Business rules (the database enforces them; see `supabase/tests/rules_test.sql` + `test/`)

1. Every open deal has `next_follow_up_at` (new lead = +1 h; each stage/touch resets it from the rules).
2. Lost requires a lost reason. Deals are never hard-deleted; numbers (`26-1047`) are never reused.
3. A deal becomes Sold only through `mark_sold()` (0015): the job-ready checklist (`before_handoff` gate key)
   complete + a sold price. It moves the deal to the Sold stage (kind `handed_off`), starts the job timeline and
   ticks Contract signed (+ Deposit). Sold deals have no sales follow-up; job steps take over.
4. Revenue = sold price + change orders. Gross profit = revenue − job costs. No commission (0015).
5. Client payments are recorded as dates on the deal (deposit, paid in full); no card processing in the app.
6. Legacy: partner/commission tables (0006) stay for history; the app no longer reads or writes them.

## Folder structure

```
app/(app)/today  deals  deals/new  deals/[number] (jacket)  jobs  kpis  more  team  feedback  settings  pick
app/p/…  money  partners      old routes, redirect only
app/api/cron  app/api/webhooks/clerk
components/deals  components/settings  components/shared  components/ui
lib/auth  lib/deals  lib/estimating  lib/commission  lib/validation  money.ts dates.ts workday.ts storage.ts
server/actions  server/queries  server/onboarding.ts  server/digest.ts  server/push.ts
supabase/migrations (0001–0007…)  supabase/seed.sql  supabase/seed/  supabase/tests/rules_test.sql
test/                         handoff SQL tests (run by scripts/test-db.sh)
tests/  lib/**/__tests__      Vitest
```

## Definition of done (every step)

1. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass; `scripts/test-db.sh` passes.
2. One commit per step, clear message.
3. Tell the owner how to test it on his phone.

## Stop and ask when

- Adding a paid service or a heavy library, or changing an applied table.
- Something is hard to undo (data deletes, auth model, production env).
- Building more of the contractor module (team/admin/crew screens). Jobs (milestones, tasks, costs) + KPIs exist (0013).
  Otherwise pick the simplest option, log it in `docs/DECISIONS.md`, keep going.
