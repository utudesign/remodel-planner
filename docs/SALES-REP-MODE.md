# Sales-rep mode: the app is Tugu's sales tool

**Read this first. It overrides CONTEXT.md §1, FIELD-AND-OFFICE.md and any doc that treats the app as RenoDesign's company system.**

## 1. Who's who

| | Who | What they do | In the app |
|---|---|---|---|
| **Me (the rep)** | Tugu, solo, phone only, day job weekdays 7:00 AM–3:30 PM ET | Find leads (Facebook Marketplace, DMV groups, referrals), qualify, visit, measure, photograph, quick estimate, get the deal **ready**, hand it off | `owner` of his own company account (the tenant) |
| **Partner** | **RenoDesign Inc.**, Crystal's company, licensed in Virginia | Design + final estimate (or orders the design from the vendor), **signs the contract in RenoDesign's name**, orders, installs with crew/subs, collects all client payments | A **partner** record. Crystal can get an optional `partner` login that sees **only deals handed to RenoDesign**, and can update only job progress and price |
| **Other partners** (later) | Any other contractor Tugu sells for | Same | Same; each partner has its own commission plans |
| **Vendor** | TimberPeak (cabinets) | Price list; may do designs | Price list import (0002/0003); design requests tracked on the deal |

I get paid a **commission** from the partner, later. The app tracks every deal from first message to **commission paid**, and keeps **my** business money (commissions, expenses, mileage), separate from my title-clerk job.

## 2. My deal lifecycle

| Stage | What happens | App |
|---|---|---|
| Lead | Message from Marketplace / FB group / referral / call | Deal `26-1047` created; auto-reply; source recorded |
| Qualified | Scripted questions: cabinets only or full kitchen, timeline, budget, who decides, own the home, year built | Qualify form (Today screen nudges) |
| Visit booked → done | Measure, photos, sketch, appliance list, ballpark | Site Visit form → deal jacket (photos offline-safe) |
| Estimate | Quick estimate from TimberPeak list × 0.33 + quartz + HD items; "this pays you $X" | Quick estimate + commission preview |
| Ready → **Handed off** | Pick partner + commission plan; hand-off checklist must be complete | `handed_off_at`; DB refuses if the checklist is missing (0006) |
| With partner | Partner signs, orders, installs | Partner (or I) update: signed, ordered, in progress, completed / cancelled, sold price, change orders, deposit received, paid in full |
| Commission | Earned at deposit / paid in full per plan; I record what I receive | `deal_commissions`: expected, earned, paid, owed |
| Closed | Commission fully paid | Review request + referral ask go out (from me or the partner) |

## 3. Commission plans (configurable per partner)

| Field | Example | Notes |
|---|---|---|
| basis | contract price (sold price + approved change orders) | or partner-reported gross profit, if the partner shares it |
| rate | 5% kitchens, 8% cabinets only | `numeric(5,4)` |
| first payout | 50% when the client's deposit is received, rest when paid in full | 0% = all at the end, 100% = all at deposit |
| floor | $250 per deal | small cabinet jobs |

Verified (`test/run_sales_tests.sql`, `lib/commission`):
- **Kitchen:** sold at $38,500 at 5% = **$1,925**. Half ($962.50) is earned when the deposit is received. A $1,500 change order plus payment in full raises the total to **$2,000**. After I've received $962.50, **$1,037.50 is still owed**.
- **Cabinets only:** $4,200 at 8% = $336, all earned at the deposit. A $1,800 job pays the $250 floor.
- **Cancelled before the deposit:** $0.
- **Rounding:** TypeScript and SQL agree to the cent.

**Open: cancelled after the deposit** keeps the first payout. Change this when the written agreement says otherwise.

## 4. Hand-off checklist (gate `before_handoff`, owner-editable)
Required:
- Site photos: every wall, ceiling, floor, the panel, under the sink.
- Measurements + sketch.
- Appliance list (model numbers, or "reuse").

Optional:
- Approved design / cabinet list.
- The estimate the client saw.

**Hand-off packet:** one tap builds a PDF + ZIP (customer, address, scope, budget, notes, measurements, photos, estimate) and shares it to Crystal by text or email. If she has a login, she simply sees the deal.

## 5. Crystal's optional login (`partner` role, tested)
- She sees **only** deals handed to RenoDesign (not my other leads, not other partners' deals, not my expenses).
- She can update **only**: job status, sold price, change orders total, gross profit (optional), deposit date, paid-in-full date, completion date, cancellation and a note.
- She can see the commission plan and what's been paid, so we both see the same numbers.
- Only I record commission payments I've received.
- She sees the hand-off files (photos, design, contract, permits, other), not my estimates folder.

## 6. My money (not RenoDesign's)
| Screen | Data |
|---|---|
| **Commissions** | Per deal: expected, earned, paid, owed, status; totals: owed to me now, pipeline (not yet earned), paid this year. Overdue: earned > 14 days and unpaid → Today |
| **Expenses** | Receipt photo → amount, category (marketing, phone, samples, vehicle, tools, meals, software, license fees), optional deal |
| **Mileage** | Per trip, from a deal (site visits); IRS rate is a setting (check it each January) |
| **Year** | `rep_year_summary()`: commissions received − expenses − mileage = net; **tax set-aside %** setting (as a 1099 contractor, income tax + ~15.3% self-employment tax); CSV export for the tax preparer |

## 7. Automations (no admin)
- Auto-reply to each new lead, including FB Marketplace messages pasted in, with my qualifying questions and a booking link (weekday evenings + Saturday).
- Today screen:
  - leads with no touch in 2 days;
  - visits today;
  - deals ready to hand off;
  - handed-off deals with no update in 7 days ("ask Crystal");
  - commission earned but unpaid.
- Push digest at 3:30 PM, when the day job ends. Quiet during the day job except new leads (silent badge).

## 8. What's no longer my app's job
These now happen at RenoDesign:
- contracts, the 3-day cancellation paperwork, lead-safe paperwork;
- ordering, delivery claims, crew and subs;
- client payments, change-order signatures, warranty.

The tested modules for them (0004 order/close gates, 0005 compliance) stay in the bundle as an optional **contractor module**, in case Crystal wants to run RenoDesign's jobs in the same app later. **Don't build their screens now.**

What **does** stay my responsibility, because I'm the one in the home (see COMPLIANCE-AND-OPS §0):
- I never take money personally;
- I present RenoDesign's contract, with its license number, and the 3-day notice when the client signs in the home;
- I don't promise prices or dates RenoDesign hasn't approved.
