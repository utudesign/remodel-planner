# PLAN: Tugu's kitchen sales tool (master prompt v2, Step 0)

Status: **approved Oct 23, 2026 (defaults taken for Q1–Q12). Steps 1–5 built**; Step 6 (lead-source report, review/referral text, deal ZIP export) is next. Decisions per step: `docs/DECISIONS.md`.
Inputs read: `kitchen-sales-tool-handoff.zip` (SALES-REP-MODE, DEALS, QUICK-ESTIMATE, ESTIMATING, COMPLIANCE-AND-OPS §0, CONTEXT, research, migrations 0002–0006, `test/`, `lib/*`), plus everything already in this repo (last commit `b03802a`, WIP).

Baseline check done on Postgres 16 here: the handoff's own run order (`test/run_all.sh`: stub → 0002 → 0003 → 0004 → tests → 0005 → tests → 0006 → tests) passes with **41 OK, 0 errors**.

---

## 1. Where the repo stands vs. the new direction

| Area | Built so far (company / team app) | Sales-tool decision |
|---|---|---|
| Migrations | `20261023000001_core` … `0005_deal_jacket` (my v1 + team engine + my adaptation of the old jacket, MMDD numbers) | **Replace** with a new `0001_core.sql` + handoff `0002`–`0006` verbatim. Never applied to a real Supabase project, so rewriting is safe |
| Deal numbers | MMDD + daily seq (`03141`) | **`26-1047`** from handoff 0004 + new `lib/deals/dealNumber.ts` |
| `lib/estimating/*`, `dealNumber.ts` | Older handoff copies | Replace with the new handoff files, unchanged. Add `lib/commission/` |
| Team engine (work windows, lead routing, admin shift hand-offs, command center, design/info requests, issues, crew lockdown) | Built (SQL + screens) | **Remove** (stays in git history). CONTEXT's team/admin/crew is an optional contractor module: no screens now |
| Projects board, milestones, payments schedule, costs, close/margin lock | Built | **Remove screens.** Tables stay only as far as 0002/0004/0005 need them (contractor module) |
| Auth (Clerk v7), Supabase clients, `requireRole`, money/dates libs, web push + service worker, cron, storage helper, deals list, deal jacket page, new-deal form, activity log | Built | **Keep and adapt** |

## 2. The new `0001_core.sql` (so 0002–0006 apply cleanly)

### 2a. What I tested
Applying the handoff migrations on top of my current 0001–0003 fails in three places:

| Error | Cause | Fix in 0001 |
|---|---|---|
| `relation public.site_visits does not exist` (0004) | `site_visits` lives in my team-engine 0004 | Move `site_visits` into 0001 (the rep fills it at the visit) |
| `column "price_change" does not exist` (0004 `deal_recap`) | I used `*_cents` names; handoff uses CONTEXT §5 names | Use the CONTEXT/stub names on the contractor tables (below) |
| `column p.contract_value does not exist` (0005/0006 `lead_source_stats`) | Same | Same |

