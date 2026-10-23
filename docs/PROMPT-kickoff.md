# Kickoff prompt: Phase 1 "Team engine"

Paste into Claude Code from the repo root of the real project. The spec is in `docs/`.

---

You're building a phone-first web app on my Mac (Apple Silicon) in this folder. Read **all** of `docs/CONTEXT.md`, `docs/FIELD-AND-OFFICE.md` and `docs/ESTIMATING.md` before doing anything. CONTEXT is the source of truth; the other two add detail. We build in the phases of CONTEXT §9. **This prompt is Phase 1 only.**

## Step 0 — Plan first, don't code yet

1. Create `CLAUDE.md` at the repo root (under 150 lines): stack, conventions, roles (owner/team/crew), business rules, folder structure, phase list, pointers to the three docs.
2. Give me a Phase 1 plan as a table (step, files touched, how we verify on a phone). List spec gaps and questions. Then STOP and wait for approval.

## Stack (don't substitute without asking)

Next.js (latest, App Router) + TypeScript strict, pnpm · Tailwind + shadcn/ui, lucide-react · Supabase (Postgres, Storage, RLS, CLI migrations in `/supabase/migrations`) · Clerk with organizations; roles `owner`, `team`, `crew`; Clerk users synced to `users` by webhook · Zod + server actions · date-fns + date-fns-tz (store UTC, show America/New_York) · money in integer cents · `web-push` with VAPID keys.

## Phase 1 scope (one step per commit)

1. **Scaffold + PWA:** `app/manifest.ts` + icons (installable, standalone), bottom tab bar (Today · Leads · Jobs · Money · More) + floating **+** button, sidebar on ≥ 1024 px, `.env.example`.
2. **Auth + roles:** Clerk middleware, org required, `requireRole()`, webhook `/api/webhooks/clerk`. Owner + team see everything; only owners change settings/users; crew sees only assigned jobs, never money.
3. **Database `0001`:** the **full** schema from CONTEXT §5 and FIELD-AND-OFFICE §9, even for screens built in later phases (0002 estimating depends on `projects`, `tasks`, `costs`). RLS for all three roles; crew-safe views without money. Seed: 2 owners, 1 team, 1 crew; work windows per FIELD-AND-OFFICE §2; 5 leads in different stages.
4. **Leads:** list by stage; lead detail with Call · Text · Navigate · Log; activity timeline; required next follow-up; lost reason; **quick-add** (paste a message or screenshot → new lead with source).
5. **Routing + quiet hours:** work windows editor (Settings), new-lead assignment by who is live, "waiting for live shift" flag, 1-hour response clock, scheduled messages saved during quiet hours (Phase 1 = reminder at send time; no SMS provider yet).
6. **Same page:** `events` written in the same transaction as each mutation; Activity feed; comments with @mentions + photos; unread dots; owner/assignee chips with one-tap reassign.
7. **Web push:** subscribe after "Add to Home Screen"; notification matrix from CONTEXT §4 for new lead, mention, info request, design ready; per-user mute.
8. **Command center:** FIELD-AND-OFFICE §7 sections 1–4 and 9 (the rest arrive with later phases), shift checklists, shift handoff + 7:00 AM morning brief pinned in the feed.
9. **Today:** Mine / Team tabs.
10. **Settings (owners):** users + roles, stages, follow-up rules, work windows, quiet hours, notification defaults, lost reasons.

## Rules

- After each step: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, all green; commit.
- Vitest for follow-up dates, routing by work window (incl. the Nov 1 DST change), quiet-hours scheduling, and RLS (crew can't read money; team can't change settings).
- Every screen at 375 px, tap targets ≥ 44 px; check on an iPhone-sized viewport.
- Ask before adding a dependency or changing a table after its migration is applied. Never hard-code stages, rules or windows. Never commit secrets.
- Ambiguity: choose the simplest option, log it in `docs/DECISIONS.md`, continue; stop only for hard-to-undo choices.
- After each step: what was built, how to test it on my phone, what's next.

## When Phase 1 is done

Write `docs/DEPLOY.md`: GitHub push, Vercel import (Framework Preset: Next.js), all env vars (Clerk, Supabase, VAPID), Supabase production migration, Clerk production instance + webhook URL, "Add to Home Screen" steps for iPhone and Android (push needs it on iPhone), smoke-test checklist for all three of us.

Start with Step 0.
