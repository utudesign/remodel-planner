# CLAUDE.md — Kitchen Remodel Project Planner

Source of truth: `docs/CONTEXT.md` (lifecycle, data model, screens, automations, margin math).
Read the relevant section before every task. Decisions on ambiguous points go in `docs/DECISIONS.md`.
If a request conflicts with the spec, flag it and propose a spec update. Never diverge silently.

## Design references (FigJam, owner's Figma team)

| Board                              | Use it for                                                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sitemap**                        | Every screen and sub-view from sign-in. **Lead Detail → Convert to Project** (yellow) is the only link between sales and delivery                                                              |
| **Lead to Final Payment Workflow** | Lifecycle order. Follow-up loops repeat until the lead replies. First check → project auto-created. Last check → close gate (balance $0, punch clear, costs entered) → margin lock → analytics |

- Today pulls from both pipelines. It's the daily home screen.
- Settings (stages, rules, templates) drives workflow behavior without code changes.
- If the boards and `docs/CONTEXT.md` disagree, flag it. The spec wins until it's updated.
- Calendar appears on the sitemap but is Phase 2. It's not in the Phase 1 nav.

## Current phase

**Phase 1 MVP.** Auth/roles, contacts, leads board + activities + follow-up queue, convert-to-project,
projects board + milestone dates, tasks, payments, costs, per-project margin, settings CRUD.
Phase 2/3 items (Gantt, issues, change orders UI, uploads, analytics dashboard, SMS/email,
client portal, exports): **ask before building.**

## Stack (no substitutions without asking)

| Layer      | Choice                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| App        | Next.js (latest, App Router), TypeScript strict, pnpm                      |
| UI         | Tailwind, shadcn/ui, lucide-react, dnd-kit (kanban), Recharts              |
| Data       | Supabase Postgres + Storage + RLS, Supabase CLI, SQL migrations            |
| Auth       | Clerk + Organizations (org = company). Roles: `admin`, `designer`, `field` |
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
- **RLS:** every table has `company_id` and policies keyed on the Clerk org claim.
  Field role sees only projects they're assigned to.
- **UI:** mobile-first, must work at 375px. Every list has empty, loading, error, and overdue states.
  Overdue = red badge.
- **Secrets:** `.env.local` only (gitignored). Every var documented in `.env.example`.

## Business rules (enforce server-side; DB constraint/trigger where practical)

1. Every open lead has `next_follow_up_at`. Missing or overdue → Today screen.
2. A lead becomes a project only when the deposit (first payment) is recorded.
3. Lost requires a `lost_reason`.
4. Close requires: balance due = 0, punch list has 0 open items, actual costs entered.
   Close locks margin. Post-close edits: admin only, written to audit log.
5. Revenue = contract value + Σ approved change orders.
   Gross margin % = (revenue − actual cost) ÷ revenue.
6. New lead → follow-up = now + 1h, owner = default owner.

## Folder structure

```
app/
  (auth)/sign-in/[[...sign-in]]/page.tsx
  (auth)/sign-up/[[...sign-up]]/page.tsx
  (app)/layout.tsx            sidebar (desktop) + bottom nav (mobile)
  (app)/today/page.tsx
  (app)/leads/page.tsx        kanban
  (app)/leads/[id]/page.tsx
  (app)/projects/page.tsx     kanban by milestone
  (app)/projects/[id]/page.tsx  tabs: overview, tasks, payments, costs
  (app)/payments/page.tsx
  (app)/analytics/page.tsx    Phase 1: per-project margin list only
  (app)/settings/...          admin only
  api/webhooks/clerk/route.ts
components/
  ui/                         shadcn (generated, don't hand-edit)
  leads/ projects/ payments/ shared/
lib/
  auth/require-role.ts
  supabase/{server,client,admin}.ts
  money.ts dates.ts margin.ts follow-up.ts close-rule.ts payment-schedule.ts
  validation/*.ts             Zod schemas
server/actions/*.ts
supabase/migrations/  supabase/seed.sql
tests/                        Vitest
docs/CONTEXT.md DECISIONS.md DEPLOY.md
proxy.ts                      Clerk middleware (Next 16+ name; middleware.ts on ≤15)
```

## Definition of done (every step)

1. `pnpm lint && pnpm typecheck && pnpm build` pass with zero errors.
2. Vitest passes. Required coverage: money math, margin, follow-up dates, close rule, payment schedule.
3. One commit per step, clear message.
4. Summary to the owner: what was built, how to test it in the browser, what's next.

## Stop and ask when

- Adding a dependency, or changing an applied table.
- Something is hard to undo (data deletes, auth model, production env).
- A request belongs to Phase 2/3.
  Otherwise pick the simplest option, log it in `docs/DECISIONS.md`, keep going.
