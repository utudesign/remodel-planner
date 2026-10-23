# Deals & the deal jacket: spec addendum to CONTEXT.md

**Everything is a deal.** One record per customer job from the first call to the final payment, with a permanent number and one "jacket" holding the estimates, photos, files and money, like a car deal jacket.

Code: `supabase/migrations/0004_deal_jacket.sql` (tested), `lib/deals/dealNumber.ts` (tested).

---

## 1. Deal numbers

| Rule | Detail |
|---|---|
| Format | **`YY-NNNN`**: year + that year's count, starting at **1001**. First deal of 2026 = `26-1001`, next `26-1002`; first of 2027 = `27-1001` |
| Why this shape | Easy to say on the phone ("twenty-six ten forty-seven"); the year is in the number, so old deals never get confused; it sorts correctly as text; it doesn't change with the day a deal was opened; starting at 1001 means the first customer doesn't see "#1" |
| Which year | Company time zone (Eastern): a deal opened 11:30 PM Dec 31 is still last year's |
| Start | `companies.deal_number_start` (default 1001), owner setting; applies from the next new year's series |
| Opened date | Stored separately in `opened_on` (shown on the card), not encoded in the number |
| Documents | Every document inside a deal extends the number: **`26-1047-E2`** estimate v2, **`-CO1`** change order, **`-R3`** payment receipt, **`-PO1`** supplier purchase order, **`-INV1`** invoice, **`-W1`** warranty claim (`next_deal_doc_number()`). A check, a PDF or a supplier email with that number always finds its deal |
| Job type | Shown as a badge (Kitchen, Bath, Cabinets only, …), not encoded in the number, because scope changes during a sale |
| Assigned | Automatically by the database when the deal is created (`deals_number` trigger → `next_deal_number()`). Two deals opened at the same moment never get the same number |
| Permanent | Can't be edited (trigger) and is never reused: deals are soft-deleted (`deleted_at`) |
| Search | Typing `26-1047`, `#26-1047`, `261047`, `26 1047`, `1047` (this year) or a document number `26-1047-CO2` finds the deal (`parseDealNumber()`) |

## 2. Lifecycle (one deal, three views)

