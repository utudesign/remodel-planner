# Master prompt v2: my kitchen sales tool

Paste this into Claude Code from the repo root. It replaces `PROMPT-kickoff.md`. If you've already started building, paste it anyway: Step 0 reconciles what exists.

---

You're building **my personal sales tool** for kitchen remodel and cabinet deals. I'm Tugu, a solo commission sales rep in Northern Virginia, working only from my iPhone. I have a day job on weekdays from 7:00 AM to 3:30 PM ET.

I find leads, qualify them, visit and measure, photograph, quick-estimate, and get each deal ready. Then I **hand it off** to a licensed contractor partner, **RenoDesign Inc.** (Crystal's company). They sign the contract, design, order, install and collect. I get a **commission** later. The app tracks every deal from first message to commission paid, plus my own business money, kept separate from my day job.

Read these docs first. Where they conflict, **the earlier one wins**:
1. `docs/SALES-REP-MODE.md`: who's who, my deal lifecycle, hand-off, commissions, partner login, my money
2. `docs/DEALS.md`: deal numbers `26-1047`, document numbers `26-1047-E1`, the deal jacket (photos and files)
3. `docs/QUICK-ESTIMATE.md` + `docs/ESTIMATING.md`: TimberPeak list × 0.33, quartz levels, Home Depot items and comparison
4. `docs/COMPLIANCE-AND-OPS.md` §0: my obligations as the rep. The rest of that file is the contractor's.
5. `docs/CONTEXT.md`: stack and data model. Its team, admin and crew parts describe an **optional contractor module: don't build those screens now.**
6. `docs/research/*.md`: sources

Stack: Next.js App Router + TypeScript, Supabase (Postgres, Storage, RLS), Clerk, Tailwind + shadcn/ui, installable PWA with web push, Vercel (Framework Preset: Next.js). I'm on a Mac M4 with VS Code.

Roles:
- `owner`: me
- `partner`: Crystal, optional
- `team` and `crew`: exist in the SQL, unused for now

**Tested; use these and don't rewrite them:**
- `supabase/migrations/0002`–`0006`. They were tested on Postgres 16 against `test/0000_supabase_stub.sql`; see `test/` for the run order.
- `lib/estimating/*`, `lib/deals/dealNumber.ts`, `lib/commission/commission.ts` and their tests.
- `supabase/seed/*` (my TimberPeak list) and `scripts/price-list-to-sql.ts`.

## Rules
- **iPhone first, 375 px**, every screen. 44 px tap targets, one hand, works on weak signal, photos never lost (offline queue).
- Money in integer cents. Times stored in UTC and shown in Eastern.
- The database enforces the rules (hand-off checklist, partner limits, numbers). The UI turns a refusal into a checklist with **Add** buttons, never a raw error.
- No client payments in my app except as reported by the partner. I never take client money.
- After each step: lint, typecheck, Vitest and build all pass. Commit, then tell me how to test it on my phone.
- Ask before adding a paid service or a heavy library.

## Step 0: plan, then stop
Read everything. Write `docs/PLAN.md` with:
- the 0001 migration (or changes to an existing one) so that 0002–0006 apply cleanly;
- the screens you'll build, step by step;
- anything unclear.

**Stop for my approval.**

## Step 1: foundation and deals
- Apply 0001, then 0002–0006. Seed:
  - `seed_default_estimating`;
  - `seed_default_deal_jacket`;
  - `seed_default_handoff`;
  - RenoDesign Inc. as a partner, with placeholder plans "Kitchens 5% (50% at deposit)" and "Cabinets only 8% (all at deposit, $250 floor)". I'll edit them to match our agreement.
- Clerk sign-in. I'm the only required user.
- Tabs: **Today · Deals · Money · More**. Floating **+**: New deal · Quick estimate · Take photos · Log call · Add expense · Log trip.
- Deals list by my stages (SALES-REP-MODE §2), with search by deal number (`parseDealNumber()`), name, phone or address. Card: `#26-1047`, name, scope badge (Kitchen / Cabinets only / Countertops / Bath), value, next step, and commission when it's known.
- Deal numbers: `docs/PROMPT-deals.md` Steps 1–2 (number everywhere, jacket shell). Tabs: Overview · Estimate · Photos · Files · Partner · Activity.

## Step 2: leads without an admin
- New lead from:
  - manual entry;
  - a pasted Facebook Marketplace or group message (parse name, phone, what they want);
  - a missed call;
  - a share link I post in groups that opens a short lead form.
- Auto-reply template with my qualifying questions and a booking link (weekday evenings and Saturday slots). `first_response_at` is stamped automatically.
- Qualify form: cabinets only or full kitchen, timeline, budget range, decision maker, owner or renter, year built, and how much they know about remodeling (to sort leads).
- Today screen and pushes as in SALES-REP-MODE §7. The digest arrives at 3:30 PM weekdays; nothing during my day job except new-lead badges.

## Step 3: visit, photos, quick estimate
- Site Visit form + photo pipeline: `docs/PROMPT-deals.md` Step 3, plus the offline queue.
- Quick estimate (`docs/PROMPT-estimating.md` Steps 1–5b, **phone-first quote builder**) with a **"this pays you $X"** line from `previewCommission()` for the deal's plan.
- Client view of the estimate, with section totals only, as a link or PDF. Label it "Estimate. Final price and contract from RenoDesign Inc." with the partner's license number. Never show sales tax as a line.

## Step 4: hand-off
- **Hand off** button: pick a partner and a plan. Then show the checklist from `deal_jacket_checklist` (gate `before_handoff`) with Add buttons. On success, build the hand-off packet (PDF + photo ZIP) and share it by text or email.
- Partner tab on the deal: status timeline, sold price, change orders, deposit and paid-in-full dates, partner note.
  - I can enter these myself from a text Crystal sends me.
  - If Crystal has a login she updates them. Invite her from More → Partners.
- Partner login screens: her deals list and a deal page with only those fields. RLS and triggers already enforce this; test it with her role.

## Step 5: my money
- **Commissions** from `deal_commissions`:
  - owed now, pipeline, and paid this year;
  - per deal: expected / earned / paid / owed and status;
  - record a payment received (check photo, Zelle reference);
  - reminder when a commission has been earned and unpaid for 14 days.
- **Expenses** (receipt photo) and **Mileage** (from a deal, or a start/stop trip).
- **Year** from `rep_year_summary()`: net, plus a tax set-aside % setting, plus a CSV export.
- Commission plans editor under More → Partners.

## Step 6: polish
- Lead source report (`lead_source_stats`): leads, answered in 5 minutes, handed off, commission by source.
- Close-out: a review and referral request text after "paid in full" (from me, with the partner's review link).
- Export a deal ZIP.

Start with Step 0 and stop when the plan is written.
