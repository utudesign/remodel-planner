# Compliance and operations: what was missing

Source: `docs/research/Kitchen remodel business gaps.md` (Oct 23, 2026, with citations). **General information, not legal advice: have a Virginia construction lawyer review the contract template, the cancellation form and these rules once, before relying on them.**

## 0. You as the sales rep (read first)

The contractor (RenoDesign Inc.) holds the license, signs the contract and is responsible for §1–§4 below. As the person selling in the home, you still need these:

| Item | Why | Status |
|---|---|---|
| **Written commission agreement** with RenoDesign | Rate and basis, when it's earned (deposit / paid in full), what happens on cancellation or refund, change orders, payment timing, who owns the lead and client, and what happens to deals already handed off if the partnership ends | Not done. Put the agreed numbers into a commission plan |
| **Never take client money yourself** | Deposits and checks are made out to *RenoDesign Inc.*; the contract must be signed by both sides before any payment (18VAC50-22-260 B8) | The app records payments only as reported by the partner |
| **Present RenoDesign's contract and its license number** | The license and the contract are hers; you can't sell under your own name | Partner record holds the license number and class |
| **3-day cancellation notice when the client signs in the home** | FTC 16 CFR 429 applies to the sale even when a sales rep makes it | Partner's contract package; check it's in your hand-off kit |
| **Fairfax County solicitor license** | "Any contractor seeking work through home solicitation also must carry a solicitor license" (Fairfax County DCCS). Ask DCCS whether appointment-only visits count and whether a rep needs his own | Ask Fairfax DCCS |
| **Maryland salesperson license** | "A person must have a salesperson license or contractor license whenever the person sells a home improvement in the State" (Md. Bus. Reg. §8-301(b)). Only needed if you sell to Maryland homes | Only if you sell in Maryland |
| **Taxes as a 1099 contractor** | Commissions arrive without withholding; set aside income tax + self-employment tax; keep receipts and a mileage log | The app's money screen covers this |
| **Lead-paint (pre-1978)** | Partner's job, but you record **year built** at the visit so it's flagged early | Site Visit form field |

Sources: [Fairfax County DCCS: hiring a contractor](https://www.fairfaxcounty.gov/cableconsumer/node/200), [Md. Code, Bus. Reg. §8-301](https://mgaleg.maryland.gov/2026RS/Statute_Web/gbr/8-301.pdf). General information, not legal advice.

The rest of this file describes the **contractor's** obligations. It's useful in the hand-off kit you give Crystal, and in the optional contractor module.

## 1. Enforced by the database (`0005_compliance.sql`, tested)

| Rule | Source | How it's enforced |
|---|---|---|
| Client has 3 business days to cancel an in-home sale | FTC 16 CFR 429; Va. Code 59.1-21.1 | `contract_signed_at` → `cancel_deadline` (midnight ET after the 3rd business day; Sundays + FTC holidays skipped). **Order date can't be set before it** unless `cancellation_waived` (bona fide emergency, buyer's handwritten waiver filed) |
| No payment before the contract is signed by both | 18VAC50-22-260 B8 | A payment can't be marked received while `contract_signed_at` is empty |
| Change orders written + signed by all parties | B9(j), B31 | Numbered `26-1047-CO1…`; can't be approved without `client_signed_at`; approved ones can't be edited; `schedule_days` moves the completion date |
| Payment receipts numbered | — | `26-1047-R1…` assigned when a payment is received |
| Pre-1978 homes: lead-safe (RRP) | 40 CFR 745 | `year_built` on the deal (unknown counts as pre-1978). Jacket adds: Renovate Right pamphlet receipt, certified renovator, lead-safe records. **Start date can't be set** without the before-start items |
| Statement of Consumer Protections, signed | B9(h) | Before-order jacket item |
| Notice of cancellation (2 copies) | 16 CFR 429 | Before-order jacket item when `sold_in_home` |
| Cabinet delivery inspected | Vendor claim windows: 24 h – 2 business days | Before-start jacket item (signed receipt + photos) |
| Subs: license, liability + workers' comp certificates, W-9 | B29; workers' comp threshold | `subcontractors` + `subcontractor_compliance` view: ok / expiring (30 days) / expired / missing |
| Warranty clock | B30 | `substantial_completion_on` → `deal_warranty`: ends + 11-month check-in date |
| Speed to lead + cost per source | — | `first_response_at`; `lead_source_stats` (leads, answered in 5 min / 1 h, won, value) |