| Client sees (website's 4 steps) | Deal stage (team) | Segment in Deals tab |
|---|---|---|
| 1. Consultation & preliminary drawing | New → Contacted → Visit booked → Visit done | In sales |
| 2. Design proposal, estimate & contract | Design/quote sent → Approved → Deposit received | In sales |
| 3. Construction & on-site management | Ordered → Delivered → Started → Mid-check → Install complete | In progress |
| 4. Final walkthrough | Final inspection → Final payment → Closed | In progress → Closed |

`projects` stays as the delivery half of a deal (`projects.deal_id` unique), created automatically at deposit. The UI only ever says "deal".

## 3. The deal jacket screen

Header (always visible): **#26-1047**, customer name, address, stage chip, owner + PM avatars, big **Call · Text · Navigate · Log** buttons, jacket checklist badge (e.g. "Order: 2 of 3").

| Tab | What's in it | Who sees it |
|---|---|---|
| **Overview** | Stage, key dates, next step, scope summary, site visit summary, jacket checklist by gate, value + balance due (owners/team) | Everyone on the deal (no money for crew) |
| **Estimates** | **Quick estimate** button, quote versions (draft/sent/approved), ballpark history from site visits, Home Depot comparison, client quote link | Owners + team |
| **Photos** | Camera button (multi-shot), tag chips (before, measurement, sketch, appliance label, under sink, panel, delivery, progress, issue, after), grouped by tag or by date; full-screen swipe viewer; site visit photos land here automatically | Owners + team; crew sees + adds on assigned deals |
| **Files** | Folders: estimates, design, contract, permits, invoices & receipts, payments, change orders, warranty, other. Upload, phone document scan → PDF, preview. Checklist items have an **Add** button that files straight into the right folder | Owners + team; crew sees design, permits, warranty only |
| **Money** | **Deal recap**: contract, change orders, revenue, payments (due/received/overdue, record a check with a photo → payments folder), costs estimated vs actual by vendor, estimated and actual profit + margin. Print/export recap PDF | Owners + team |
| **Tasks** | Milestones + tasks + punch list | Everyone on the deal |
| **Activity** | Timeline (calls, texts, stage changes, uploads, payments) + comments with @mentions | Everyone on the deal (money events hidden from crew) |

**Export jacket** (owners/team): one ZIP with every file in its folder + recap PDF + approved quote PDF, named `26-1047 Lee kitchen.zip`.

## 4. Photos: capture pipeline (phone first)

1. `<input type="file" accept="image/*" capture="environment" multiple>` from the jacket, the site visit form, or the floating **+ Take photos**. Pick a tag before or after shooting.
2. In the browser: read EXIF capture time → `taken_at`; **drop GPS** (privacy); resize to 2560 px long edge, JPEG quality ~0.82; 400 px thumbnail. iPhone HEIC: Safari normally hands over JPEG; if a HEIC arrives, convert (ask before adding a library).
3. Upload straight to Supabase Storage with a signed upload URL to `{company}/{year}/{deal number}/photos/{uuid}-{name}.jpg` (`dealStoragePath()`), then insert the `deal_files` row.
4. **Offline-safe:** photos wait in an IndexedDB queue with progress, retry automatically, and leave the queue only after the `deal_files` row exists. Never lose a photo taken at a job site.
5. Site visit required-photo checklist (FIELD-AND-OFFICE §4) ticks itself from tagged photos.

Files (PDF, images, office docs) up to 25 MB; same path rule with their folder.

## 5. Jacket checklist + gates (owner-editable defaults)

| Gate | Required document | Folder | Enforced |
|---|---|---|---|
| Before order | Signed contract | contract | **Database: can't set the order date** |
| Before order | Approved design + cabinet list (signed) | design | ″ |
| Before order | Deposit received (check photo / receipt) | payments | ″ |
| Before order | Appliance spec sheets (optional) | other | warning |
| Before start | Permit issued (only if the deal needs a permit) | permits | app warning |
| Before start | Before photos | photos | app warning |
| Before close | Final payment received | payments | **Database: can't close** |
| Before close | Completion sign-off by client | contract | ″ |
| Before close | After photos | photos | ″ |
| Before close | Final inspection passed (if permit) | permits | ″ |
| Before close | Sub invoices + lien waivers (optional) | invoices & receipts | warning |
| Before close | Warranty letter sent (optional) | warranty | warning |

A file satisfies a requirement when it's uploaded through that checklist item (`deal_files.requirement_id`). Closing still also needs CONTEXT §3's rule (balance $0, punch list clear, costs entered).

## 6. Access (RLS + storage policies, tested)

| | Owners + team | Crew on the deal | Crew not on the deal |
|---|---|---|---|
| Photos | read + add | read + add | — |
| Design, permits, warranty | read + add | read | — |
| Estimates, contract, payments, invoices, change orders | read + add | — | — |
| Delete | soft delete only (`deleted_at`), files stay in storage | — | — |
| Deal recap / money | yes | — | — |

Storage bucket `deal-files` is private; files are served with short-lived signed URLs.

## 7. Data model + functions (0004)

```
deals += deal_year, deal_seq, deal_number, opened_on, permit_required, deleted_at
companies += deal_number_start (default 1001)
deal_number_counters (company_id, deal_year, last_seq)        -- only next_deal_number() touches it
deal_doc_counters (deal_id, kind, last_n)                     -- only next_deal_doc_number() touches it
deal_files    deal_id, folder, photo_tag, title, storage_path, mime_type, size_bytes, width, height,
              taken_at, site_visit_id, quote_id, requirement_id, crew_visible, uploaded_by,
              created_at, deleted_at, deleted_by
document_requirements  gate, folder, label, required, applies_when ('always'|'permit_required')
views         deal_jacket_checklist, deal_recap
functions     next_deal_number(), next_deal_doc_number(deal, kind), deal_gate_missing(), is_assigned_to_deal(), seed_default_deal_jacket()
triggers      deals_number, deals_number_guard, deal_files_insert/update, projects_jacket_gates
storage       bucket 'deal-files' + read/insert policies
TS            lib/deals/dealNumber.ts: dealYearAt, formatDealNumber, formatDocNumber, parseDealNumber,
              dealLabel, dealFileName, dealStoragePath, DOC_KINDS
```
