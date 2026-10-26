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

## 2026-10-23 — Steps 4–10

| Decision                                                                                                                          | Why                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Team = 3 office people (owner/sales, PM, admin assistant) + crew without logins                                                   | Owner's description of the company                                                           |
| Roles: owner + PM = **admin**, assistant = **designer** shown as "Office" (sees and edits everything except Settings and closing) | Everyone sees everything from their phone; only admins lock financials                       |
| `tasks.trade` free text (Install crew, Plumber, Electrician…)                                                                     | Assign work to people who don't log in                                                       |
| **Team updates** feed on Today (activities from the last 48h: calls, stage moves, milestones, tasks done/blocked, payments)       | The team rarely meets; Today is the shared status board                                      |
| Lead drag to Won is refused (use _Deposit received_); drag to Lost opens the reason dialog                                        | Business rules 2 and 3                                                                       |
| Moving a lead to a new stage sets its follow-up from that stage's first rule                                                      | Rule 1 holds without asking on every drag                                                    |
| "Log a touch" pre-fills the next follow-up from rule #(outbound touches in this stage + 1)                                        | Follow-up cadence matches the playbook without thinking                                      |
| Booking a meeting from New/Contacted can move the lead to Meeting Booked, with a follow-up 24h before                             | Playbook §1 Step 2                                                                           |
| Tasks: list (grouped by milestone) is the default view on phones; board view with drag is one tap away                            | Lists are faster to tick on a phone                                                          |
| Field users can change task status on their projects; everything else on a project is office-only                                 | Matches RLS                                                                                  |
| Installments can be added/edited/deleted until received; received ones can be undone, not deleted                                 | Keeps the money trail honest                                                                 |
| A payment can be recorded with a different amount than scheduled                                                                  | Real checks differ; the balance-due math follows                                             |
| Analytics (Phase 1) = margin table + 4 tiles; open projects also show a projected margin (estimates for missing actuals)          | Spec §8 keeps the dashboard in Phase 2                                                       |
| Settings: built-in stages (new, contacted, meeting_booked, won, lost) can be renamed but not hidden                               | The app's logic keys on them                                                                 |
| Settings → Team: invites go through Clerk's org UI; roles are set in the app                                                      | DB is the role source of truth                                                               |
| PWA manifest + icons (Add to Home Screen)                                                                                         | Phone-first team                                                                             |
| Browser `confirm()` before deleting an installment or cost line                                                                   | Simple, native on phones                                                                     |
| Steps 4–5 and 6–7 were committed together                                                                                         | They share files (convert dialog lives on the lead page; payments UI is in the project page) |

## Not verified in this build environment (verify on your Mac — docs/DEPLOY.md §3)

- Sign-in against a real Clerk instance, and Supabase accepting the Clerk token (third-party auth). Needs your keys.
- Screens rendered in a browser. `pnpm build` passes and every query is type-checked against the schema
  (supabase-js validates embeds at compile time), but nothing was clicked through.
- What _was_ verified: migrations + seed apply on Postgres 16; `supabase/tests/rules_test.sql` passes (RLS per role,
  lead guards, convert, board moves → payments due, close gate, margin lock, audit, settings write protection);
  45 unit tests pass; lint, typecheck and production build are clean.

---

## Master prompt v2: the app is Tugu's sales tool (Oct 23, 2026)

Approved plan: `docs/PLAN.md`. The team app built earlier (team engine, command center, projects board,
payments schedule, close/margin lock screens) was removed; it's in git history before `9edbaff`.

