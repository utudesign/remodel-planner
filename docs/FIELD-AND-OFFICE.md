# Field & office workflows: spec addendum to CONTEXT.md

The app earns its keep at the **handoffs** between three people who rarely meet: call → first reply, home visit → design, design → presentation, approval → order. This doc specifies the screens and rules for those handoffs and for the office admin's shifts.

---

## 1. Who does what, on what, when

| Person | Role | Device | Available (ET) | Owns |
|---|---|---|---|---|
| Tugu | owner, sales | **Phone only** | Day job weekdays 7:00 AM–3:30 PM; free evenings + weekends | Home visits, negotiation, ballpark, presenting designs, closing |
| Crystal | owner, PM + design | Laptop + phone | Flexible | Home visits (with Tugu), design, estimate/quote, orders, install schedule, crew |
| Office admin | team | Laptop + phone | **Split shift** (below) | Lead replies, follow-ups, booking visits, confirmations, payments, order tracking, keeping the app clean |
| Crew / subs | crew | Phone (optional) | Job days | Tasks, materials pick list, photos, issues |

Home visits happen when **both** Tugu and Crystal are free: weekday evenings and weekends.

## 2. The admin's split shift (proposal: confirm the hours with her)

Total 8 h/day: half live during US business hours, half back-office during the US night.

| Block | ET | Manila now (EDT, +12 h) | Manila after Nov 1 (EST, +13 h) | Purpose |
|---|---|---|---|---|
| **Live** | 11:00 AM – 3:00 PM | 11:00 PM – 3:00 AM | 12:00 AM – 4:00 AM | Talk to clients: answer leads, calls, book and confirm visits, chase payments. Covers Tugu's day-job hours. |
| **Back office** | 11:00 PM – 3:00 AM | 11:00 AM – 3:00 PM | 12:00 PM – 4:00 PM | No client contact. Clean the pipeline, review site visits, queue tomorrow's messages, track orders, write the morning brief. |

Anchor the schedule in ET. Manila has no daylight saving, so her local clock moves by an hour twice a year. The app stores each user's `work_windows` in ET.

**Lead coverage map (weekdays, ET)**

| Time | Who answers a new lead | Gap? |
|---|---|---|
| 7:00 – 11:00 AM | Business-line auto-reply ("Thanks! We'll call you before noon.") + push to Tugu, who replies on a break if he can | **Yes, the weakest window.** Consider moving Live to 9:00 AM–1:00 PM if morning leads turn out to be common |
| 11:00 AM – 3:00 PM | **Admin** (live) | — |
| 3:00 – 3:30 PM | Push to Tugu | Small |
| 3:30 – 9:00 PM | **Tugu** (and both owners during visits) | — |
| 9:00 PM – 8:00 AM | Nobody contacts clients (quiet hours). Admin queues replies for 8:00 AM | Intentional |

Check the gap with real data after 4 weeks: the dashboard shows average first-response time by hour of day (CONTEXT §8).

## 3. Lead routing + quiet hours (app rules)

| Rule | Behavior |
|---|---|
| New lead arrives | If someone is in a `live` work window now → assign to them + push. Else → push to the lead owner (default Tugu) and mark "waiting for live shift". The 1-hour clock always runs; the dashboard reports misses. |
| Quiet hours | Default 9:00 PM – 8:00 AM ET. Client-facing messages written during quiet hours are saved as **scheduled** (default 8:00 AM). In Phase 1 this is a "send at" reminder; in Phase 3, Twilio sends it automatically. |
| Follow-up due while nobody is live | Shows on the next live person's queue first thing. |
| Visit booking | Only offers slots inside the owners' shared `field` windows, minus existing meetings + 30 min travel buffer. |

Settings (owners): `quiet_hours_start`, `quiet_hours_end`, `lead_response_minutes` (60), `design_due_days` (5), `visit_buffer_minutes` (30).

## 4. Site Visit form (Tugu, phone, at the house)

One scrolling screen, filled before leaving the driveway. It replaces "photos + hand drawing over text".

