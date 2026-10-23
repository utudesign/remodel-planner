# Quick estimate, price lists & Home Depot comparison: spec addendum

A real, itemized estimate from a phone in about two minutes, priced from three sources: **the vendor price list** (cabinets), **NoVA market prices** (quartz), and **Home Depot shelf prices** (small parts). It also shows the customer an honest, dated comparison with buying the same materials at Home Depot.

Research behind every number: `docs/research/Kitchen remodel price research.md` (Oct 23, 2026).

---

## 1. The quick estimate (Tugu, phone, at the kitchen table)

| Step | Tap | What happens (server action) |
|---|---|---|
| 1 | Pick layout template | `create_quote_from_template(lead, template, 'Quick estimate')` |
| 2 | Pick door color | `set_quote_collection(quote, color group)`: every cabinet, filler and trim line is re-priced from the vendor list. Missing codes are listed, never silently dropped |
| 3 | Pick quartz level 1–4 | `swap_line_item(quartz line, QZ1…QZ4)` |
| 4 | Rough sizes + options | Takeoff form → `computeTakeoff()` → `applyTakeoff()` (counter sq ft, trim sticks, pulls, LED, outlets) |
| 5 | See the result | Big total + ballpark range + section totals + **Home Depot comparison card**. Save → it's a normal draft quote Crystal refines |

Live preview before saving uses `quoteTotals()` / `ballpark()` / `compareQuote()` in the browser. Saved numbers always come from the SQL views.

Tested example (sample labor/subs, TimberPeak group 1 cabinets at real cost, Level 3 quartz): **$20,896.43**, 34.2% margin. Switching to group 4 (CWO) re-prices the same 22 cabinet/trim lines from $3,076.87 to $6,524.56 cost.

## 2. Where every price comes from

`catalog_items.price_source` + `source_url` + `source_checked_on` show it on every line in the price book and the builder.

| Source | Used for | Cost | Sell price | Count in seed |
|---|---|---|---|---|
| `vendor_list` | Cabinets, fillers, trim, accessories | MSRP × multiplier (TimberPeak 0.33) | margin on cost | 1,116 (4 groups × 279) after import |
| `market` | Quartz levels, edges, cutouts | **Placeholder (70% of price): enter your fabricator's price** | fixed market price | 6 |
| `home_depot` | Small parts you buy at HD | HD shelf price, read Oct 23, 2026 | margin on cost | 38 |
| `sample` | Labor, subs, haul-away, a few unpriced parts; plus 22 generic cabinet codes the vendor list replaces | placeholder | margin on cost | 42 (20 after the vendor list) |
| `supplier_quote` | Anything priced from a real quote | as quoted | either | 0 |

**Stale-price badge:** items whose `source_checked_on` is older than `estimating_settings.cost_stale_days` (90) get an amber badge; `sample` items get a red one. The admin clears these in the monthly price check (§6).

### Quartz levels (fixed sell prices, NoVA Oct 2026)

| Code | Level | Sell $/sq ft | Market range | Basis |
|---|---|---|---|---|
| QZ1 | Entry / promo colors | $65 | $55–75 | Local promo packages (Chantilly) |
| QZ2 | Mid: Silestone, MSI | **$80** (template default) | $70–90 | Local remodeler guide, Oct 2026 |
| QZ3 | Premium: Caesarstone | $100 | $90–110 | Local remodeler guide, Oct 2026 |
| QZ4 | Designer: Cambria, heavy veining | $130 | $110–150+ | Extrapolated; confirm with 2–3 quotes |

Included in the sq ft price: 3 cm slab, eased edge, one undermount sink cutout, faucet holes, tear-out. Extras: upgraded edge $30/LF ($10–60), extra cutout $100 ($75–300), 4" quartz splash $30/LF (estimate; confirm).
**Tariff:** a quota-based safeguard tariff on imported quartz started Aug 15, 2026 (25% in-quota / 50% over-quota in year 1). Most local promo prices predate it. Re-check imported colors with the fabricator before honoring old prices.

## 3. Vendor price list import (Settings → Price lists, owners + team)

1. Upload the vendor's .xlsx (parse in the browser with ExcelJS or SheetJS → rows per sheet).
2. Enter vendor name, **cost multiplier** (0.33), effective date.
3. `parsePriceList()` shows a preview: color groups, item counts, categories, and **warnings to clear with the vendor**:

