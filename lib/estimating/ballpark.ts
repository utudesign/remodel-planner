/**
 * Phone ballpark: a price RANGE you can say at the kitchen table, before any design exists.
 *
 * Start from a template's lines (e.g. "10x10 L-shape - shaker + quartz") and resize it
 * with rough measurements:
 *   - lines tied to a takeoff key (countertop sq ft, trim, pulls, LED…) are recalculated
 *   - cabinet lines scale by (rough cabinet LF / template cabinet LF)
 *   - everything else (sink, plumber, permit…) stays as in the template
 * The middle is priced exactly like a real quote (pricing.ts); the range is
 * mid − low% (rounded down) to mid + high% (rounded up), to the nearest $500 by default.
 * It is never a commitment: the final price comes from Crystal's design + quote.
 */
import { quoteTotals, type LineInput, type QuoteAssumptions } from './pricing';
import { computeTakeoff, QTY_SOURCES, type QtySource, type TakeoffInputs, type TakeoffSettings } from './takeoff';

export interface BallparkLine extends LineInput {
  qtySource: string | null;
  /** true for cabinet boxes (category "Cabinets"); they scale with cabinet linear feet */
  scalesWithCabinets: boolean;
}

export interface BallparkSettings {
  lowPct: number;      // estimating_settings.ballpark_low_pct  (0.05)
  highPct: number;     // estimating_settings.ballpark_high_pct (0.15)
  roundToCents: number; // estimating_settings.ballpark_round_cents (50000 = $500)
}

export type RoughInputs = TakeoffInputs & { cabinet_lf: number };

export interface BallparkResult {
  lowCents: number;
  midCents: number;
  highCents: number;
  costCents: number;
  cabinetFactor: number;
  warnings: string[];
}

export function ballpark(
  templateLines: BallparkLine[],
  templateTakeoff: RoughInputs,
  rough: RoughInputs,
  assumptions: QuoteAssumptions,
  takeoffSettings: TakeoffSettings,
  settings: BallparkSettings,
): BallparkResult {
  if (!(templateTakeoff.cabinet_lf > 0)) throw new RangeError('Template is missing cabinet_lf in its default takeoff');
  if (!(rough.cabinet_lf >= 0)) throw new RangeError('Enter the cabinet length in feet');

  const takeoff = computeTakeoff(rough, takeoffSettings);
  const cabinetFactor = rough.cabinet_lf / templateTakeoff.cabinet_lf;
  const warnings = [...takeoff.warnings];
  if (cabinetFactor < 0.5 || cabinetFactor > 2) {
    warnings.push('This kitchen is far from the template size. Pick a closer template for a better range.');
  }

  const lines: LineInput[] = templateLines.map((line) => {
    if (line.qtySource) {
      if (!(QTY_SOURCES as readonly string[]).includes(line.qtySource)) {
        throw new Error(`Unknown qty_source "${line.qtySource}"`);
      }
      return { ...line, qty: takeoff.quantities[line.qtySource as QtySource] };
    }
    if (line.scalesWithCabinets) {
      return { ...line, qty: Math.round(line.qty * cabinetFactor * 100) / 100 };
    }
    return line;
  });

  const totals = quoteTotals(lines, assumptions);
  const mid = totals.totalPriceCents;
  const step = settings.roundToCents;
  const lowCents = Math.floor((mid * (1 - settings.lowPct)) / step) * step;
  const highCents = Math.ceil((mid * (1 + settings.highPct)) / step) * step;

  return { lowCents, midCents: mid, highCents, costCents: totals.totalCostCents, cabinetFactor, warnings };
}