Verified: deadlines Fri Oct 23 → ends Tue Oct 27 11:59 PM; Sat Nov 7 → Thu Nov 12 (Veterans Day skipped); Tue Nov 24 → Sat Nov 28 (Thanksgiving skipped); Dec 31 11:30 PM → Tue Jan 5. Saturdays count as business days under the FTC definition; ask the lawyer to confirm.

## 2. P0: before the next contract (app work)

| Item | Detail |
|---|---|
| **Contract template with all 11 Virginia terms** | (a) start + estimated completion dates, (b) total price + contract type, (c) payment schedule incl. down payment, (d) itemized materials/work, (e) plain-language delay clause (not abandonment), (f) permits/inspections/zoning compliance, (g) both parties' cancellation rights, (h) signed acknowledgment of DPOR's **Statement of Consumer Protections** (7/1/2025 version), (i) name, address, **license number, class, specialties**, (j) changes only in writing signed by all, (k) **Recovery Fund notice** with Board contact info. The app refuses to send a contract missing any field |
| **3-day notice** | Bold 10-pt "you may cancel" statement in the contract + 2 copies of the Notice of Cancellation form; record where it was signed (in home or not). If cancelled: refund within 10 business days (task with due date) |
| **No sales tax line** | On install jobs the contractor pays tax on materials and **must not** show sales tax to the client. The quote's tax stays a cost inside the price (0002 already works that way); the client PDF must never say "sales tax". Selling cabinets **without** installation is different (dealer registration, collect tax): flag "materials-only sale" deals |
| **License class vs contract value** | Class C under $30k, B $30k–<$150k, A $150k+ (verify against 18VAC50-22-30). Store the company's class; warn before sending a quote over the limit |
| **E-sign** | Separate "I agree to sign electronically" consent, audit trail (who, when, IP, device), and a PDF the client can save/print. Also offer a printed copy for the cancellation notice |
| **Workers' comp** | Required with more than 2 employees, and subs' employees count. Keep the certificate (or exemption) in Settings with its expiry |

## 3. P1: within the next few jobs

- Deposit guardrail: warn above 10% (30% when custom items are ordered); DPOR/Fairfax guidance. **Change CONTEXT §3's 50% deposit default** to 30/30/30/10 (signing / cabinets delivered / countertops installed / final) as an editable template.
- Permit panel per deal: jurisdiction, permit number, status, inspections, mechanics' lien agent named on the permit. Fairfax needs a permit for new/moved outlets, lights, sinks, hood ductwork and even a direct stove/oven swap; cabinets, counters, flooring and paint alone don't.
- Selections lock before cabinet order: appliance model + spec sheet + cutout size, sink, faucet holes, hardware, panel-ready appliances. Late upgrades drive 35% of overruns.
- Orders: per order line, needed-on-site date (from install date), confirmed ship date, delivery date, **claim deadline clock**, received vs expected box count.
- Schedule gates: countertop template only after "cabinets set and level"; stalled-job alert at 20 days (abandonment = 30 days).
- Lien waiver required on each crew/sub payment; lien deadline clock on unpaid client balances (90 days, Va. Code 43-4).
- Payments: ACH first, optional card with fee passed on (card on $40k ≈ $1,200).
- Client update link + weekly update (done / next week / decisions needed / issues), drafted from photos and tasks.
- Lead source spend → cost per signed job; auto-reply + 5-minute timer.
- Design checks on the estimate: hood over 400 CFM → makeup air; island outlets (2020 NEC in Virginia until ~Oct 2027); GFCI for dishwasher; permit triggers.
- Demo-day hidden-conditions checklist that drafts a change order.

## 4. P2: when time allows

Punch list + warranty tickets + 11-month check-in; review request by email at sign-off; financing fields with margin after dealer fee; design retainer credited to construction; stage conversion + days in stage; NKBA layout checks; photo report; code edition per deal; record retention (DPOR 5 years, RRP 3 years); AI estimating from photos/voice.
