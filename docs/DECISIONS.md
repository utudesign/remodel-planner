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
| Decision | Why |
|---|---|
| Next.js 16.4 with `cacheComponents` **off** | Every screen is per-user and auth-gated, so a static shell adds Suspense friction with no benefit |
| shadcn components written by hand in `components/ui` (new-york style), not via `shadcn add` | The build environment couldn't reach ui.shadcn.com. Same source and API. `shadcn add` works on your Mac for future components |
| shadcn runtime deps: `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | Standard shadcn set (covered by "packages pulled in by shadcn") |
| System font stack instead of `next/font/google` | No build-time font fetch; fast on phones |
| Native `<select>` for dropdowns | Better on phones and works with plain server-action forms |
| Mobile: 5-tab bottom nav, Settings in the top bar | Keeps tap targets large at 375px |
