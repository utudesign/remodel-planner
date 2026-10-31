# PLAN v3: Change request v3, Step 0 (plan only, no code)

Status: **approved Oct 31, 2026 with the defaults (Q1–Q21).** Batches A (0017), B (0018) and C (0019, Skyline = Spring Forest 2026) built. Skyline = Spring Forest price lists (batch C). Older plan (Oct 23, sales tool) is in git history before this commit.

---

## 0. The direction conflict: the request is based on an old PLAN.md

PLAN.md still describes Oct 23 (sales tool, hand-off, commission, Step 6 next). The repo has moved on since then:

| Date | Commit / migration | What changed | Status of PLAN.md |
|---|---|---|---|
| Oct 26 | `bf059ad` / 0013 | Crystal joined the team; **jobs came back** (`projects`, `job_milestones` from templates, `tasks`, `costs`, /jobs timeline bars, /kpis) | Not reflected |
| Oct 27 | `c0587b3` / 0015 | **One company**: no hand-off, no commission. **Mark sold** replaces hand-off, everyone is `team`, Money/Partners removed | Not reflected |
| Oct 29 | `dfdec46` / 0016 | **Workspaces** (Crystal's own) + Share per deal (`can_see_deal()`) | Not reflected |

So items 13–18 don't bring the team back from nothing: they extend 0013 and add **crew + customer** logins. That is the real reversal.

### 0a. What v3 reverses

| Where | Current rule | v3 change |
|---|---|---|
| PLAN.md §1 (Q1) | Team engine + crew screens removed; "contractor module, no screens" | Crew screens, job PM, daily reports come back |
| CLAUDE.md "Stop and ask" | "Building more of the contractor module" needs a stop | It becomes the plan |
| CLAUDE.md roles | `crew` unused | `crew` (+ trade) used; new `customer` |
| CLAUDE.md rule 3 + DECISIONS Step 3 | Checklist counts **files** only | Manual tick counts too (logged) |
| CLAUDE.md rule 5 | Payments = dates on the deal | Payment installments (`payments` table) with a payment link |
| DECISIONS 0013 | /jobs = one bar per job + milestones | Board / Timeline / List / My work, phases → tasks with % |
| DECISIONS 0015 | Tabs: Today · Deals · Jobs · KPIs · More, Today first | **Deals is home** |
| ESTIMATING / QUICK-ESTIMATE spec | Takeoff (corners, openings, run, doors, drawers) drives auto quantities | Takeoff removed; accessories typed by hand |
| Project spec `kitchen-remodel-planner-context.md` | Roles admin/designer/field; job starts at deposit | Roles owner/team/crew/customer; job starts at Mark sold (Q9) |

### 0b. Stale references in the change request itself (I'll read them this way unless you say otherwise)

| Request says | Reality | I'll use |
|---|---|---|
| New migrations `0008_…`; never edit 0001–0007 | 0008–0016 already exist | **`0017_…` onward; never edit 0001–0016** |
| "partner updates" in History, "partner" filter on Deals | No partners since 0015 | History shows job updates; filter = **salesperson** + **Shared with me** |
| "estimate used at hand-off" can't be deleted | Hand-off is now Mark sold | "sent to client **or** the deal is Sold" |
| Item 18 roles table has no `team` row, no workspaces | Crystal/Ahn are `team`, deals live in workspaces | `team` = owner minus Settings (as now); crew sees assigned jobs across workspaces |

### 0c. Reusable from git history (`b03802a` and earlier)

| Old piece | Commit | Reuse |
|---|---|---|
| `crew` role + `is_assigned_to_project()` + crew RLS on `projects`, `deals`, `deal_files`, `project_materials` | 0001/0002/0004 (still live) | **Yes, as is.** Crew infrastructure never left the DB |
| `deal_files.crew_visible` + check "money folders never crew-visible" | 0004 (live) | Yes |
| `project_materials` crew guard (crew updates pack/receive only) | 0002 (live) | Yes, for "Countertop: ordered" |
| `crew_projects` security-barrier view (money lockdown) | `3810d11` team_engine | Pattern for `job_worker_view` |
| `issues` table (type, cost/schedule impact, photos) | `3810d11` | Copy the shape into `job_issues` |
| `comments` + @mentions + `events` triggers + notification fan-out | `3810d11`, `5c7db3a` | Task comments + job feed (trimmed) |
| `project-board.tsx` (dnd-kit kanban), `lead-board.tsx`, `stage-control.tsx` | `326b173`, `5c7db3a` | Starting point for Deals kanban + Jobs board |
| Settings → task templates editor | `d5d3509` | Phase/task template editor |
| Old Today sections (blocked tasks, starts this week, late deliveries) | `9bcd068` | Ideas for Today v2 |
| Projects close gate / margin lock | `4cd7c2b` | Not now (no close flow requested) |

---

## 1. Item by item

| # | Current behavior (file/route) | Proposed change | Mig | Size | Batch |
|---|---|---|---|---|---|
| 1 | `deal_jacket_checklist` view + `deal_gate_missing()` (0004 L236–256) count **files only**; `mark_sold()` (0015 L104) raises if any are missing | New `deal_checklist_checks` (deal, requirement, checked_by, checked_at, note). 0017 redefines the view (columns appended) and `deal_gate_missing()` so a tick satisfies the item; ticks/unticks go to History. **Yes, the DB gate requires a file today**, so this is the override. "Add photo/file" stays | Y | M | B |
| 2 | Texting cards are at the **top** of Overview (`AutoReplyCard`/`QuickTexts`, `deals/[number]/page.tsx` L292–313) | Move both to the end of Overview | N | S | A |
| 3 | Header "Log" button → `?tab=activity#log` (L244); `ActivityTab` lists `activities` only; **`audit_log` exists but nothing writes to it** | Generic audit trigger (old → new per changed column) on deals, contacts, deal_files, quotes, quote_line_items, meetings, site_visits, job tables, checklist checks; add `audit_log.deal_id`; `deal_history` view = audit_log ∪ activities ∪ daily reports. History tab with type filter chips, ET times, "+ Note" | Y | L | B |
| 4 | `StageForm` (`components/deals/jacket-forms.tsx` L28): native select + Move | **Bug:** React 19 resets a `<form action>` after the action finishes. The select is controlled (`picked` state), but the DOM reset puts it back on the first `<option>` without a re-render, so the screen and state disagree; `useState(stage)` also never picks up the new stage. Fix: stepper replaces it; until then `key={stage}` on the form. Stepper: highlighted current stage, **Next: <stage>**, tap to jump, confirm backward, Lost → reason sheet, Sold → Mark sold sheet (the DB refuses other moves into Sold). Follow-up as text + +1d / +3d / +1w / pick | N | M | A (bug) / B |
| 5 | Visit card has Done/Cancel per **scheduled** meeting (`MeetingButtons`, `setMeetingStatus` in `server/actions/deals.ts` L291): sets done, moves to `visit_done` from a **hard-coded** stage list, logs activity | Two buttons: Book/Edit visit + **Mark as visited** (works with no booked meeting: creates a done one). Stage move uses `pipeline_stages.sort_order`, not a hard-coded list; follow-up from `follow_up_rules` | N | S | B |
| 6 | No delete on estimates. `quotes.status` ∈ draft/sent/approved/superseded/lost (0002 L279) | `quotes.deleted_at`, `archived_at`. Draft → soft delete (confirm). Sent / deal Sold → **Archive** only (DB trigger refuses delete). Totals, deal value, client link ignore deleted; archived stay readable. History entry | Y (alter `quotes`) | M | A |
| 7 | Tab label renders `Photos` + count as **"Photos 1"** (L276–278) | Heading **Photos**, count as a small badge | N | S | A |
| 8 | Files `UploadButton` accepts `image/*, pdf, doc, docx, xls, xlsx` (`upload-button.tsx` L108); bucket `deal-files` has **no** `allowed_mime_types` or size limit (0004 L393) | Client `accept`, Zod (MIME + extension), DB trigger on `deal_files` (non-photo folders = pdf/doc/docx), bucket allowed types. ⚠ The bucket also holds photos, so the bucket list must allow images + pdf/doc/docx; the per-folder rule lives in the trigger. Images picked in Files are routed to Photos | Y | S | A |
| 9 | Builder has Corners, Openings, Cabinet run, Doors, Drawers (`components/estimates/builder.tsx` L75–88) feeding `quotes.takeoff` → auto quantities (`lib/estimating/takeoff.ts` L92–97: crown, light rail, toe kick, scribe sticks, pulls) | Remove the takeoff block. **Accessories list** per brand (fillers, toe kick, under-cab lights, scribe, crown, panels, DW end panel + Add item) with qty steppers, from new `estimate_accessories` (price list → catalog item, sort). ⚠ Auto quantities stop; you type them | Y | M | C |
| 10 | Flow today: measure → color group → quartz → items (code search). TimberPeak = `price_lists.vendor` + 4 `catalog_collections` + 1,116 `catalog_items` | Brand → Color → Cabinets (empty; bulk-add sheet by Wall / Base / Corner / Pantry / Vanity / Accessories, multi-select with qty) → Labor → Countertop (level, sq ft, sink type, cutouts) → Special work (electrical, gas, plumbing, flooring, other) → client view unchanged. Suggestion chips, not prefilled lines. **Brand is already a column** (`price_lists.vendor`); Skyline = new price list + its own collection rows with the same color names. Cabinet groups from a `catalog_groups` rule table (code prefix → group), editable | Y | L | C |
| 11 | Tags hard-coded in `lib/deals/display.ts` L80 **and** a CHECK on `deal_files.photo_tag` (0004 L173); picker = chips in `photo-capture.tsx`; grid grouped by tag; no re-tag | `photo_categories` table (Settings), replace the CHECK with a trigger, pick on upload (default by screen), re-tag in viewer, filter chips with counts, required-photo checklist reads categories (min count per category). Mapping below. **Plus 400 px thumbnails** (see §3) | Y (alter `deal_files`) | M | D |
| 12 | — | Answered in §3 | — | — | now |
| 13 | /jobs = bar per job + lists (`app/(app)/jobs/page.tsx`); `job_milestones` from 13-step template; `tasks` = title/assignee/status/due only | **Phases** = ordered task groups from an editable template (your 9 defaults); `tasks` get phase, trade, planned start/end (+ optional times), % complete, sort, comments, photos. Milestones stay as business checkpoints (contract, deposit, ordered, delivered, paid). Views: Board (columns = current phase), Timeline (Gantt bars per job, phase segments, overlap/crew-conflict marks), List, My work | Y (alter `tasks`) | L | F2 |
| 14 | `users.role` ∈ owner/partner/team/crew (0001 L40); crew RLS live but no crew screens | `crew` + `users.trade` (installer / plumber / electrician / other, from `trades` table) and new `customer` role. Daily report: job → tasks today with % sliders → issue (type, note, photo, needs re-order) → tomorrow plan → Submit. Updates task %, job %, feed, Today, deal History. Evening push to assigned crew with no report | Y (alter `users`) | L | F1 / F3 |
| 15 | Nothing | `site_rules` (1 per deal, copied to job): hours per weekday, quiet after, off site by, building type, contacts/elevator/parking/debris/gate/pets. Block on deal Overview, job header, report screen. Timeline warns on tasks outside allowed days/times | Y | M | F2 |
| 16 | No payment installments in the UI since 0015 (deposit/paid dates on the deal) | **Melio has no API for this** (§4). Manual: installments on the job (`payments` table + `link_url`, `link_sent_at`, `provider_ref`), paste link → **Text it** → Mark paid with Melio ref. Link shows on the customer page | Y (alter `payments`) | S | G |
| 17 | `/` redirects to `/today` (`app/page.tsx`); Deals = Selling/Sold/Closed lists; Today = Reply now, Job steps due, Visits today, Follow up, Contract + deposit, No touch in 2 days | `/` → Deals. Kanban (dnd-kit, already installed) with stage tabs on phone; drop on Sold opens Mark sold, Lost opens reason. List toggle + filters (scope, source, overdue, salesperson, shared). Today redesign (§5) | N (kanban) / Y (Today data from F/G) | L | E1 / E2 |
| 18 | Crew RLS exists for projects/deals/files but **crew can read `deals` rows directly** (0001 L548), which carry `estimated_value`, `sold_price_cents`, notes | Crew/customer get **no direct select** on deals, site_visits, quotes, deal_intake, payments, costs. They read only security-barrier views: `job_worker_view`, `job_worker_visit` (walls, appliances, measurements; no ballpark), `job_worker_files` (photos + design/permits/warranty), `job_customer_view`. SQL tests per role (worker reads own job photos/measurements, 0 money columns, 0 rows for other jobs; customer only own job) | Y | L | F1 |

### Photo tag → category mapping (item 11)

| Old tag | New category |
|---|---|
| before | Before |
| measurement, sketch, appliance_label | Measurements |
| under_sink | Plumbing |
| panel | Electrical |
| issue | Issue |
| after | Completion/After |
| progress | Completion/After (or a new **Progress** category, Q8) |
| delivery | Damage (delivery check) |
| other, empty | **Other** (needed as a catch-all, Q8) |

Required photos become: Before ≥ 4, Measurements ≥ 1 (sketch), Plumbing ≥ 1 (under sink), Electrical ≥ 1 (panel).

---

## 2. Batches in build order

| Batch | Items | Why here |
|---|---|---|
| **A** quick fixes | 2, 7, 8, stage bug, 6 | Daily pain, small |
| **B** deal jacket | 1, 3, 4, 5 | One screen; audit triggers feed History |
| **C** estimate | 9, 10 (Skyline import when the file comes) | Daily selling tool |
| **D** photos | 11 + thumbnails | Before workers start uploading |
| **E1** Deals home | 17a (kanban, list, filters) | Uses existing data |
| — | **Hosting to paid plans** | Before any worker or customer logs in (§3) |
| **F1** roles + privacy | 14 (roles), 18 | Security base for everything after |
| **F2** jobs PM | 13, 15 | Needs F1 |
| **F3** daily reports | 14 (report, evening push) | Needs F2 tasks |
| **G** payment links | 16 | Small now that it's manual |
| **E2** Today v2 | 17b | Last: shows data from F and G |

Changes vs your proposal: Today moves to the end (half its new sections need F/G data); F splits in three; G shrinks (no API).

---

## 3. Item 12: storage, limits, cost

**Where files are now**
- One private bucket **`deal-files`** (0004 §8).
- Deal files: `{company_id}/{deal_year}/{deal_number}/{folder}/{uuid}-{name}` (`lib/deals/dealNumber.ts` L73).
- Receipts (legacy Money): `{company_id}/receipts/{year}/…` in the same bucket.
- Supabase project: the one in Vercel's `NEXT_PUBLIC_SUPABASE_URL` (DEPLOY.md: region East US). The repo doesn't record the project ref or plan, and I can't see your dashboard.
- No bucket size limit or MIME list is set.

**How much is used today** (I can't see it; run this in Supabase → SQL editor):
```sql
select count(*) as files,
       round(sum((metadata->>'size')::bigint) / 1024.0 / 1024, 1) as mb,
       round(avg((metadata->>'size')::bigint) / 1024.0, 0) as avg_kb
from storage.objects where bucket_id = 'deal-files';
```

**Plans (official pages, fetched Oct 31, 2026)**

| | Supabase Free | Supabase Pro |
|---|---|---|
| Price | $0 | $25/mo (incl. $10 compute credit) |
| File storage | 1 GB | 100 GB, then $0.0213/GB-mo |
| Egress | 5 GB uncached + 5 GB cached | 250 GB + 250 GB, then $0.09 / $0.03 per GB |
| DB | 500 MB | 8 GB |
| Max upload | 50 MB | configurable |
| Pausing | after 1 week inactive | never |
| Over limit | grace, then fair-use limits | spend cap on by default (blocks, no charge) |

**How many deals fit** (photos are 2560 px JPEG at 0.82 on the phone ≈ 0.6–1.2 MB; I use ~0.8 MB):

| | 50 photos/deal ≈ 40 MB | Free | Pro |
|---|---|---|---|
| Storage | 40 MB/deal | **≈ 25 deals** | ≈ 2,500 deals |
| Egress | ⚠ the Photos grid loads **full-size** images (no thumbnails), so one look at a 50-photo deal ≈ 40 MB | **≈ 125 deal views/month** | ≈ 6,000 views/month |

**The bottleneck is egress, not storage.** Fix in batch D (no dependency): make a 400 px thumbnail on the phone at upload (~30–50 KB), store `thumb_path`, grid uses thumbnails, full size only in the viewer. A 50-photo grid drops from ~40 MB to ~2 MB. Supabase image transformations are Pro-only and $5 per 1,000 after 100 originals, so phone-side thumbnails are cheaper.

**Everything else billable**

| Service | Now | Note | Cost |
|---|---|---|---|
| **Vercel** Hobby | DEPLOY.md uses Hobby | ⚠ **Hobby is for personal, non-commercial use.** RenoDesign is a business. Crons on Hobby run once a day and fire anywhere within the hour (±59 min), so the 3:30 digest can land at 3:59 and an exact evening reminder isn't possible | **Pro $20/mo** (incl. $20 usage credit, 1 TB transfer, per-minute crons) |
| Clerk | Free | 50,000 monthly retained users; roles live in our DB, so no paid add-on | $0 |
| Web push | VAPID | FCM is no-cost; Apple web push needs no developer membership | $0 |
| Address type-ahead | Photon / Geoapify free | Google Places only if you add a billing account | $0 |
| Melio | — | ACH free; card 2.9% with no cap | $0 (+2.9% on cards) |

**Recommended: Vercel Pro + Supabase Pro = $45/month**, before crew and customers log in.

---

## 4. Item 16 research: Melio

| Question | Answer |
|---|---|
| API to create payment request links? | **No.** Melio's only API is a closed-beta **payouts** API; it says it's not for collecting receivables. Receivables via API exist only in sales-led embedded partnerships for software platforms |
| Webhooks for "paid"? | None documented for small-business accounts |
| Zapier? | No Melio app found |
| Fees | Customer pays by **ACH: free**. **Card: 2.9%**, you choose who pays it. No cap: a $30k card payment ≈ $870 |
| Text the link? | Melio gives shareable links (invoice pay link, payment link, payment page); it emails, it doesn't text. You share the link yourself |
| Limits on $10k–$40k? | Not published for receiving. Ask Melio support about limits, deposit timing, and holds on first large payments |

**Plan:** the fallback you described, built as the plan: paste link → Text it (amount, what it's for, link, "bank transfer is free") → Mark paid with Melio ref. No webhook route, no env vars. If you later want automatic "paid", Stripe has payment-link and webhook APIs; that would be a new payments phase with its own approval.

---

## 5. Today v2 (item 17): two layouts

Research summary: Pipedrive and Jobber put a tappable **overdue count first**; Jobber/Housecall Pro lead with **today's timeline by start time** with call/navigate/"on my way" on the card; Asana auto-promotes items into Today by date; Pipedrive colors red = overdue, green = today, yellow = nothing scheduled. Crew users see only their jobs.

**A. Focus stack (recommended)**
```
┌ Today · Sat Oct 31 ────────────────┐
│ [3 overdue] [2 visits] [1 report] [1 unpaid] │  ← tap = jump
├ NOW / NEXT ────────────────────────┤
│ 10:00 Visit · Ruby K. · Fairfax  [Call][Nav][On my way] │
│ On site · #26-1047 Ruby (condo)                       │
│   8 AM–9 PM · no loud work after 6 PM   [Rules]       │
├ NEEDS YOU ─────────────────────────┤
│ ● Reply now (1)                      │
│ ● Follow up (overdue first) (4)      │
│ ● Worker reports: issue "toe kick shortage" │
│ ● Job issues (1) · Job steps due (2) │
│ ● Contract + deposit (1)             │
│ ● Payment links not paid (1)         │
│ ● No touch in 2 days (2)             │
└────────────────────────────────────┘
```
**B. Two tabs: Sales | Jobs**
```
┌ Today ─ [ Sales ] [ Jobs ] ─────────┐
│ Sales: Reply now · Visits today ·    │
│   Follow up · Contract + deposit ·   │
│   No touch in 2 days                 │
│ Jobs: On site today (+ rules) ·      │
│   Reports to review · Issues ·       │
│   Steps due · Unpaid links           │
└────────────────────────────────────┘
```
**Recommendation: A.** One scroll, counts first, and everything with a time is in one timeline. B hides half the day behind a tap, and you work both halves. Crew don't get either: their home is **My work** (jobs today + rules + Report button). Customers land on their job page.

---

## 6. Questions (default in bold; I'll proceed with defaults unless you say otherwise)

| # | Question | Default |
|---|---|---|
| Q1 | Adopt the team model as the spec: rewrite PLAN.md as v3, update CLAUDE.md (roles, rules 3 and 5, "stop and ask") and the project spec | **Yes** |
| Q2 | Read the request's stale references as in §0b (0017+, salesperson filter, "Sold" instead of hand-off) | **Yes** |
| Q3 | Manual checklist tick: who, which gates | **Owner + team can tick; applies to every gate; untick allowed; "checked by hand" badge; all logged** |
| Q4 | Approve these changes to applied tables (all additive, no data loss): `quotes` (+deleted_at, archived_at), `deal_files` (CHECK → trigger, +category, +thumb_path), `audit_log` (+deal_id), `tasks` (+phase, trade, dates, pct, sort), `users` (role adds `customer`, +trade), `payments` (+link fields), bucket MIME list | **Yes, all** |
| Q5 | Removing the takeoff ends auto quantities (crown, toe kick, scribe, pulls) | **Yes; old estimates keep their saved takeoff** |
| Q6 | Cabinet groups by code prefix (W→Wall, B/SB/DB→Base, BC/WC/LS→Corner, U/T/P→Pantry, V→Vanity), editable in Settings | **Yes** |
| Q7 | Skyline file: I need **code, description, unit, price per color group, and the color-group → colors list** (one column per group, like TimberPeak), plus the cost multiplier (TimberPeak = 0.33) | Send as .xlsx or .csv |
| Q8 | Photo categories: add **Other** (catch-all) and **Progress**? | **Add Other; map progress → Completion/After (no Progress category)** |
| Q9 | When does a job start? | **At Mark sold (as now), and Mark sold requires a deposit date** (matches the spec's "first check") |
| Q10 | Phases vs milestones | **Phases = task groups; milestones stay as business checkpoints** |
| Q11 | Worker roles | **One `crew` role + trade tag** (crew RLS already exists) |
| Q12 | Customer access | **Clerk login invited by text/email (as you asked)**. Alternative: a private link like `/q/<token>`, no account. Fewer steps for homeowners |
| Q13 | Which files workers see | **Photos + Design, Permits, Warranty folders. Never estimates, contract, payments, invoices, change orders.** Deal notes hidden (they can hold prices); new "Notes for crew" field instead |
| Q14 | Workspaces and crew | **Crew are company-wide; they see jobs they're assigned to in any workspace** |
| Q15 | Hour warnings need times | **Optional start/end time on tasks; warn on not-allowed days or times** |
| Q16 | Editing a daily report | **Editable until midnight ET; % can go down only with a note** |
| Q17 | Evening reminder | **7:00 PM ET, Mon–Sat** (needs Vercel Pro for on-time crons) |
| Q18 | Hosting | **Move to Vercel Pro + Supabase Pro ($45/mo) before batch F1** |
| Q19 | Card fee | **Text says "bank transfer (free)"; card fee on the customer is off until you check Virginia surcharge rules** |
| Q20 | Home per role | **Owner/team → Deals; crew → My work; customer → their job** |
| Q21 | Today layout | **A (Focus stack)** |

Sources: [Supabase pricing](https://supabase.com/pricing) · [Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress) · [Supabase storage size](https://supabase.com/docs/guides/platform/manage-your-usage/storage-size) · [Supabase image transformations](https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations) · [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control) · [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) · [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing) · [Vercel pricing](https://vercel.com/pricing) · [Clerk pricing](https://clerk.com/pricing) · [Firebase pricing (FCM)](https://firebase.google.com/pricing) · [WebKit: web push on iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) · [Melio API](https://melio.com/api/) · [Melio pricing](https://melio.com/pricing/) · [Melio get paid](https://melio.com/get-paid/) · [Melio partners](https://melio.com/partners/) · [Jobber Home](https://help.getjobber.com/en/articles/home-in-the-jobber-app/) · [Pipedrive Focus](https://support.pipedrive.com/en/article/focus-view-in-the-mobile-app) · [Asana My tasks](https://help.asana.com/s/article/my-tasks) · [Housecall Pro field schedule](https://help.housecallpro.com/en/articles/1029139-viewing-your-schedule-in-the-field) · [JobNimbus mobile](https://support.jobnimbus.com/using-jobnimbuss-mobile-app)