| Section | Fields | Required? |
|---|---|---|
| **Client** | Who decides, timeline + reason, budget range said out loud, style (shaker/flat/other), color, countertop (quartz/granite/other) | Decision makers + timeline |
| **Scope** | Cabinets / counters / backsplash / flooring / lighting / plumbing moves / appliances new or kept | Yes |
| **Walls** | Per wall: label (A, B, …), length at ~36", ~54", ~84", ceiling height, windows/doors (distance from corner, width) | At least one wall |
| **Sketch** | Photo of the hand drawing (no retyping) | Yes |
| **Required photos** (checklist; each tick = a photo) | Each wall straight on · every corner · under the sink · electrical panel (door open) · each appliance model label · ceiling line · floor at cabinet toe | Yes, all ticked or marked "N/A" with a reason |
| **Appliances** | Keep/new, type, model # (photo of label is enough), width | Yes |
| **What we said** | Ballpark range shown (auto-filled from §5), anything promised ("LED included", "start before Christmas") | Ballpark if one was given |
| **Next step** | Design review booked? (date) or "admin to book" | Yes |

**Submit →**
1. Status `submitted`; completeness score shown (e.g. 18/18).
2. A **design request** is created for Crystal with `due_at = visit + design_due_days`.
3. Push to Crystal + admin. Event in the feed: "Site visit: Lee, 10x10, ballpark $22.5–28K".
4. If anything is missing, the admin (back-office shift) or Crystal taps **Ask for info**. That creates a checklist task for Tugu ("Need: fridge model label photo"), and the design clock pauses until it's answered.

Offline-safe: photos are compressed on the phone and upload in the background; the form saves a draft every change.

## 5. Phone ballpark (Tugu, during the visit)

Code: `lib/estimating/ballpark.ts` (tested). It uses the real price book, so the range moves when costs change.

1. Pick a template ("10x10 L-shape - shaker + quartz").
2. Enter rough numbers: cabinet run (ft), counter runs (in), range/fridge openings, doors/drawers count; toggles for LED lights, crown, backsplash.
3. Screen shows a big range, e.g. **$22,500 – $28,000**, with the line "Final price after design", plus warnings ("far from template size: pick a closer template").
4. **Save to visit** stores inputs + range on the site visit, so Crystal and the admin see exactly what was said.

Range = middle −5% (round down) to +15% (round up), to the nearest $500 (owner settings). The range is wider on the high side on purpose: real kitchens find surprises, rarely savings.

## 6. Design queue (Crystal, laptop)

| Status | Meaning | Who sees what |
|---|---|---|
| `waiting` | Site visit submitted, not started | Crystal's queue sorted by due date; overdue red |
| `needs_info` | Waiting on Tugu's answer | Tugu's Today shows the open ask |
| `in_design` | Crystal working | Tugu sees "In design, due Tue" |
| `ready` | Design + quote ready | **Push to Tugu**: "Lee design ready", open on phone: render, section totals, client link |
| `presented` | Tugu showed the client | Admin starts quote follow-ups (+2, +5, +10 days) |
| `revising` | Client asked for changes | Back to Crystal with notes; new quote version |
| `approved` | Client approved | Deposit request (CONTEXT §3) |

Tugu presents from his phone using the client quote preview (ESTIMATING §5): section totals only, never costs. He can text the client the link from the driveway.

## 7. Admin command center (laptop; also works on phone)

One screen, sections in priority order; each item has a one-tap action. Empty sections collapse.

| # | Section | Action |
|---|---|---|
| 1 | **New leads unanswered** (with timer) | Call / text from the business line → Log |
| 2 | **Follow-ups due now** | Use script → Log → set next follow-up (required) |
| 3 | **Visits to book** (leads ready to measure) | Pick a slot from owners' field windows → client confirmation scheduled |
| 4 | **Tomorrow's visits to confirm** | Confirmation text scheduled for 9:00 AM |
| 5 | **Site visits to review** (completeness < 100%) | Ask Tugu for info |
| 6 | **Designs overdue / quotes waiting on client** | Nudge Crystal / follow up client |
| 7 | **Payments due / overdue** | Remind client / record check |
| 8 | **Orders + deliveries** (to order, ETA passed, damaged) | Mark ordered / call supplier / create issue |
| 9 | **Data hygiene** | Leads with no next follow-up, jobs with no PM, tasks with no due date |

