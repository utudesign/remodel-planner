# CLAUDE.md — Kitchen Sales Tool (Tugu's personal sales app)

Read first, in this order (earlier wins on conflict): `docs/SALES-REP-MODE.md`, `docs/DEALS.md`,
`docs/QUICK-ESTIMATE.md` + `docs/ESTIMATING.md`, `docs/COMPLIANCE-AND-OPS.md` §0, `docs/CONTEXT.md`
(its team/admin/crew parts are an optional contractor module: no screens now), `docs/research/`.
The approved build plan is `docs/PLAN.md`; decisions go in `docs/DECISIONS.md`.
If a request conflicts with the spec, flag it and propose a spec update. Never diverge silently.

Roles: `owner` (Tugu, the rep), `partner` (Crystal at RenoDesign, optional login), `team`/`crew` unused.

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
  query scoped by `company_id` → `revalidatePath`. Never trust client-side role checks.
- **Config lives in the DB:** pipeline stages, follow-up rules, payment templates, task templates,
  cost categories, lost reasons. Never hard-code them. Use stable `key` columns for logic, not labels.
- **Migrations:** new file per change in `/supabase/migrations`, RLS policies in the same file.
  Never edit an applied migration. Ask before altering a table whose migration is applied.
- **RLS:** every table is scoped by `company_id` via `public.current_company_id()` (Clerk `sub` →
  `users`). Owner sees everything in the company; a partner only what 0006 grants (deals handed to
  her company, job fields, hand-off files).
- **UI:** iPhone first at 375 px, 44 px tap targets, one hand. Every list has empty, loading, error and
  overdue states (overdue = red). A database refusal becomes a checklist with **Add** buttons, never a raw error.
- **Photos are never lost:** offline queue (IndexedDB) until the `deal_files` row exists.
- **Secrets:** `.env.local` only (gitignored). Every var documented in `.env.example`.

## Business rules (the database enforces them; see `supabase/tests/rules_test.sql` + `test/`)

1. Every open deal has `next_follow_up_at` (new lead = +1 h; each stage/touch resets it from the rules).
2. Lost requires a lost reason. Deals are never hard-deleted; numbers (`26-1047`) are never reused.
3. Hand-off requires a partner, one of that partner's plans and the `before_handoff` checklist (0006).
4. A partner can update only job progress and price (0006). Only the owner records commission payments.
5. No client money in this app except as reported by the partner.
6. Commission = plan rate × (sold price + change orders), floor per plan; first payout at deposit,
   rest at paid in full (`deal_commissions`, `lib/commission`).

## Folder structure

```
app/(app)/today  deals  deals/new  deals/[number] (jacket)  money  more  partners  settings  pick
app/p/…                       partner login screens
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
- Building the contractor module's screens (team/admin/crew).
  Otherwise pick the simplest option, log it in `docs/DECISIONS.md`, keep going.
