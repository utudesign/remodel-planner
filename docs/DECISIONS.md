# Decisions Log

Format: date · decision · why. Times in ET.

## 2026-10-23 — Phase 1 plan approved

### Data model additions (approved, spec update pending)

| #   | Decision                                                                                                   | Why                                                    |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1   | `tasks.kind` enum: `task` \| `punch`                                                                       | The close rule needs "punch list = 0 open items"       |
| 2   | "Actual costs entered" = ≥1 cost row AND every row has `actual_amount_cents` not null                      | Makes the close rule testable                          |
| 3   | New table `project_members(project_id, user_id)`                                                           | Field RLS: "sees only assigned projects"               |
| 4   | `projects.locked_revenue_cents`, `locked_cost_cents`, `locked_margin_bps`, `locked_at` + `audit_log` table | Margin lock and admin-only, logged post-close edits    |
| 5   | `change_orders` table created in Phase 1, no UI                                                            | Revenue formula includes approved change orders        |
| 6   | `companies.clerk_org_id unique`; `organization.created` webhook copies default settings                    | Org ↔ company link; per-company editable config        |
| 7   | `users.role` is the role source of truth; Clerk = identity + org membership                                | Avoids Clerk plan limits on custom roles; RLS reads DB |
| 8   | `leads.stage_id` FK → `pipeline_stages`, with stable `key`s (`won`, `lost`, ...)                           | Labels stay editable; logic keys on `key`              |
| 9   | Contract value entered manually in the Convert dialog                                                      | No quote UI until later                                |

### Behavior defaults

| Decision                                                               | Why                                                                     |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Follow-up offsets = calendar days, snapped to 9:00 AM ET               | Simplest; avoids business-day calendar                                  |
| Minimal "Book meeting" on lead detail                                  | The Today screen's meetings section needs a source                      |
| Analytics nav = per-project margin list only                           | Dashboard is Phase 2                                                    |
| Supabase ↔ Clerk via native third-party auth (`auth.jwt()->>'org_id'`) | The JWT template approach is deprecated                                 |
| Percentage installments round down; last one absorbs the remainder     | Installments sum exactly to the contract                                |
| Payment overdue = due + 3 days                                         | Spec §6                                                                 |
| **Calendar** is not in Phase 1 nav                                     | It's on the sitemap but is Phase 2 (spec §8). Added when Phase 2 starts |

### Dependencies approved

`@clerk/nextjs`, `@supabase/supabase-js`, `@supabase/ssr`, `@dnd-kit/core`, `@dnd-kit/sortable`, `zod`, `date-fns`, `date-fns-tz`, `recharts`, `lucide-react`, `vitest`, `prettier`, `supabase` (CLI, dev), plus Radix packages pulled in by shadcn.

## 2026-10-23 — Build notes (Step 1)

| Decision                                                                                                | Why                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.4 with `cacheComponents` **off**                                                             | Every screen is per-user and auth-gated, so a static shell adds Suspense friction with no benefit                             |
| shadcn components written by hand in `components/ui` (new-york style), not via `shadcn add`             | The build environment couldn't reach ui.shadcn.com. Same source and API. `shadcn add` works on your Mac for future components |
| shadcn runtime deps: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | Standard shadcn set (covered by "packages pulled in by shadcn")                                                               |
| System font stack instead of `next/font/google`                                                         | No build-time font fetch; fast on phones                                                                                      |
| Native `<select>` for dropdowns                                                                         | Better on phones and works with plain server-action forms                                                                     |
| Mobile: 5-tab bottom nav, Settings in the top bar                                                       | Keeps tap targets large at 375px                                                                                              |

## 2026-10-23 — Database (Step 3)

| Decision                                                                                                                                                                                                    | Why                                                                                   | Spec update proposed                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| Milestone dates live **only** in `milestones` (planned + actual). `projects` keeps no `order_date`, `start_date`, … columns                                                                                 | One source of truth; no sync bugs between two copies of the same date                 | §4: drop the date columns from `projects` |
| `payments.status` = `pending` (trigger not reached) / `due` / `received`. **Overdue is derived** (`due` and `due_date + 3 days < today`), not stored                                                        | No cron job needed; always correct                                                    | §3C: overdue is computed                  |
| `payments.received_on date` (spec: `received_at`)                                                                                                                                                           | A check arrives on a day, not at an instant                                           | §4 rename                                 |
| Rules enforced in Postgres triggers/RPCs: follow-up required, lost reason, won-only-via-deposit, stage-change log, milestone → payment due, all paid → Final Payment milestone, closed-project lock + audit | Holds no matter which screen or script writes                                         | —                                         |
| `convert_lead_to_project`, `move_project_to_milestone`, `close_project` are SQL functions (atomic)                                                                                                          | Multi-table writes must be all-or-nothing                                             | —                                         |
| Close is **admin-only**                                                                                                                                                                                     | It locks financials                                                                   | —                                         |
| Dragging a project card back on the board clears later milestone dates (and reverts their installments to pending)                                                                                          | The board reflects what's done; deposit/closed can't be dragged                       | —                                         |
| `milestone_definitions` table (seeded), no Settings UI in Phase 1                                                                                                                                           | The kickoff's Settings list doesn't include milestones; keeps them out of code anyway | —                                         |
| `leads.notes` (qualifying answers), `leads.stage_entered_at`                                                                                                                                                | Playbook §1; follow-up offsets count from stage entry                                 | §4 add                                    |
| Cost categories = playbook §5 buckets (Cabinets, Countertop, Materials, Labor, Subcontractors, Job costs, Contingency)                                                                                      | Estimate-vs-actual per bucket, as the playbook asks                                   | §4 categories                             |
| Payment templates = playbook §6 (Cabinets + counters + install 50/25/25, Cabinets only 70/30, Large full remodel 30/30/30/10)                                                                               | The playbook is the real practice                                                     | §3C                                       |
| Default task template = playbook §7/§9 phases (16 tasks)                                                                                                                                                    | Same                                                                                  | §6 template                               |
| Target margin default 35% in `companies.settings_json`                                                                                                                                                      | Playbook: 35–45%                                                                      | §7 target line                            |
| `bootstrap_membership()` creates the company + member on first sign-in **and** from the webhook                                                                                                             | Local dev works without a webhook tunnel                                              | —                                         |
| Seed users (`clerk_id` like `seed_%`) don't count as real members: the first real sign-in becomes admin + default owner                                                                                     | Lets you claim the demo company                                                       | —                                         |
| Removed `@supabase/ssr`                                                                                                                                                                                     | Auth is Clerk; a plain `supabase-js` client with `accessToken` is all we need         | —                                         |
| No browser Supabase client                                                                                                                                                                                  | All data access is server-side (RLS still applies)                                    | —                                         |
| SQL rule tests in `supabase/tests/rules_test.sql` (visibility per role, guards, convert, board moves, close gate, margin lock, audit, settings)                                                             | Rules are the riskiest part; they're tested at the DB                                 | —                                         |
