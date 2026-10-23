# Remodel Planner

Leads → projects → payments → margin for a small kitchen remodel team. Phone-first; installs to the home screen.

| Read                       | For                                                                          |
| -------------------------- | ---------------------------------------------------------------------------- |
| `docs/CONTEXT.md`          | Product spec (source of truth)                                               |
| `docs/DECISIONS.md`        | Every call made where the spec was silent, plus proposed spec updates        |
| `docs/PLAYBOOK-MAPPING.md` | How the Sales & Estimating Playbook maps to app defaults, and what's Phase 2 |
| `docs/DEPLOY.md`           | Local setup, production deploy, smoke test                                   |
| `CLAUDE.md`                | Conventions for Claude Code sessions                                         |

## Quick start

```bash
pnpm install
cp .env.example .env.local      # fill Clerk + Supabase keys (docs/DEPLOY.md §1)
pnpm db:start && pnpm db:reset
pnpm dev
```

## Scripts

| Command         | Does                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| `pnpm dev`      | Dev server                                                              |
| `pnpm check`    | Lint + typecheck + unit tests + build                                   |
| `pnpm test`     | Vitest (money, margin, follow-ups, close rule, payment schedule, dates) |
| `pnpm db:reset` | Re-apply migrations + demo seed locally                                 |
| `pnpm db:types` | Regenerate `types/db.ts` from the local DB                              |

## Where things live

```
app/(app)/            today · leads · projects · payments · analytics · settings
components/           ui (shadcn) · leads · projects · payments · settings · shared
lib/                  money · dates · follow-up · payment-schedule · margin · close-rule · validation
server/actions/       mutations (Zod → requireRole → RLS-scoped query → revalidate)
server/queries/       reads
supabase/migrations/  0001 schema · 0002 RLS · 0003 rules/RPCs/defaults
supabase/tests/       SQL tests for RLS + business rules
```
