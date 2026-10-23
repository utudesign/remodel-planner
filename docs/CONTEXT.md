# Project Context: Kitchen Remodel Project Planner (Web App)

> Copy of the project spec (`kitchen-remodel-planner-context.md` in the claude.ai project).
> Approved deviations are logged in `docs/DECISIONS.md`; the playbook mapping is in `docs/PLAYBOOK-MAPPING.md`.

## 1. What we're building

An easy-to-administer, Asana-style web app for a **small kitchen remodel company**. It tracks every job from the first phone call to the final payment, then shows margin and profit per job and per month.

The company runs **4–5 active projects every 1–2 months**, gets **many calls and messages**, and loses money when leads go cold or payments get missed. The app's job is to make sure **nothing falls through the cracks**: every lead has a next step, every project has dates, every check is tracked.

**Primary users**

| Role                    | Who                                                  | Main needs                                                                            |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Owner / Admin           | Runs the business                                    | Pipeline view, follow-up queue, payments, margin analytics, user and settings control |
| Designer / Estimator    | Does measurements, 3D designs, cabinet lists, quotes | Meeting schedule, design approval status, cost inputs                                 |
| Field Lead / Installer  | Runs install on site                                 | Today's tasks, punch list, photos, issues                                             |
| (Optional later) Client | Homeowner                                            | Read-only status page, approve design, see payment schedule                           |

**Non-goals for v1:** full accounting (QuickBooks replaces this), payroll, online payment processing, complex permissions.

---

## 2. Tech stack (default — keep consistent)

- **Next.js (App Router)** + TypeScript, server actions where practical
- **Supabase** (Postgres, Storage for photos/docs, Row Level Security)
- **Clerk** for auth and roles (org = the company; roles: admin, designer, field)
- **Tailwind + shadcn/ui** for UI; **dnd-kit** for drag-and-drop boards
- **Recharts** for analytics
- **Resend** (email) and **Twilio** (SMS) for reminders — optional phase 2
- Deploy on **Vercel** (Framework Preset: Next.js)
- Times displayed in **US Eastern Time**; store all timestamps in UTC

---

## 3. The full lifecycle (single source of truth)

Every record moves through two linked pipelines: **Lead → Deal** (sales) and **Project** (delivery). A lead converts into a project once the deposit arrives.

### A. Sales pipeline (Lead / Deal)

| #   | Stage                      | Enters when                                            | Exit criteria                                   | Default follow-up rule                       |
| --- | -------------------------- | ------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------- |
| 1   | **New Lead**               | Call, text, FB/Marketplace message, web form, referral | Contact info + source logged                    | Respond within **1 hour**                    |
| 2   | **Contacted / Qualifying** | First reply sent                                       | Budget range, timeline, scope, address captured | Follow up at **+1, +3, +7 days** if no reply |
| 3   | **Meeting Booked**         | Initial in-home meeting / measurement scheduled        | Meeting date set                                | Reminder to client **24h before**            |
| 4   | **Initial Meeting Done**   | Measurement completed                                  | Measurements + photos uploaded                  | Design due within **5 days**                 |
| 5   | **Design / Quote Sent**    | 3D design + itemized quote sent                        | Client responds                                 | Follow up at **+2, +5, +10 days**            |
| 6   | **Design Approved**        | Client approves design + quote                         | Signed approval / contract                      | Request deposit same day                     |
| 7   | **Won — Deposit Received** | **First check received**                               | Deposit amount + date logged                    | Auto-create Project                          |
| —   | **Lost**                   | Any stage                                              | Lost reason required                            | Optional re-engage in 60 days                |

**Lost reasons (pick list):** price, went with competitor, timing/postponed, no response, out of service area, scope too small, other.

### B. Delivery pipeline (Project)

