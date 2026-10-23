# Project Context: Kitchen Remodel Project Planner (Web App)

## 1. What we're building

> **Update (Oct 23, 2026): sales-rep mode.** The app is Tugu's own sales tool. He prepares deals and hands them to a licensed contractor partner (RenoDesign Inc., Crystal's company), who signs, builds and collects; Tugu earns a commission. `docs/SALES-REP-MODE.md` overrides this file where they conflict. The team/admin/crew material below describes the optional contractor module. Start from `docs/PROMPT-v2-master.md`.

An easy, phone-first, Asana-style web app for **RenoDesign Inc.** (Chantilly, VA; renodesigninc.com), a small remodeling company: kitchens first, also baths, basements and whole-home projects (more templates later). Company profile and client-facing stages: `docs/QUICK-ESTIMATE.md` §5. It tracks every job from the first phone call to the final payment, then shows margin and profit per job and per month.

The company runs **4–5 active projects every 1–2 months**, gets **many calls and messages**, and loses money when leads go cold or payments get missed. The team is **three people who rarely meet**, so the app *is* the meeting: everyone sees the same leads, jobs, money and changes from their phone, and nothing falls through the cracks.

**Everything is a deal.** A deal is opened at first contact and is the one record for that customer job until the final payment, like a car deal jacket. It gets a permanent **deal number** (`YY-NNNN`, e.g. `26-1047`: year + that year's count from 1001; documents inside it extend it, e.g. change order `26-1047-CO1`). Sales stages and job milestones are stages of the same deal; the UI never shows separate "lead" or "project" objects. Details: `docs/DEALS.md`.

**Who uses it**
| Role | Who | Sees | Main needs |
|---|---|---|---|
| `owner` | Tugu: sales | Everything | Lead follow-ups, quotes, closing, money |
| `owner` | Crystal: project manager + design | Everything | Measurements, designs, cabinet lists, orders, schedule, crew, punch list |
| `team` | Office admin (remote) | Everything; can't change company settings or users | Answering leads, logging calls, follow-up queue, payments, ordering, paperwork |
| `crew` (optional login) | Installers, plumber, electrician | Only jobs they're assigned to; **no money** | Address, schedule, tasks, pick list, photos, report an issue |

Owners and team have the same view of the business. The only differences are who can change settings and users. Crew access is optional: subs can be added later, or just get texted.

**How the work actually flows** (details in `docs/FIELD-AND-OFFICE.md`):
- **Tugu works from his phone only** (day job weekdays 7:00 AM–3:30 PM ET). With Crystal he visits homes on weekday evenings and weekends, measures, negotiates, and gives a **phone ballpark**. He submits a **Site Visit** (photos, sketch, measurements) instead of texting them.
- **Crystal** turns each site visit into a design + quote on her laptop from her **design queue**, then Tugu presents it from his phone.
- **The office admin** runs the app on a **split shift**: live 11:00 AM–3:00 PM ET (answers leads while Tugu is at work), back office 11:00 PM–3:00 AM ET (cleans up, reviews visits, queues messages, writes the morning brief). Her **command center** is the app's control room.

**Non-goals for v1:** full accounting (QuickBooks), payroll, online card payments, complex permissions, a native app (the web app installs on the home screen instead).

---

## 2. Tech stack (default — keep consistent)
- **Next.js (App Router)** + TypeScript, server actions where practical
- **Supabase** (Postgres, Storage for photos/docs, Row Level Security)
- **Clerk** for auth (org = the company; roles: `owner`, `team`, `crew`)
- **Tailwind + shadcn/ui** for UI; **dnd-kit** for boards (with tap-to-move on phones)
- **Recharts** for analytics
- **Installable PWA**: `app/manifest.ts`, icons, standalone display, so it opens like an app from the home screen
- **Web Push** (VAPID, `web-push`) for notifications; on iPhone this needs iOS 16.4+ and the app added to the Home Screen. **Resend** email as fallback.
- **Twilio** SMS: optional, Phase 3
- Deploy on **Vercel** (Framework Preset: Next.js)
- Times displayed in **US Eastern Time**; store all timestamps in UTC

---

## 3. The full lifecycle (single source of truth)
Every record moves through two linked pipelines: **Lead → Deal** (sales) and **Project** (delivery). A lead converts into a project once the deposit arrives. Every lead, project and task always shows **who's on it**.

### A. Sales pipeline (Lead / Deal)
| # | Stage | Enters when | Exit criteria | Default follow-up rule |
|---|---|---|---|---|
| 1 | **New Lead** | Call, text, FB/Marketplace message, web form, referral | Contact info + source logged | Respond within **1 hour** |
| 2 | **Contacted / Qualifying** | First reply sent | Budget range, timeline, scope, address captured | Follow up at **+1, +3, +7 days** if no reply |
| 3 | **Meeting Booked** | In-home measurement scheduled | Meeting date set | Reminder to client **24h before** |
| 4 | **Initial Meeting Done** | Measurement completed | Measurements + photos uploaded | Design due within **5 days** |
| 5 | **Design / Quote Sent** | 3D design + quote sent | Client responds | Follow up at **+2, +5, +10 days** |
| 6 | **Design Approved** | Client approves design + quote | Signed approval / contract | Request deposit same day |
| 7 | **Won — Deposit Received** | **First check received** | Deposit amount + date logged | Auto-create Project |
| — | **Lost** | Any stage | Lost reason required | Optional re-engage in 60 days |

**Lost reasons (pick list):** price, went with competitor, timing/postponed, no response, out of service area, scope too small, other.

### B. Delivery pipeline (Project)
| # | Milestone | Key date field | What happens | Payment trigger |
|---|---|---|---|---|
| 1 | **Deposit Received** | `deposit_received_at` | First check in | ✅ Payment 1 |
| 2 | **Materials Ordered** | `order_date` | Cabinets/counters ordered from supplier | — |
| 3 | **Materials Expected / Delivered** | `expected_delivery_date`, `delivered_at` | Track supplier ETA, inspect for damage | (optional progress payment) |
| 4 | **Project Start** | `start_date` | Demo / install begins | — |
| 5 | **Mid-Project Check** | `mid_check_date` | Walkthrough with client, change orders captured | (optional progress payment) |
| 6 | **Tasks & Issues** | ongoing | Task board + issue log (damaged parts, delays, change orders) | — |
| 7 | **Install Complete** | `install_complete_date` | All work done, punch list started | — |
| 8 | **Final Inspection** | `final_inspection_date` | Client walkthrough + punch list closed (+ permit inspection if any) | — |
| 9 | **Final Payment** | `final_payment_received_at` | **Last check** received | ✅ Final payment |
| 10 | **Project Closed** | `closed_at` | All costs entered, margin locked | — |

**Rule:** a project cannot be marked **Closed** until (a) balance due = $0, (b) punch list = 0 open items, (c) actual costs entered.

### C. Payment schedule
Configurable per project. Default templates:
| Template | Schedule |
|---|---|
| Cabinets only | 70% deposit at order → 30% on delivery (cabinets sold **without** install = a materials sale: Virginia sales tax is collected and shown; see COMPLIANCE-AND-OPS §2) |
| Full remodel | 30% at signing → 30% cabinets delivered → 30% countertops installed → 10% final (editable; see COMPLIANCE-AND-OPS §3 on deposit guidance) |
| Custom | Any number of installments, by % or fixed $ |

Each installment has: amount, due trigger (milestone or date), method (check, Zelle, card, cash), check #, received date, status (due / received / overdue).

---

## 4. Staying on the same page (core, not an add-on)
| Feature | How it works |
|---|---|
| **Activity feed** | Every meaningful change writes an `events` row ("Office admin logged a call with Smith", "Crystal moved Lee to Design Sent", "$12,061 deposit received"). Team sees all; crew sees only its jobs, with money hidden. |
| **Comments + @mentions** | Every lead, project and task has a comment thread with photos. `@Crystal` notifies her. Replaces scattered texts about jobs. |
| **"Who's on it"** | `deals.owner_id`, `projects.project_manager_id`, `tasks.assignee_id` always visible as an avatar chip; reassign in one tap. |
| **My day vs Team** | Today screen has two tabs: *Mine* (my follow-ups, meetings, tasks) and *Team* (everything due today across all three). |
| **Unread dots** | Each user has a `last_seen_at` per record; anything changed since shows a dot, so you can see what's new in 10 seconds. |
| **Notifications** | Push to phone per the matrix below; each user can mute types. |
| **Daily digest** | 7:00 AM ET push/email: your day + anything overdue on the team. |

**Notification matrix (defaults, editable in Settings)**
| Event | Notify |
|---|---|
| New lead (any channel) | Lead owner + office admin |
| Follow-up overdue | Lead owner |
| @mention or reply in a thread you're in | That person |
| Measurement booked or moved | Crystal |
| Quote approved, deposit received, payment received | All three |
| Delivery overdue, material damaged/backordered | Crystal + office admin |
| Payment overdue | Tugu + office admin |
| Crew reports an issue or uploads photos | Crystal |
| Site visit submitted | Crystal + admin |
| Info requested on a site visit | Tugu |
| Design ready | Tugu |

---

## 5. Data model (Supabase / Postgres)
```
companies          id, name, settings_json, timezone
users              id, clerk_id, company_id, name, role (owner|team|crew), phone, avatar_url,
                   notify_prefs jsonb
contacts           id, company_id, name, phone, email, address, city, zip, notes
deals              id, company_id, contact_id, source, stage, owner_id,
                   deal_year, deal_seq, deal_number, opened_on (assigned by trigger; see DEALS.md),
                   permit_required, deleted_at (soft delete; numbers are never reused),
                   budget_min, budget_max, scope (cabinets|counters|full|other),
                   desired_timeline, next_follow_up_at, lost_reason, created_at
activities         id, company_id, deal_id|project_id, type (call|text|email|fb_msg|meeting|note),
                   direction (in|out), summary, created_by, occurred_at
meetings           id, company_id, deal_id, type (initial|design_review|mid_check|final), scheduled_at,
                   assignee_id, status
quotes             see docs/ESTIMATING.md (versions, status, rates, takeoff, approved snapshots)
projects           id, company_id, deal_id (unique: the delivery half of a deal), contact_id, name, status, project_manager_id,
                   contract_value, deposit_received_at, order_date, expected_delivery_date,
                   delivered_at, start_date, mid_check_date, install_complete_date,
                   final_inspection_date, final_payment_received_at, closed_at
project_members    project_id, user_id                -- crew assigned to a job
milestones         id, project_id, name, planned_date, actual_date, status, sort_order
tasks              id, project_id, milestone_id, title, description, assignee_id,
                   due_date, priority, status (todo|doing|blocked|done), sort_order
issues             id, project_id, type (damage|delay|change_order|client|other),
                   description, cost_impact, schedule_impact_days, status, photo_urls, reported_by
change_orders      id, project_id, description, price_change, cost_change, approved_at
payments           id, project_id, label, amount, due_trigger, due_date, received_at,
                   method, check_number, status
costs              id, project_id, category (materials|labor|subcontractor|permit|
                   delivery|disposal|other), vendor, estimated_amount, actual_amount,
                   paid_at, receipt_url
deal_files         see DEALS.md (photos + documents in folders, private storage, jacket checklist)
events             id, company_id, actor_id, entity_type, entity_id, project_id, verb, summary,
                   has_money boolean, created_at           -- activity feed
comments           id, company_id, entity_type, entity_id, author_id, body, mentions uuid[],
                   photo_urls, created_at
notifications      id, company_id, user_id, event_id|comment_id, kind, read_at, pushed_at
push_subscriptions id, user_id, endpoint, keys jsonb, user_agent, created_at
record_views       user_id, entity_type, entity_id, last_seen_at  -- unread dots
estimating tables  see docs/ESTIMATING.md + docs/QUICK-ESTIMATE.md §7 (price book, price lists,
                   color groups, quote line items, comparison prices, project_materials)
field + office     see docs/FIELD-AND-OFFICE.md §9 (work_windows, site_visits, design_requests,
                   info_requests, shift_handoffs, scheduled_messages)
```
RLS by `company_id`. `owner` + `team` read everything. `crew` reads only projects in `project_members` (or where they have a task), never money columns: use crew-safe views without amounts. `events.has_money` rows are hidden from crew.

---

## 6. Screens (phone first, for everyone)
**Bottom tab bar:** Today · Deals · Money · More (Activity, Calendar, Analytics, Settings). Deals has three segments: **In sales** (stages 1–7), **In progress** (deposit received → final payment), **Closed / Lost**. The crew sees only Today · their assigned deals. A floating **+** button on every screen: New deal · Quick estimate · Take photos · Log call · Record payment.

| Screen | Purpose |
|---|---|
| **Today** | *Mine / Team* tabs: follow-ups due, meetings, tasks, overdue payments, deliveries, jobs starting this week. Tugu's also shows visits tonight (with map), designs ready to present, open info requests |
| **Command center** (team, owners) | Admin's prioritized queue + shift checklist + handoff (FIELD-AND-OFFICE §7) |
| **Site visit** | Phone form with required-photo checklist, sketch photo, walls, appliances, ballpark (FIELD-AND-OFFICE §4) |
| **Ballpark** | Template + rough size → price range from the live price book (FIELD-AND-OFFICE §5) |
| **Design queue** | Crystal's list of site visits by due date and status (FIELD-AND-OFFICE §6) |
| **Deals** | List by segment and stage (board on tablet/desktop); search by deal number, name, phone, address; card = **#26-1047**, name, scope, value, owner avatar, next date, unread dot |
| **Deal jacket** | One screen per deal (DEALS.md §3): header with #number and big Call · Text · Navigate · Log buttons; tabs **Overview · Estimates · Photos · Files · Money · Tasks · Activity**; jacket checklist |
| **Jobs** | Active projects by milestone; card = client, PM, next date, balance due, open issues |
| **Job detail** | Key dates header; tabs: Tasks, Materials, Issues, Payments, Costs, Files, Comments |
| **Money** | Payments due / received / overdue; record a check in 3 taps (amount, method, photo of the check) |
| **Activity** | Team feed with filters (person, job, money); unread first |
| **Calendar** | Week view of meetings, installs, deliveries per person |
| **Analytics** | See section 8 |
| **Settings** | Users and roles, pipeline stages, follow-up rules, payment templates, notification defaults, estimating (owners only) |

**Phone UX rules**
- Everything works at **375 px**, one-handed; tap targets ≥ 44 px; primary action in a sticky bottom bar.
- Tap-to-call, tap-to-text (`sms:`), tap-to-navigate (Maps) on every contact and job address.
- Photo first: camera upload from any job, issue, payment or comment; compress on device.
- Log a call in ≤ 3 taps; every lead must always show `next_follow_up_at` (app nags if empty).
- Optimistic updates with a retry queue so spotty signal at a job site doesn't lose work.
- Red badges for anything overdue; unread dots for anything changed since you last looked.
- Heavy editing (quote builder, price book) also works on phone but is designed for tablet/laptop; on the phone you can view, change a qty and approve.

---

## 7. Automations
| Trigger | Action |
|---|---|
| New lead created | Set follow-up = now + 1h; assign default owner; notify per matrix |
| No activity on lead for N days (per stage) | Add to Today follow-up queue; push to lead owner |
| Meeting in 24h | Reminder to client + assignee |
| Design approved | Create deposit payment as "due" |
| Deposit received | Convert lead → project, generate milestones + task template + payment schedule, materials + estimated costs from the approved quote; notify all three |
| Expected delivery passes without `delivered_at` | Flag "Delivery overdue"; notify per matrix |
| Milestone with payment trigger completed | Mark that installment "due" |
| Payment due > 3 days | Mark overdue, show on Today, notify per matrix |
| Final payment received + punch list clear | Prompt to close project and lock margin |
| Any create/update listed in §4 | Write an `events` row; fan out `notifications` per matrix + mentions |
| New lead outside anyone's live window | Push to lead owner; mark "waiting for live shift" (FIELD-AND-OFFICE §3) |
| Site visit submitted | Create design request due in `design_due_days`; push Crystal + admin |
| Design marked ready | Push Tugu with the client link |
| Client message written in quiet hours | Save as scheduled for 8:00 AM ET |
| 7:00 AM ET | Publish the admin's morning brief + each person's digest |

**Default project task template (editable in Settings):** confirm measurements → order cabinets → order countertops → schedule delivery → demo → plumbing/electrical rough-in → cabinet install → countertop template → countertop install → backsplash → fixtures/appliances → punch list → final clean.

---

## 8. Margin & profit analytics
**Per project**
- **Revenue** = contract_value + Σ approved change_orders.price_change
- **Estimated cost** = Σ costs.estimated_amount
- **Actual cost** = Σ costs.actual_amount
- **Gross profit** = Revenue − Actual cost
- **Gross margin %** = Gross profit ÷ Revenue
- **Cost variance** = Actual − Estimated (by category)
- **Collected** = Σ payments.received; **Balance due** = Revenue − Collected
- **Duration** = closed_at − start_date (days); **Schedule slip** = actual vs planned per milestone

**Company dashboard (filter by month / quarter / date range)**
| Metric | Definition |
|---|---|
| Leads by source | Count + conversion rate per source (FB, referral, calls, web) |
| Funnel | Count and % moving between each sales stage |
| Lead → Won rate | Won ÷ (Won + Lost) |
| Avg response time | First outbound activity − lead created_at |
| Avg days to close | deposit_received_at − lead created_at |
| Pipeline value | Σ quote totals in stages 5–6 (weighted optional) |
| Revenue booked vs collected | By month |
| Gross profit & margin % | By month and per project; target line (e.g., 35%) |
| Cost breakdown | Materials / labor / subs / other, % of revenue |
| Over-budget projects | Actual cost > estimate by > 10% |
| Lost reasons | Pareto chart |
| Capacity | Active projects vs target (4–5); upcoming start dates |

Margin is **locked** at project close; edits after close require an owner and are logged.

---

## 9. Build phases (ordered by where the business leaks money)
| Phase | Scope | Why first |
|---|---|---|
| **1 — Team engine** | Auth + roles, PWA shell, contacts, **lead inbox + follow-up queue + routing by work windows + quiet hours**, **admin command center + shift checklists + handoff/morning brief**, activity feed, comments + @mentions, unread dots, **web push** (new lead, mention, info request, design ready) | Lead response is where past attempts lost every deal |
| **2 — Field to design** | **Site Visit form** (photos, sketch, checklist), **design queue**, info requests, visit booking from shared field windows | Removes the photo-and-text handoff and second trips |
| **3 — Estimating + quick estimate** | Price book, **vendor price list import** (TimberPeak), color groups, quartz levels, templates, quote builder + takeoff, **phone quick estimate + ballpark**, **Home Depot comparison card**, approval, client quote link (docs/ESTIMATING.md, docs/QUICK-ESTIMATE.md) | Real prices in two minutes; Tugu negotiates with real numbers and an honest HD comparison |
| **4 — Jobs + money** | Convert to project, milestones, tasks, materials/pick list, payments, costs, margin + close rule | Needed when the first deposit arrives |
| **5 — Polish** | Calendar/timeline, issues + change orders, crew logins + crew job view, analytics dashboard, 7 AM digest email | — |
| **6 — Integrations** | Twilio SMS with scheduled send, client status page, QuickBooks/CSV export, web lead form, Facebook lead intake | — |

Ship each phase to the team before starting the next; use it for a week; adjust.

## 10. Working rules for Claude in this project
- Ask before adding new dependencies or changing the data model; keep migrations in `/supabase/migrations`.
- Prefer simple, admin-editable configuration (stages, templates, rules stored in DB) over hard-coded logic — the owners must be able to change things without a developer.
- Money stored as integer cents; dates as `date`, events as `timestamptz`.
- Every list view needs empty, loading, and overdue states, and must work at 375 px.
- Every mutation that matters to the team writes an `events` row in the same transaction.
- Show me tables/diagrams when explaining structure; be direct about trade-offs and flag scope creep.
- When giving deployment steps, include the Vercel Framework Preset (Next.js), env var setup for Clerk + Supabase + VAPID keys, and Stripe webhook steps only if/when online payments are added.