| Warning | TimberPeak Oct 2026 |
|---|---|
| `likely_typo` (> 60% off the group's pattern) | **Group 3 light rail LRM8: $51.06 vs ~$209 expected** |
| `color_mismatch` | Group 3 header says DBG, color column says DCB |
| `off_pattern` (3–60% off) | 88: full-height bases and 24"-deep walls run +6–12% instead of +10/15%; skin panels 45% cheaper in groups 2–3; CWO fillers ×2.5, moldings ×3 |
| `skipped_sample` | SD, MINI (door/mini-base samples) |

4. Confirm → `import_price_list()` upserts by (color group, code); items missing from the new list are deactivated, never deleted (old quotes keep their copied costs).
5. Re-importing next year's list is the same flow.

Dev seed: `scripts/price-list-to-sql.ts` generates `supabase/seed/timberpeak_msrp_2026.sql` from `supabase/seed/timberpeak-msrp-sheets.json`.

## 4. Home Depot comparison

### What it computes
For each quote line, the matching Home Depot product (same item, or **closest Hampton Bay Shaker Satin White** equivalent for vendor cabinet codes), whole packs (`ceil(qty / pack)`), plus sales tax at the quote's rate. Lines with no Home Depot product (quartz, labor, subs, permits, a few parts) are listed as **not covered**, never estimated.

Tested on the 10x10: Hampton Bay cabinet package **$4,033.55** before tax (matches the research report); 57 of 79 lines covered; materials at HD **$6,176.89** with tax vs **$7,291.87** for the same lines in our price.

### Customer-facing card (quote preview / phone)

```
Buying the same materials at Home Depot          prices from homedepot.com, Oct 23, 2026
  Cabinets & trim (Hampton Bay Shaker, closest)   $4,275.55
  Sink, faucet, plumbing & electrical parts       $1,901.34
  Materials total                                  $6,176.89
  Not included at Home Depot: countertops, installation, plumber, electrician, permit
  → Home Depot quotes these after a $129 in-home measure.
Our price includes design, all materials above, quartz, licensed install, and cleanup: $20,896
3 items are the closest available substitute (e.g. 24" drawer base for our 21").
```

### What we can and can't say (enforced by the UI copy)
| Can say | Can't say |
|---|---|
| Dated, linked HD prices for the listed products | "X% cheaper than Home Depot" |
| "Closest Hampton Bay equivalent", with substitutes marked | Any Home Depot **installed** total, unless an actual HD quote was entered |
| HD quotes install and countertops after a $129 in-home measure (credited) | Quality claims about Hampton Bay boxes |
| An actual HD quote the customer got, entered as an adjustment | Card-signup discounts or other brands' promos as if they applied |

The comparison source's `disclaimer` text prints under every comparison. Price age shows in days; > 30 days → "prices may have changed" and the admin gets a refresh task.

### Installed-to-installed comparison
Get one real Home Depot kitchen quote in a NoVA ZIP (book the $129 measure once), enter it as a `comparison_adjustments` row with the PDF attached. Until then the app compares **materials only**.

## 5. Company profile (Settings → Company)

From renodesigninc.com; owners can edit.

| Field | Value |
|---|---|
| Name | RenoDesign Inc. |
| Tagline | Thoughtfully Designed. Beautifully Built. |
| Address | 4115 Pleasant Valley Rd, Suite 800A, Chantilly, VA 20151 |
| Phone | (202) 740-9393 |
| Hours | Mon–Sat 8:00 AM–6:00 PM; Sun closed (default business hours for routing + visit slots) |
| Badges | Houzz Certified, Angi Approved, 5-star Google |
| Financing | "Financing available" (terms TBD) |
| **DPOR license # + class** | **Missing on the website; required field before a quote can be sent** |
| Fairfax HIC license # | If Class C |

Client-facing stages use the website's 4-step process: **1. Consultation & preliminary drawing** (sales stages 1–4 + site visit) → **2. Design proposal, estimate & contract** (stages 5–7) → **3. Construction & on-site management** (delivery milestones 2–7) → **4. Final walkthrough** (milestones 8–10).

## 6. Admin: monthly price check (command center task, 1st business day)

1. Price book → filter **sample** and **stale (> 90 days)** → update from supplier quotes.
2. Comparison prices → sort by `checked_on` → open each URL, update price + date (about 60 products; ~45 minutes).
3. Quartz: ask the fabricator for current dealer prices per level → update QZ costs (and sell prices if the market moved).
4. Post "Prices checked" in the activity feed with the count changed.

Automating step 2 (a product-data API) is possible later; scraping homedepot.com directly is not, since the site blocks it and its terms forbid it.

## 7. Data model + functions added (in 0002/0003)

```
price_lists            vendor, name, cost_multiplier, effective_date, source_file
catalog_collections    price_list_id, name, colors[]                       -- color groups
catalog_items         += collection_id, list_price_cents, pricing_mode ('margin'|'fixed'),
                         unit_price_cents, price_source, source_url, source_checked_on
quote_line_items      += pricing_mode, unit_price_cents, list_price_cents, collection_id
quotes                += collection_id
comparison_sources     name, disclaimer
comparison_prices      catalog_item_id | match_code, product_name, sku, url, pack_qty,
                       pack_price_cents, is_substitute, verified, checked_on, notes
comparison_adjustments quote_id?, label, amount_cents, verified, url, checked_on
views                  quote_comparison_lines, quote_comparison_totals
functions              import_price_list(), set_quote_collection(), swap_line_item()
TS                     vendorImport.ts, comparison.ts (+ pricing fixed mode)
```