| Decision | Why |
| --- | --- |
| One new `0001_core.sql` replaces the five earlier migration files; `0002`–`0006` are the handoff files byte-for-byte; glue goes in `0007` | Nothing had been applied to a real database. The handoff's own SQL tests (41) pass on the real 0001 with identical output to the stub |
| Contractor tables (`projects`, `payments`, `costs`, `change_orders`, `quotes`) use CONTEXT §5 names (`contract_value`, `amount`, `price_change`, …), not `*_cents` | 0004–0006 reference those names. No screens use these tables in sales-rep mode |
| `deals.stage` is a text key checked against `pipeline_stages` (signed-in writes); stage kinds: open / handed_off / lost | The handoff tests insert `stage = 'new'`; settings still drive the stages |
| Deal defaults trigger is named `deals_zz_defaults` | Triggers fire in name order; 0006's partner guard must run first or it rejects every partner update |
| Identity = Clerk user id only (no Clerk Organizations). First sign-in creates the rep's company (`bootstrap_owner`), limited by `ALLOWED_OWNER_EMAILS` | 0002's helpers resolve the company from `users.clerk_id`; one rep = one account |
| The TimberPeak list is imported by the app at first sign-in (`server/onboarding.ts`, same parser as `scripts/price-list-to-sql.ts`) | No psql step for the user |
| `rep_year_summary(int, numeric)` overload in 0007 | IRS 2026 rate is 72.5¢; 0006 takes whole cents. Different parameter name so PostgREST can tell them apart |
| First reply logged (`direction = out`) stamps `first_response_at` in the database | Speed-to-lead stats (`lead_source_stats`) stay honest without remembering to tap anything else |
| Deal segments: Selling (open) · With partner (handed off, job or commission still open) · Closed (lost, cancelled with nothing owed, or paid in full + commission paid) | SALES-REP-MODE §2: "Closed = commission fully paid" |
| "Could pay you $X" before a plan is picked uses the partner's cabinets plan for cabinets-only/countertops, else the other plan | PLAN.md Q10 |
| Digest: Vercel cron 19:30 + 20:30 UTC Mon–Fri; the run that is 3:30 PM in New York sends it | DST-safe with two fixed UTC crons |
| Buttons/inputs are 44 px tall on phones (h-11), 36 px on desktop | Master prompt: 44 px tap targets |
| Photos in Step 1 upload through a server action (≤ 4 MB per request, compressed to 2560 px on the phone) | Vercel's 4.5 MB request cap; signed direct uploads + offline queue come in Step 3 |

### Step 2: leads without an admin

| Decision | Why |
| --- | --- |
| Paste-a-message parser is regex rules (`lib/leads/parse-message.ts`), no AI service | PLAN Q7: no paid services. Results prefill the form; the rep fixes anything wrong |
| Missed call = "+ → Missed call" quick entry (source `call`) | PLAN Q3: a web app can't read the iPhone call log; automatic capture needs a paid business number |
| Auto-reply is sent by me: **Text it** (opens Messages prefilled) or **Copy for Messenger**; either one logs the first reply | The app can't post into Facebook Messenger; logging on tap keeps speed-to-lead honest |
| Share link `/l/<slug>` and booking `/book/<token>` are public pages that write with the service role after validating the slug/token, a honeypot field and 5 submissions / hour / hashed IP | No anon database access at all; no CAPTCHA service (PLAN Q9) |
| Booking slots: weekday 5:30–8:00 PM and Saturday 9–5, 90-minute visits, 30-minute drive buffer, nothing within 4 hours, Sundays off (Settings) | PLAN Q6 |
| Pushes during the day job: only new leads; everything else is held and goes out with the 3:30 PM run. The push carries the unread count for the home-screen badge | PLAN Q2: iOS doesn't allow silent web pushes |

### Step 3: visit, photos, quick estimate

| Decision | Why |
| --- | --- |
| Photos go phone → IndexedDB queue → signed upload URL → `deal_files` row (`confirmUpload` checks the bytes exist first); a pill shows "N photos uploading / waiting for signal" | "Photos never lost"; also avoids Vercel's 4.5 MB request cap |
| Photos are resized to 2560 px JPEG (0.82) on the phone; re-encoding drops EXIF, so GPS never leaves the phone. Capture time comes from EXIF `DateTimeOriginal` read before resizing (`lib/exif.ts`, no library) | DEALS §4 without a HEIC/EXIF dependency. No 400 px thumbnails yet (Supabase image transforms are a paid add-on) |
| Site visit "Visit done" writes two small text files into the jacket (measurements → design, appliance list → other) linked to the hand-off checklist items | The hand-off gate counts files per requirement; this satisfies it from the form without retyping |
| Required-photo checklist on the visit = tags: 4× before (walls/ceiling/floor), panel, under sink, appliance labels, sketch | SALES-REP-MODE §4 |
| Quick estimate changes save on every tap (server action) and totals come from the `quote_totals` / `quote_section_totals` views | Views are the source of truth (PROMPT-estimating rules). Client-side live preview with `quoteTotals()` can be added if signal is too weak at houses |
| "Show the client" numbers the estimate once (`share_quote()` → `26-1047-E1`), marks it sent, and updates the deal's value | DEALS §1 document numbers |
| Client view `/q/<token>`: section totals only, no tax line (tax sits inside the absorbing section), "Estimate. Final price and contract from RenoDesign Inc." + license number, valid 30 days. PDF = the phone's Print → Save as PDF | No PDF library yet (PLAN Q4); a one-tap PDF comes with the hand-off packet |
| `supabase/seed_timberpeak_demo.sql` = the price list import with the demo company id filled in | `supabase db reset` can't pass psql variables |

