# Prompt: deals, deal numbers, and the deal jacket

Paste into Claude Code from the repo root. The deal numbering must be in place from Phase 1, so run Steps 0–2 during Phase 1 and the rest as each tab's data arrives (estimates in Phase 3, money in Phase 4).

---

Build the **deal jacket** described in `docs/DEALS.md`. In this app **everything is a deal**: one record per customer job from first contact to final payment, with a permanent deal number and one screen ("jacket") holding its estimator, photos, files and financials, like a car deal jacket.

These files are already in the repo and tested; use them, don't rewrite them:
- `supabase/migrations/0004_deal_jacket.sql`: deal numbers (trigger + `next_deal_number()`), `deal_files`, `document_requirements`, `deal_jacket_checklist` and `deal_recap` views, order/close gates, storage bucket + policies, `seed_default_deal_jacket()`
- `lib/deals/dealNumber.ts` + tests: year rule, deal + document numbers, parse/label, file names, storage paths

## Deal number rules (do not change without asking me)
- `YY-NNNN`: year + that year's count from 1001 (`26-1001`, `26-1002` … `27-1001`), company time zone. Show it as `#26-1047`.
- Documents extend it: `26-1047-E2`, `-CO1`, `-R3`, `-PO1`, `-INV1`, `-W1` from `next_deal_doc_number(deal, kind)`. Put them on every PDF, receipt, PO and email subject.
- Opened date lives in `opened_on`, job type is a badge; neither is encoded in the number.
- Assigned only by the database; never edited, never reused (soft delete).

## Step 0 — Reconcile, then stop
1. Our data model calls the record `deals` (not `leads`); `projects.deal_id` is unique. Check that 0001 matches CONTEXT §5 and DEALS §7, including `site_visits`, `payments`, `change_orders`, `costs`, `tasks`, `companies.timezone`.
2. List anything in 0001/0002 that conflicts with 0004 and the exact fix. STOP for my approval.

## Step 1 — Numbers everywhere
- Apply 0004. Call `seed_default_deal_jacket(company)` in onboarding and `supabase/seed.sql`.
- Show `#number` on every deal card, header, notification, quote, PDF and file name. Search accepts `26-1047`, `#26-1047`, `261047`, `1047` (this year) and document numbers like `26-1047-CO2` (`parseDealNumber()`).
- Test: 50 deals created at the same instant get 50 consecutive numbers; 11:30 PM ET on Dec 31 belongs to the old year.

## Step 2 — Deal jacket shell (phone first, 375 px)
- Route `/deals/[number]` (e.g. `/deals/26-1047`). Sticky header: #number, name, address, stage, owner/PM avatars, **Call · Text · Navigate · Log**, checklist badge.
- Tabs: **Overview · Estimates · Photos · Files · Money · Tasks · Activity**. Hide Estimates and Money and money files from crew (RLS already enforces it; the UI must not even show the tabs).
- Floating **+**: New deal · Quick estimate · Take photos · Log call · Record payment.

## Step 3 — Photos (the most-used tab)
- Camera button with multi-shot (`accept="image/*" capture="environment" multiple`), tag chips, grid grouped by tag or date, full-screen swipe viewer.
- In the browser: EXIF time → `taken_at`, strip GPS, resize to 2560 px JPEG (~0.82) + 400 px thumbnail; ask me before adding a HEIC library.
- Upload with a signed upload URL to `dealStoragePath()`, then insert `deal_files`. **Offline queue in IndexedDB** with progress + retry; a photo leaves the queue only after its row exists.
- Site visit photos (FIELD-AND-OFFICE §4) are deal files with `site_visit_id`; the visit's required-photo checklist ticks from tags.
- Crew can add progress/issue photos on assigned deals only.

## Step 4 — Files + checklist
- Folder list with counts; upload, preview PDFs/images, phone document scan → PDF; soft delete only (owners/team), with who/when.
- Jacket checklist by gate from `deal_jacket_checklist`; each missing item has an **Add** button that uploads straight into the right folder with `requirement_id`.
- When the database refuses an order or close (`Deal jacket is missing before ordering: …`), show the missing items as a checklist with Add buttons, not a raw error.

## Step 5 — Estimates tab
- Quick estimate button (docs/QUICK-ESTIMATE.md §1), quote versions with status, ballpark history from site visits, Home Depot comparison card, client quote link. Approved quote PDFs are saved into the `estimates` folder automatically.

## Step 6 — Money tab (deal recap)
- From `deal_recap`: contract, change orders (pending count), revenue, collected, balance due, overdue, estimated vs actual cost, estimated + actual profit, margin. Payments list: record a check in 3 taps with a photo (saved to `payments`, can satisfy the deposit/final payment requirement). Costs by vendor with estimated vs actual.
- "Print recap" → one-page PDF like a car deal recap.

## Step 7 — Export jacket
- Owners/team: `Export` → ZIP streamed from a server route: every non-deleted file in its folder + recap PDF + approved quote PDF, named `26-1047 <customer> <scope>.zip` (`dealFileName()`).

## Rules
- Phone first: 44 px targets, one-handed camera flow, works on spotty signal.
- Never show money to crew; never hard-delete files; signed URLs only (bucket is private).
- Vitest for anything new in `lib/`; Playwright smoke test on a 375 px viewport: create deal → number shows → take 2 photos (mocked camera) → upload contract via checklist → order gate passes.
- Lint, typecheck, test, build green after each step; commit per step; tell me how to test it on my phone.