| #   | Milestone                          | Key date field                           | What happens                                                        | Payment trigger             |
| --- | ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------- | --------------------------- |
| 1   | **Deposit Received**               | `deposit_received_at`                    | First check in                                                      | ✅ Payment 1                |
| 2   | **Materials Ordered**              | `order_date`                             | Cabinets/counters ordered from supplier                             | —                           |
| 3   | **Materials Expected / Delivered** | `expected_delivery_date`, `delivered_at` | Track supplier ETA, inspect for damage                              | (optional progress payment) |
| 4   | **Project Start**                  | `start_date`                             | Demo / install begins                                               | —                           |
| 5   | **Mid-Project Check**              | `mid_check_date`                         | Walkthrough with client, change orders captured                     | (optional progress payment) |
| 6   | **Tasks & Issues**                 | ongoing                                  | Task board + issue log (damaged parts, delays, change orders)       | —                           |
| 7   | **Install Complete**               | `install_complete_date`                  | All work done, punch list started                                   | —                           |
| 8   | **Final Inspection**               | `final_inspection_date`                  | Client walkthrough + punch list closed (+ permit inspection if any) | —                           |
| 9   | **Final Payment**                  | `final_payment_received_at`              | **Last check** received                                             | ✅ Final payment            |
| 10  | **Project Closed**                 | `closed_at`                              | All costs entered, margin locked                                    | —                           |

**Rule:** a project cannot be marked **Closed** until (a) balance due = $0, (b) punch list = 0 open items, (c) actual costs entered.

### C. Payment schedule

Configurable per project. Default templates:

| Template      | Schedule                                                   |
| ------------- | ---------------------------------------------------------- |
| Cabinets only | 70% deposit at order → 30% on delivery                     |
| Full remodel  | 50% deposit → 25% at mid-project → 25% at final inspection |
| Custom        | Any number of installments, by % or fixed $                |

Each installment has: amount, due trigger (milestone or date), method (check, Zelle, card, cash), check #, received date, status (due / received / overdue).

---

## 4. Data model (Supabase / Postgres)

```
companies        id, name, settings_json, timezone
users            id, clerk_id, company_id, name, role (admin|designer|field), phone
contacts         id, company_id, name, phone, email, address, city, zip, notes
leads            id, company_id, contact_id, source, stage, owner_id,
                 budget_min, budget_max, scope (cabinets|counters|full|other),
                 desired_timeline, next_follow_up_at, lost_reason, created_at
activities       id, lead_id|project_id, type (call|text|email|fb_msg|meeting|note),
                 direction (in|out), summary, created_by, occurred_at
meetings         id, lead_id, type (initial|design_review|mid_check|final), scheduled_at, status
quotes           id, lead_id, version, line_items_json, subtotal, tax, total,
                 sent_at, approved_at, file_url
projects         id, company_id, lead_id, contact_id, name, status, project_manager_id,
                 contract_value, deposit_received_at, order_date, expected_delivery_date,
                 delivered_at, start_date, mid_check_date, install_complete_date,
                 final_inspection_date, final_payment_received_at, closed_at
milestones       id, project_id, name, planned_date, actual_date, status, sort_order
tasks            id, project_id, milestone_id, title, description, assignee_id,
                 due_date, priority, status (todo|doing|blocked|done), sort_order
issues           id, project_id, type (damage|delay|change_order|client|other),
                 description, cost_impact, schedule_impact_days, status, photo_urls
change_orders    id, project_id, description, price_change, cost_change, approved_at
payments         id, project_id, label, amount, due_trigger, due_date, received_at,
                 method, check_number, status
costs            id, project_id, category (materials|labor|subcontractor|permit|
                 delivery|disposal|other), vendor, estimated_amount, actual_amount,
                 paid_at, receipt_url
files            id, project_id|lead_id, kind (photo|design|contract|receipt|permit), url
```

Use RLS by `company_id`. Field role sees only assigned projects.

---

## 5. Screens (v1)