### Shift checklists (built into the screen as ticks)

**Live (11:00 AM – 3:00 PM ET)**
- [ ] Clear sections 1–2 in the first 30 minutes; keep them at zero all shift
- [ ] Book visits (3) and confirm tomorrow's (4)
- [ ] Payment reminders by phone (7)
- [ ] Post **shift handoff** before leaving

**Back office (11:00 PM – 3:00 AM ET)**
- [ ] Review every site visit submitted today (5); ask for missing info
- [ ] Queue tomorrow's follow-up texts for 8:00 AM; nothing goes to clients now
- [ ] Update orders + deliveries from supplier emails (8)
- [ ] Data hygiene to zero (9)
- [ ] Write the **morning brief** (it publishes at 7:00 AM ET with the digest)

### Shift handoff / morning brief
The app drafts it from the shift's events; she edits and posts it to the activity feed (pinned for 24 h):

```
Night shift (Thu)
• 3 follow-ups queued for 8 AM (Smith, Lee, Patel)
• Lee site visit: missing fridge model photo → asked Tugu
• Patel deposit: check photo still missing
• Today: 2 visits (6:00 PM Kim, 7:30 PM Ortiz), cabinets for Smith arrive 10 AM
```

## 8. Outside the app (decide now; the app depends on these)

| Topic | Recommendation | Why |
|---|---|---|
| **Shared business phone number** | One VoIP business number on all three phones (calls + texts shared, with auto-reply and scheduled send) | The admin can't answer leads that arrive on Tugu's personal number. Put this number on every listing and post. |
| **Facebook Marketplace messages** | Messages to listings on a personal profile can only be answered from that profile. Either reply yourself and forward leads into the app, or check whether your listings can move to a business Page where the admin has a role | Don't share your personal Facebook login |
| **Quick-add lead** | Share-sheet / paste box in the app: paste a Marketplace message or a screenshot → creates a lead with source = Facebook | Gets every lead into one inbox, whoever saw it first |

## 9. Data model additions (merge into CONTEXT §5)

```
work_windows     id, company_id, user_id, weekday (0-6), start_time, end_time, kind (live|back_office|field)   -- ET
site_visits      id, company_id, lead_id, visited_at, visited_by uuid[], status (draft|submitted|needs_info|accepted),
                 client jsonb, scope jsonb, walls jsonb, appliances jsonb, checklist jsonb (key → file_id | 'na:<reason>'),
                 sketch_file_id, promised text, ballpark_low_cents, ballpark_high_cents, ballpark_inputs jsonb,
                 completeness smallint, submitted_at
design_requests  id, company_id, lead_id, site_visit_id, assignee_id, status (waiting|needs_info|in_design|ready|
                 presented|revising|approved), due_at, paused_at, ready_at, quote_id
info_requests    id, company_id, design_request_id, asked_by, asked_of, items jsonb (checklist), answered_at
shift_handoffs   id, company_id, user_id, shift_kind, shift_start, body, posted_at
scheduled_messages id, company_id, lead_id|project_id, channel (sms|email|call_reminder), body, send_at, sent_at, created_by
companies.settings_json += quiet_hours_start, quiet_hours_end, lead_response_minutes, design_due_days, visit_buffer_minutes
```

## 10. Numbers to watch (Analytics → Team)

| Metric | Target to start with |
|---|---|
| First response time, by hour of day | < 60 min during covered hours |
| Visit → design ready | ≤ 5 days |
| Design ready → presented | ≤ 2 days |
| Presented → decision | track; follow-ups +2/+5/+10 |
| Site visits needing a second trip | 0 |
| Leads with no next follow-up | 0 at the end of every shift |