### Step 4: hand-off

| Decision | Why |
| --- | --- |
| Hand off = pick partner + plan on the deal's Partner tab; the database (0006) refuses without the checklist and the refusal is shown as "Add these first" next to the checklist's Add buttons | Master prompt: refusals become checklists, never raw errors |
| Packet = **Text summary** (Messages, prefilled), **Photos ZIP** (built on the phone with `fflate`, shared through the iOS share sheet) and **Packet PDF** (printable page → Save as PDF) | `fflate` is ~8 KB with no dependencies (PLAN Q4). No PDF library: the phone's print-to-PDF covers it |
| Crystal's login: More → Partners → Invite. An invite row + a Clerk email invitation; her first sign-in with that email creates a `partner` user (`accept_partner_invite`) | Works with Clerk sign-ups restricted to you |
| Partners can read the customer contact and site visit of deals handed to them (0010) | She needs the address and measurements to do the job; estimates, notes and my money stay hidden (0006) |
| Every job update (hers or mine) is logged on the deal; hers also notify me (`partner_update`, held until 3:30 PM on workdays) | One timeline, no "did you see my text?" |

### Step 5: my money

| Decision | Why |
| --- | --- |
| Commission payments: amount (negative = clawback), date, Zelle / check / ACH + reference, optional check photo filed in the deal's payments folder | SALES-REP-MODE §6; only the owner records them (0006 RLS) |
| Expenses with a receipt photo in `{company}/receipts/{year}/…` (private bucket, signed URLs) | Kept out of any deal jacket the partner can see |
| Mileage = miles typed in, or odometer start/end; "Log the drive" from a deal pre-fills it | PLAN Q8: no paid maps API |
| Year tab uses `rep_year_summary(year, 72.5)`; CSV export lists commissions received, expenses and mileage for the tax preparer | 1099 contractor; set-aside % is a savings target, not tax advice |
| Earned-and-unpaid > 14 days: red on Today and counted in the 3:30 PM digest | SALES-REP-MODE §6 |

### After launch (2026-10-26): address type-ahead, texts, new-deal fields

| Decision | Why |
| --- | --- |
| Address boxes (New deal, Customer) are one line with type-ahead: pick a real address, the server splits it into street / town / ZIP (`lib/address.ts`). Typing your own text still works | Tugu asked for FedEx-style address entry; one box is faster on a phone than street + town + ZIP |
| Provider by env: `GOOGLE_MAPS_API_KEY` (Places Autocomplete New, best house numbers; free tier ~5–10k calls/mo, **needs a billing account**) → `GEOAPIFY_API_KEY` (free 3,000/day, no card) → Photon/OpenStreetMap (no key, weak on NoVA house numbers). Calls go through `/api/address` (owner only) so keys stay server-side | Google needs a card, so it's not turned on without asking (CLAUDE.md: paid services). Works today without any key |
| `contacts` has no state column: Virginia towns are stored as the town ("Fairfax"); other states keep it ("Bethesda, MD") | Avoids altering an applied table; display and Maps links add ", VA" back |
| Ready-made texts live in `text_templates` (Settings → My texts), with `{first} {me} {brand} {partner_contact} {when} {link} {booking}`. Sends are logged in `text_sends` by template **key** + an activity | Config in the DB; logic on stable keys, not labels. New tables only (0011) |
| Sequence: On my way (visit) → Thanks for today → Here's the estimate → day 2 Any questions? → day 5 Want changes? → day 14 Still planning? → day 30 Close the file? → hand-off: Next, the contract → Ask for a referral. Running late / Confirm the visit are pick-only | Research: one ask per text, under ~160 characters, 3–5 follow-ups then a low-pressure "close the file" text; ETA texts before in-home visits |
| Sending a text points the follow-up at the next text's day (9 AM); booking a visit sets the follow-up to 45 min before it ("On my way") | The Today queue matches the text sequence |
| New deal: Town removed (comes from the picked address); added **Where it stands** (default *Visit booked* + required date/time; pasted messages and missed calls start as *New lead*) | Deals usually start after the first chat with a visit already set; the visit time drives the "On my way" reminder |