| Screen                  | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| **Today** (home)        | Follow-ups due now, today's meetings, overdue payments, blocked tasks, projects starting this week  |
| **Leads board**         | Kanban by sales stage; drag to move; card shows name, scope, budget, days in stage, next follow-up  |
| **Lead detail**         | Contact info, activity timeline, quick-log call/text, quotes, convert-to-project button             |
| **Projects board**      | Kanban by delivery milestone (4–5 active cards)                                                     |
| **Project detail**      | Header with key dates; tabs: Overview, Tasks, Issues, Payments, Costs, Files                        |
| **Timeline / Calendar** | Gantt-style view of all active projects + meetings, so overlaps and crew conflicts are visible      |
| **Payments**            | All installments: due, received, overdue                                                            |
| **Analytics**           | See section 7                                                                                       |
| **Settings**            | Users and roles, pipeline stages, follow-up rules, payment templates, cost categories, lost reasons |

**UX rules:** mobile-first for field use; one-tap "log a call"; every lead must always show a `next_follow_up_at` (app nags if empty); red badges for anything overdue.

---

## 6. Automations

| Trigger                                         | Action                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| New lead created                                | Set follow-up = now + 1h; assign to default owner                              |
| No activity on lead for N days (per stage)      | Add to Today follow-up queue; optional SMS/email nudge to owner                |
| Meeting in 24h                                  | Reminder to client + assignee                                                  |
| Design approved                                 | Create deposit payment as "due"                                                |
| Deposit received                                | Convert lead → project, generate milestones + task template + payment schedule |
| Expected delivery passes without `delivered_at` | Flag "Delivery overdue"                                                        |
| Milestone with payment trigger completed        | Mark that installment "due"                                                    |
| Payment due > 3 days                            | Mark overdue, show on Today                                                    |
| Final payment received + punch list clear       | Prompt to close project and lock margin                                        |

**Default project task template (editable in Settings):** confirm measurements → order cabinets → order countertops → schedule delivery → demo → plumbing/electrical rough-in → cabinet install → countertop template → countertop install → backsplash → fixtures/appliances → punch list → final clean.

---

## 7. Margin & profit analytics

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

| Metric                      | Definition                                                    |
| --------------------------- | ------------------------------------------------------------- |
| Leads by source             | Count + conversion rate per source (FB, referral, calls, web) |
| Funnel                      | Count and % moving between each sales stage                   |
| Lead → Won rate             | Won ÷ (Won + Lost)                                            |
| Avg response time           | First outbound activity − lead created_at                     |
| Avg days to close           | deposit_received_at − lead created_at                         |
| Pipeline value              | Σ quote totals in stages 5–6 (weighted optional)              |
| Revenue booked vs collected | By month                                                      |
| Gross profit & margin %     | By month and per project; target line (e.g., 30%)             |
| Cost breakdown              | Materials / labor / subs / other, % of revenue                |
| Over-budget projects        | Actual cost > estimate by > 10%                               |
| Lost reasons                | Pareto chart                                                  |
| Capacity                    | Active projects vs target (4–5); upcoming start dates         |

Margin is **locked** at project close; edits after close require admin and are logged.

---

## 8. Build phases

| Phase       | Scope                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1 — MVP** | Auth/roles, contacts, leads board + activities + follow-up queue, convert to project, projects board, milestones/dates, tasks, payments, costs, basic per-project margin |
| **2**       | Calendar/Gantt timeline, task templates, issues + change orders, file/photo uploads, company analytics dashboard                                                         |
| **3**       | SMS/email reminders, client status page with design approval, CSV export / QuickBooks export, lead capture form + FB lead intake                                         |

---

## 9. Working rules for Claude in this project

- Ask before adding new dependencies or changing the data model; keep migrations in `/supabase/migrations`.
- Prefer simple, admin-editable configuration (stages, templates, rules stored in DB) over hard-coded logic — the owner must be able to change things without a developer.
- Money stored as integer cents; dates as `date`, events as `timestamptz`.
- Every list view needs empty, loading, and overdue states.
- Show me tables/diagrams when explaining structure; be direct about trade-offs and flag scope creep.
- When giving deployment steps, include the Vercel Framework Preset (Next.js) and env var setup for Clerk + Supabase; include Stripe webhook steps only if/when online payments are added.
