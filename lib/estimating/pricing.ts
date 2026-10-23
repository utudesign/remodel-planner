/**
 * Quote pricing. Mirrors the SQL views in 0002_estimating.sql exactly, cent for cent,
 * so the quote builder can show live totals before saving.
 *
 * Rules
 *   ext cost  = round(qty × unit cost)
 *   price     = round(ext cost / (1 − margin))      ← margin, never markup
 *   contingency cost = round(direct cost × contingency rate)
 *   tax cost         = round(taxable cost × tax rate)
 *   contingency + tax are priced at the quote's target margin
 *
 * All math runs on integers (cents, basis points, hundredths of qty) so there is
 * no floating-point drift. Postgres `round(numeric)` rounds half away from zero; so does divRound.
 */

export type CostCategory =
  | 'materials' | 'labor' | 'subcontractor' | 'permit' | 'delivery' | 'disposal' | 'other';

export interface QuoteAssumptions {
  /** 0.35 = 35%. Must be < 0.95. */
  targetMargin: number;
  contingencyRate: number;
  taxRate: number;
  laborRateCents: number;
}

export interface LineInput {
  qty: number;              // up to 2 decimals
  unitCostCents: number;    // integer
  usesLaborRate: boolean;
  marginOverride: number | null;
  taxable: boolean;
  sectionId?: string;
  costCategory?: CostCategory;
}

export interface PricedLine {
  effectiveUnitCostCents: number;
  extCostCents: number;
  effectiveMargin: number;
  priceCents: number;
  lineMargin: number;
}

export interface QuoteTotals {
  lineCount: number;
  directCostCents: number;
  taxableCostCents: number;
  linesPriceCents: number;
  contingencyCostCents: number;
  taxCostCents: number;
  contingencyPriceCents: number;
  taxPriceCents: number;
  totalCostCents: number;
  totalPriceCents: number;
  grossProfitCents: number;
  grossMargin: number;
  belowTarget: boolean;
}

/** Integer division rounded half away from zero (Postgres round(numeric) semantics). */
export function divRound(numerator: number, denominator: number): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
    throw new RangeError(`divRound needs safe integers and a non-zero denominator (${numerator}/${denominator})`);
  }
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const q = Math.floor(n / d);
  const r = n - q * d;
  return sign * (2 * r >= d ? q + 1 : q);
}

/** 0.3500 → 3500 basis points. Rates are stored as numeric(5,4). */
export function toBasisPoints(rate: number): number {
  const bp = Math.round(rate * 10000);
  if (bp < 0 || bp >= 10000) throw new RangeError(`rate out of range: ${rate}`);
  return bp;
}

/** qty is numeric(10,2) → hundredths. */
function toHundredths(qty: number): number {
  if (qty < 0) throw new RangeError(`qty must be >= 0 (got ${qty})`);
  return Math.round(qty * 100);
}

/** price = round(cost / (1 − margin)) */
export function priceFromCost(costCents: number, margin: number): number {
  const bp = toBasisPoints(margin);
  return divRound(costCents * 10000, 10000 - bp);
}

/** Markup that produces a given margin: 35% margin → 53.85% markup. */
export function marginToMarkup(margin: number): number {
  return margin / (1 - margin);
}

export function markupToMargin(markup: number): number {
  return markup / (1 + markup);
}

function ratio4(numerator: number, denominator: number): number {
  // round(x, 4) like the SQL views
  return denominator === 0 ? 0 : divRound(numerator * 10000, denominator) / 10000;
}

export function priceLine(line: LineInput, a: QuoteAssumptions): PricedLine {
  const effectiveUnitCostCents = line.usesLaborRate ? a.laborRateCents : line.unitCostCents;
  const extCostCents = divRound(toHundredths(line.qty) * effectiveUnitCostCents, 100);
  const effectiveMargin = line.marginOverride ?? a.targetMargin;
  const priceCents = priceFromCost(extCostCents, effectiveMargin);
  return {
    effectiveUnitCostCents,
    extCostCents,
    effectiveMargin,
    priceCents,
    lineMargin: extCostCents === 0 ? 0 : ratio4(priceCents - extCostCents, priceCents),
  };
}

export function quoteTotals(lines: LineInput[], a: QuoteAssumptions): QuoteTotals {
  let directCostCents = 0;
  let taxableCostCents = 0;
  let linesPriceCents = 0;
  for (const line of lines) {
    const p = priceLine(line, a);
    directCostCents += p.extCostCents;
    if (line.taxable) taxableCostCents += p.extCostCents;
    linesPriceCents += p.priceCents;
  }
  const contingencyCostCents = divRound(directCostCents * toBasisPoints(a.contingencyRate), 10000);
  const taxCostCents = divRound(taxableCostCents * toBasisPoints(a.taxRate), 10000);
  const contingencyPriceCents = priceFromCost(contingencyCostCents, a.targetMargin);
  const taxPriceCents = priceFromCost(taxCostCents, a.targetMargin);
  const totalCostCents = directCostCents + contingencyCostCents + taxCostCents;
  const totalPriceCents = linesPriceCents + contingencyPriceCents + taxPriceCents;
  const grossProfitCents = totalPriceCents - totalCostCents;
  const grossMargin = ratio4(grossProfitCents, totalPriceCents);
  return {
    lineCount: lines.length,
    directCostCents,
    taxableCostCents,
    linesPriceCents,
    contingencyCostCents,
    taxCostCents,
    contingencyPriceCents,
    taxPriceCents,
    totalCostCents,
    totalPriceCents,
    grossProfitCents,
    grossMargin,
    // same tolerance as the workbook check
    belowTarget: grossMargin < a.targetMargin - 0.0005,
  };
}

/**
 * Client-facing section totals. Lines with qty 0 are hidden; contingency + tax are folded
 * into the section flagged absorbs_project_costs (Installation by default).
 */
export function sectionTotals(
  lines: (LineInput & { sectionId: string })[],
  a: QuoteAssumptions,
  absorbingSectionId: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of lines) {
    if (line.qty <= 0) continue;
    out.set(line.sectionId, (out.get(line.sectionId) ?? 0) + priceLine(line, a).priceCents);
  }
  const t = quoteTotals(lines, a);
  out.set(absorbingSectionId, (out.get(absorbingSectionId) ?? 0) + t.contingencyPriceCents + t.taxPriceCents);
  return out;
}

/** Splits a total into installments by percent; the last one absorbs rounding so it always sums exactly. */
export function paymentSchedule(totalCents: number, percents: number[]): number[] {
  const bps = percents.map(toBasisPointsAllowFull);
  const sum = bps.reduce((s, b) => s + b, 0);
  if (sum !== 10000) throw new RangeError(`payment percents must add to 100% (got ${sum / 100}%)`);
  const amounts = bps.map((b) => divRound(totalCents * b, 10000));
  amounts[amounts.length - 1] = totalCents - amounts.slice(0, -1).reduce((s, x) => s + x, 0);
  return amounts;
}

function toBasisPointsAllowFull(rate: number): number {
  const bp = Math.round(rate * 10000);
  if (bp < 0 || bp > 10000) throw new RangeError(`percent out of range: ${rate}`);
  return bp;
}

export const formatUsd = (cents: number): string =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
