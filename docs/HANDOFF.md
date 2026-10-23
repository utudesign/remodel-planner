# Handoff: my kitchen sales tool (design → build)

These files come out of the design chat. The real app is built in a separate Claude Code project from them.

**What the app is:** Tugu's personal sales tool. He finds and prepares kitchen and cabinet deals, hands them off to a licensed contractor partner (RenoDesign Inc., Crystal's company), and tracks his commission. It also tracks his own business money, kept separate from his day job.

## Start here
1. Create the repo (e.g. `~/Projects/kitchen-sales`), unzip this bundle at its root, open it in VS Code and start Claude Code.
2. Paste **`docs/PROMPT-v2-master.md`**. Approve the Step 0 plan before any code is written. That prompt calls `PROMPT-deals.md` and `PROMPT-estimating.md` at the right steps.
3. Ship one step at a time and use it on real leads for a week before starting the next.

## What's inside
| Path | What it is | Status |
|---|---|---|
| `docs/PROMPT-v2-master.md` | The prompt that drives the whole build | Prompt |
| `docs/SALES-REP-MODE.md` | Who's who, deal lifecycle, hand-off, commission plans, partner login, my money, automations | **Spec: wins over the other docs** |
| `docs/DEALS.md` | Deal numbers `26-1047`, document numbers `26-1047-E1`/`-D1`/`-CO1`/`-R1`/`-PO1`, the deal jacket, photos | Spec |
| `docs/QUICK-ESTIMATE.md`, `docs/ESTIMATING.md` | Quick estimate, TimberPeak list × 0.33, quartz levels, Home Depot comparison, quote math | Spec |
| `docs/COMPLIANCE-AND-OPS.md` | §0: the rep's own obligations. §1–4: the contractor's Virginia rules and gap list (useful for Crystal) | Spec |
| `docs/CONTEXT.md`, `docs/FIELD-AND-OFFICE.md` | Original company-wide design. Team, admin and crew are now an **optional contractor module** | Reference |
| `docs/PROMPT-deals.md`, `docs/PROMPT-estimating.md` | Step-level prompts, called from the master prompt | Prompt |
| `docs/PROMPT-kickoff.md` | Original Phase 1 prompt (replaced by v2) | Old |
| `docs/research/` | Price research and business-gaps research, with sources | Research, Oct 23, 2026 |
| `supabase/migrations/0002_estimating.sql`, `0003_estimating_seed.sql` | Price book, quotes, takeoff, price lists, Home Depot comparison | Tested |
| `supabase/migrations/0004_deal_jacket.sql` | Deal and document numbers, deal files and storage rules, checklist gates, recap | Tested |
| `supabase/migrations/0005_compliance.sql` | Contractor module: 3-day cancel window, signed change orders, lead-safe items, subs, warranty, lead-source stats | Tested (optional module) |
| `supabase/migrations/0006_sales_rep.sql` | Partners, commission plans, hand-off gate, partner login limits, commissions view, expenses, mileage, year summary | Tested |
| `supabase/seed/` | The TimberPeak price list (4 color groups) and its import | Tested |
| `lib/estimating/`, `lib/deals/`, `lib/commission/` | Pricing, takeoff, ballpark, vendor import, comparison, deal numbers, commission. **75 tests**, strict TypeScript | Tested |
| `test/` | Stub of 0001 plus SQL tests; `run_all.sh` shows the order | Tests |

## Before the first hand-off
- **Sign a written commission agreement with RenoDesign.** It should cover:
  - rate and basis;
  - when the commission is earned;
  - what happens on cancellation or refund;
  - change orders;
  - when you get paid;
  - who owns the lead;
  - what happens to deals already handed off if you stop working together.

  Then put those terms into the commission plans (the seeded ones are placeholders).
- **Ask Fairfax County Cable and Consumer Services** whether in-home sales by appointment need a solicitor license, and whether you need your own.
- **Selling to Maryland homes?** That needs a Maryland salesperson license.
- **Get RenoDesign's contract package for your hand-off kit:** the contract with its license number, the 3-day cancellation notice, and the Statement of Consumer Protections.
- **Taxes:** set the tax set-aside % and the IRS mileage rate in Settings.

## Verified numbers
| Check | Result |
|---|---|
| 10x10 cabinets, TimberPeak group 1, at cost (× 0.33) | $3,076.87 (sheet $3,076.92) |
| Quick estimate with group 1 + Level 3 quartz | $20,896.43; at 5% that pays you $1,044.82 |
| Hampton Bay equivalent at Home Depot | $4,033.55 before tax |
| Deal numbers | 26-1001, 26-1002, …. 11:30 PM Dec 31 ET still counts as 26-; Jan 1 → 27-1001. 50 deals created at once get 50 consecutive numbers |
| Hand-off | Refused without a partner and plan, without a plan from that same partner, or without photos + measurements + appliance list |
| Kitchen commission | $38,500 × 5% = $1,925. Half is earned at deposit. After a $1,500 change order and payment in full it's $2,000, with $1,037.50 still owed once $962.50 is received |
| Cabinets-only commission | $4,200 × 8% = $336, all earned at deposit. A $1,800 job pays the $250 floor |
| Cancelled before deposit | $0 |
| Crystal's login | Sees only the 3 deals handed to RenoDesign, not other partners' deals or your expenses. Can update only job progress and price. Can't record commission payments |
| Year summary | $962.50 received − $74.99 expenses − 42.5 mi × 70¢ = $857.76 net |
| TypeScript vs SQL | Identical to the cent |
