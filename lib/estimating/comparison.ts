/**
 * Retailer comparison (Home Depot). Mirrors the quote_comparison_lines / _totals views.
 *
 * For each quote line with a matching retailer product:
 *   packs  = ceil(qty / pack size)            you can't buy part of a box
 *   cost   = round(packs × pack price × (1 + tax rate))
 * Lines with no retailer product (labor, quartz, subs, permits) are "not covered" and are
 * shown as such; they are never guessed. Adjustments are real retailer quotes/fees entered by hand.
 */
import { divRound, toBasisPoints } from "./pricing";

export interface ComparisonLineInput {
  qty: number;
  ourPriceCents: number;
  retailer?: {
    packQty: number;
    packPriceCents: number;
    verified: boolean;
    isSubstitute: boolean;
    checkedOn: string; // ISO date
  } | null;
}

export interface ComparisonResult {
  coveredLines: number;
  uncoveredLines: number;
  unverifiedLines: number;
  substituteLines: number;
  retailerMaterialsCents: number;
  ourPriceCoveredCents: number;
  adjustmentsCents: number;
  retailerTotalCents: number;
  oldestPriceDate: string | null;
}

export function packsNeeded(qty: number, packQty: number): number {
  const q = Math.round(qty * 100);
  const p = Math.round(packQty * 100);
  if (p <= 0) throw new RangeError("pack size must be > 0");
  return Math.ceil(q / p);
}

export function retailerLineCost(
  qty: number,
  packQty: number,
  packPriceCents: number,
  taxRate: number,
): number {
  return divRound(
    packsNeeded(qty, packQty) * packPriceCents * (10000 + toBasisPoints(taxRate)),
    10000,
  );
}

export function compareQuote(
  lines: ComparisonLineInput[],
  taxRate: number,
  adjustmentsCents = 0,
): ComparisonResult {
  const r: ComparisonResult = {
    coveredLines: 0,
    uncoveredLines: 0,
    unverifiedLines: 0,
    substituteLines: 0,
    retailerMaterialsCents: 0,
    ourPriceCoveredCents: 0,
    adjustmentsCents,
    retailerTotalCents: 0,
    oldestPriceDate: null,
  };
  for (const line of lines) {
    if (line.qty <= 0) continue;
    const rt = line.retailer;
    if (!rt) {
      r.uncoveredLines++;
      continue;
    }
    r.coveredLines++;
    if (!rt.verified) r.unverifiedLines++;
    if (rt.isSubstitute) r.substituteLines++;
    r.retailerMaterialsCents += retailerLineCost(line.qty, rt.packQty, rt.packPriceCents, taxRate);
    r.ourPriceCoveredCents += line.ourPriceCents;
    if (!r.oldestPriceDate || rt.checkedOn < r.oldestPriceDate) r.oldestPriceDate = rt.checkedOn;
  }
  r.retailerTotalCents = r.retailerMaterialsCents + adjustmentsCents;
  return r;
}

/** Days since the oldest retailer price was checked; the UI warns above ~30. */
export function priceAgeDays(oldest: string | null, today: string): number | null {
  if (!oldest) return null;
  return Math.round((Date.parse(today) - Date.parse(oldest)) / 864e5);
}