Two silent problems the errors don't show:
- **Policies are OR'ed.** My 0001 RLS lets any company member read all deals. Crystal is a member of my company with role `partner`, so she'd see every deal. 0001 policies must use `is_team()` (owner + team only); the partner's narrow view comes from 0006.
- **Helpers live in `private.*`** in my build; 0002–0006 use `public.current_user_id/current_company_id/current_app_role/is_owner/is_team/set_updated_at`. 0001 defines those exact functions (0002's `create or replace` then changes nothing).

### 2b. Contents (superset of `test/0000_supabase_stub.sql`, same names and types)

| Table | Columns (stub names kept exactly) | Added for the sales tool |
|---|---|---|
| `companies` | id, name, settings_json, timezone | clerk_org_id, created_at. Settings in `settings_json`: tax set-aside %, mileage rate, booking hours, auto-reply template, quiet hours |
| `users` | id, clerk_id, company_id, name, role, phone | email, active. `role in ('owner','partner','team','crew')` (0006 adds `partner_id`) |
| `contacts` | id, company_id, name | phone, email, address, city, zip, notes |
| `deals` | id, company_id, contact_id, source, **stage text**, owner_id, created_at | scope (`kitchen`/`cabinets_only`/`countertops`/`bath`), budget_min/max_cents, timeline, decision_maker, owns_home, knowledge_level, notes, next_follow_up_at, stage_entered_at, updated_at. **Not** added here: deal_number/year, deleted_at (0004), year_built, first_response_at, cancelled_at, lost_reason (0005), partner/job fields (0006) |
| `quotes` | id, deal_id, version, line_items_json, subtotal, tax, total, sent_at, approved_at, file_url | company_id (0002 extends the rest) |
| `projects`, `tasks`, `costs`, `payments`, `change_orders` | exactly the stub columns (`contract_value`, `amount`, `received_at`, `price_change`, `cost_change`, `actual_amount`, `category text`, `order_date`, `closed_at`) | company_id. **Contractor module only: no screens.** Exception to the `*_cents` naming rule, logged in DECISIONS |
| `site_visits` | id, company_id, deal_id | visited_at, status, client/scope/walls/appliances/checklist jsonb, ballpark low/high cents, submitted_at |
| `pipeline_stages` | — | company_id, key, label, sort_order, kind (`open`/`handed_off`/`lost`), active. Editable in Settings |
| `lost_reasons`, `follow_up_rules` | — | as built, keyed by `stage` key |
| `activities` | — | deal_id, kind (call/text/note/visit/stage/file), body, at, by. Speed-to-lead source |
| `meetings` | — | deal_id, starts_at, ends_at, kind (visit), status, booked_via (`link`/`manual`) |
| `events`, `notifications`, `push_subscriptions` | — | kept from my build, trimmed to the owner + partner |
| `audit_log` | — | kept |

**Stage rule:** `deals.stage` stays text (the tests insert `'new'`). It holds the stage **key**. A trigger checks it against that company's `pipeline_stages`. A `companies` insert trigger seeds the defaults, so tests and new accounts both work.

Default stages (SALES-REP-MODE §2): `new` Lead · `qualified` · `visit_booked` · `visit_done` · `estimate` · `ready` · `handed_off` · `lost`. After hand-off, progress comes from 0006's `job_status` and `deal_commissions`, not from more stages. "Closed" = commission fully paid.

**Onboarding** (`bootstrap_membership` → `seed_company_defaults`):
- stages, lost reasons, follow-up rules;
- `seed_default_estimating`, `seed_default_deal_jacket`, `seed_default_handoff`;
- partner **RenoDesign Inc.** with the 2 placeholder plans ("Kitchens 5% (50% at deposit)", "Cabinets only 8% (all at deposit, $250 floor)");
- the TimberPeak list via `supabase/seed/timberpeak_msrp_2026.sql`.

### 2c. File layout + proof
```
supabase/migrations/0001_core.sql          new (replaces my 5 files)
supabase/migrations/0002–0006_*.sql        handoff, byte-for-byte
supabase/migrations/0007_*.sql …           anything new (see §4 Q5)
supabase/seed/                             handoff TimberPeak files
supabase/seed.sql                          demo: my company + RenoDesign + 6 deals at different stages
test/                                      handoff tests + stub (kept for reference)
supabase/tests/rules_test.sql              rewritten: 0001 rules + owner/partner access
```
**Acceptance:** the handoff's own 4 SQL test files pass against **real `0001_core.sql`** instead of the stub: 41 OK, 0 errors. My `rules_test.sql` must also pass. Both run in `scripts/test-db.sh` (local Postgres 16 or `supabase db reset`).

## 3. Screens, step by step (iPhone, 375 px, 44 px targets)

Navigation: tabs **Today · Deals · Money · More** + floating **+** (New deal · Quick estimate · Take photos · Log call · Add expense · Log trip). Partner login gets its own small shell (§ Step 4).

### Step 1: foundation + deals
| Route | What |
|---|---|
| `/sign-in` | Clerk. I'm the only required user; first sign-in creates my company and seeds it |
| `/deals` | Segments **Selling · With partner · Closed/Lost**. Selling is grouped by my stages. Search: `parseDealNumber()` (26-1047, #26-1047, 261047, 1047, 26-1047-E2) or name / phone / address. Card: `#26-1047`, name, scope badge, value, next step, commission when known |
| `/deals/new` | Name, phone, address, source, scope. Number assigned by the DB |
| `/deals/26-1047` | Jacket shell. Sticky header: number, name, address, stage chip, **Call · Text · Navigate · Log**, checklist badge. Tabs: **Overview · Estimate · Photos · Files · Partner · Activity** (Estimate/Partner are placeholders until Steps 3/4) |
| `/more` → Settings | Stages, lost reasons, follow-up rules, company profile |

Old routes (`/leads`, `/projects`, `/deal/[id]`, `/job/[id]`, `/command`, `/payments`, `/analytics`) are removed. Redirects stay for the 2 old URL shapes.

### Step 2: leads without an admin
| Piece | How |
|---|---|
| Paste a message | Textarea → parser in `lib/leads/parse-message.ts` (phone, name, "cabinets/whole kitchen/countertops", town) → prefilled new-deal form. Regex rules, no AI service |
| Missed call | "Missed call" in + menu: paste/enter number → deal with source `call`. (No web app can read the iPhone call log; see Q3) |
| Share link | Public `/l/<slug>` short form (name, phone, town, what they want, photo optional). Honeypot + per-IP rate limit in the DB. Creates a deal with source `share_link` |
| Auto-reply | Template with my qualifying questions + booking link. On a new deal: **Copy reply** / **Text it** (opens Messages with the text). Tapping either stamps `first_response_at`. The app can't post into Facebook Messenger itself |
| Booking | Public `/book/<deal token>`: slots from settings (default weekdays 5:30–8:00 PM, Saturday 9 AM–5 PM, 90 min) → `meetings` row → stage `visit_booked` → push to me |
| Qualify form | Scope, timeline, budget range, decision maker, owns/rents, year built, knowledge level → a lead score shown on the card |
| Today | Leads with no touch in 2 days · visits today · ready to hand off · handed off with no update in 7 days ("ask Crystal") · commission earned and unpaid (Step 5) |
| Pushes | 3:30 PM weekday digest (Vercel cron 19:30 + 20:30 UTC, the handler runs only when it's 3:30 PM ET, DST-safe). During 7:00–3:30 weekdays: only new leads (see Q2) |

### Step 3: visit, photos, quick estimate
| Piece | How |
|---|---|
| Site visit form | Walls/measurements, sketch photo, appliance list (model or "reuse"), year built, required-photo checklist that ticks itself from tags, ballpark (`lib/estimating/ballpark.ts`) |
| Photos | Multi-shot camera input, tag chips, grid by tag/date, full-screen viewer. In the browser: EXIF time, GPS stripped, 2560 px JPEG + 400 px thumbnail. Signed upload URL → `dealStoragePath()` → `deal_files` row |
| Offline queue | IndexedDB queue (hand-written, no library) with progress + retry. A photo leaves the queue only after its `deal_files` row exists |
| Quick estimate | PROMPT-estimating Steps 1–4 incl. 3b/3c, phone-first: template → TimberPeak color group → quartz level → HD items → total, margin, and **"this pays you $X"** (`previewCommission()` with the deal's plan, or the partner's default plan before one is picked). Home Depot comparison card |
| Client view | `/q/<token>`: section totals only, "Estimate. Final price and contract from RenoDesign Inc." + license number, number `26-1047-E1`. No sales-tax line. Share link or PDF (Q4) |

### Step 4: hand-off
| Piece | How |
|---|---|
| Hand off | Pick partner + plan → checklist from `deal_jacket_checklist` (gate `before_handoff`) with **Add** buttons → set `handed_off_at`. If the DB refuses, its message becomes the same checklist, never a raw error |
| Packet | PDF summary (customer, address, scope, budget, notes, measurements, estimate) + photo ZIP → iOS share sheet (text/email) |
| Partner tab | Job status timeline, sold price, change orders total, deposit / paid-in-full / completion dates, note. I can type them from Crystal's text |
| Partners | More → Partners: partner details (license number + class), invite Crystal (Clerk invitation → user with role `partner` + `partner_id`) |
| Partner login | `/p` deals list (only hers) + `/p/26-1047` with only those fields + hand-off files. Enforced by 0006 RLS/triggers; tested with her role |

### Step 5: my money
| Screen | From |
|---|---|
| Money → Commissions | `deal_commissions`: owed now, pipeline, paid this year; per deal expected/earned/paid/owed + status. Record payment (check photo or Zelle ref) → `commission_payments`. Earned > 14 days unpaid → Today + digest |
| Money → Expenses | Receipt photo → amount, category, optional deal → `business_expenses` |
| Money → Mileage | From a deal (address prefilled; miles entered) or Start/Stop trip with odometer readings → `mileage_trips` |
| Money → Year | `rep_year_summary()` + tax set-aside % → "set aside $X"; CSV export |
| More → Partners → Plans | Commission plan editor |

### Step 6: polish
Lead source report (`lead_source_stats`), review/referral text after "paid in full" (partner's review link on the partner record), export deal ZIP.

Every list: empty, loading, error and overdue (red badge) states. After every step: lint, typecheck, Vitest, build, SQL tests; one commit; phone test steps.

## 4. Questions (my default in bold; I'll proceed with the defaults unless you say otherwise)

| # | Question | Why it matters | Default |
|---|---|---|---|
| Q1 | OK to **throw away my v1 migrations and the team-app screens** (kept in git history)? | Biggest change; nothing is in a real database yet | **Yes** |
| Q2 | "Silent badge" for new leads during the day job isn't possible on iPhone: a web push must show a notification, or iOS cancels the subscription. | Your quiet hours | **Normal push for new leads only (no sound control from the web); add the app to an iOS Work Focus if you want it silent.** Alternative: no push at all during work, badge on next open |
| Q3 | Missed calls: a web app can't see the call log. Automatic capture needs a business number with a webhook (OpenPhone, Twilio, Google Voice: **paid**) | Step 2 | **Manual "Missed call" entry now**; revisit when you have a business number |
| Q4 | PDFs (client estimate, hand-off packet) and ZIPs need libraries | "Ask before a heavy library" | **`@react-pdf/renderer`** for PDFs (server route, medium size) and **`fflate`** for ZIPs (tiny). Alternative for PDF: a print-ready page + iOS "Save as PDF" (no library, but not one tap) |
| Q5 | `rep_year_summary(p_mileage_rate_cents int)` can't take the **2026 IRS rate, 72.5¢** | Year net would be off | **New `0007` adds an overload with a numeric rate; 0006 untouched.** Setting default 72.5¢ |
| Q6 | Booking slots | Step 2 | **Weekdays 5:30–8:00 PM, Saturday 9 AM–5 PM, 90 min visits, editable** |
| Q7 | Pasted-message parsing | An AI service would parse better but is a paid service | **Regex parser, no AI** |
| Q8 | Mileage distance | Auto distance needs a maps API (Google: paid past a free tier) | **Miles typed in or odometer start/stop** |
| Q9 | Share-link spam protection | Cloudflare Turnstile is free but is another service | **Honeypot + rate limit only** |
| Q10 | Commission before a plan is picked | The "pays you $X" line needs a plan | **Use the partner's first active plan matching the scope (Cabinets only → 8% plan, else 5%)** |
| Q11 | PROMPT-v2 says estimating "Steps 1–5b"; PROMPT-estimating has 1, 2, 3, 3b, 3c, 4, 5 | Scope | **1–4 incl. 3b/3c. Step 5 (convert to project + materials) is contractor module: skip** |
| Q12 | Repo name/location | README suggests `~/Projects/kitchen-sales` | **Keep `utudesign/remodel-planner`** at `~/Claude/remodel-planner` |

Not blocking, from the handoff README (your to-dos, not code): written commission agreement with RenoDesign, ask Fairfax DCCS about a solicitor license, RenoDesign's contract package + license number for the client view, Maryland license only if you sell there.

Sources: [IRS: 2026 business standard mileage rate 72.5¢](https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents).
