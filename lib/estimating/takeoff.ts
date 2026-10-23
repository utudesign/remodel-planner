/**
 * Takeoff calculators: turn site measurements into order quantities.
 * Outputs are keyed by qty_source; quote lines with a matching qty_source get their qty
 * replaced when the takeoff is saved. Keep QTY_SOURCES in sync with the CHECK constraint
 * on catalog_items.qty_source in 0002_estimating.sql.
 */

export const QTY_SOURCES = [
  "countertop_sqft",
  "crown_sticks",
  "light_rail_sticks",
  "toe_kick_sticks",
  "scribe_sticks",
  "door_pulls",
  "drawer_pulls",
  "led_ft",
  "countertop_outlets",
  "cover_plates",
] as const;
export type QtySource = (typeof QTY_SOURCES)[number];

/** Stored as quotes.takeoff (jsonb). Inches for lengths along the counter, feet for trim. */
export interface TakeoffInputs {
  counter_runs_in: number[]; // each counter run measured along the wall, corner to end
  counter_depth_in: number; // 25.5 = 24" base + 1.5" overhang
  corners: number; // inside corners where two runs overlap
  openings_in: number[]; // range, fridge or other gaps with no countertop
  crown_lf: number;
  light_rail_lf: number;
  toe_kick_lf: number;
  scribe_lf: number;
  doors: number;
  drawers: number;
  led_ft: number;
  led_watts_per_ft: number;
  led_driver_w: number;
  countertop_outlets: number;
  extra_cover_plates: number; // e.g. the outlet inside the microwave cabinet
  cabinet_lf?: number; // base + wall cabinet run in feet; used only by the phone ballpark
}

/** From estimating_settings. */
export interface TakeoffSettings {
  trimWaste: number; // 0.15
  trimStickFt: number; // 8
  countertopOverage: number; // 0.05
  hardwareSpares: number; // 2
  ledHeadroom: number; // 0.20
}

export interface TakeoffResult {
  quantities: Record<QtySource, number>;
  measuredCountertopSqft: number;
  ledLoadW: number;
  minDriverW: number;
  warnings: string[];
}

// Excel ROUNDUP-style ceiling that ignores float noise (35.0000000001 → 35, not 36).
const ceil = (x: number) => Math.ceil(x - 1e-9);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

export function trimSticks(linearFeet: number, s: TakeoffSettings): number {
  if (linearFeet <= 0) return 0;
  return ceil((linearFeet * (1 + s.trimWaste)) / s.trimStickFt);
}

/** (Σ runs − corners × depth − Σ openings) × depth / 144 */
export function countertopSqft(
  t: Pick<TakeoffInputs, "counter_runs_in" | "counter_depth_in" | "corners" | "openings_in">,
): number {
  const netLengthIn = sum(t.counter_runs_in) - t.corners * t.counter_depth_in - sum(t.openings_in);
  return Math.max(0, (netLengthIn * t.counter_depth_in) / 144);
}

export function computeTakeoff(t: TakeoffInputs, s: TakeoffSettings): TakeoffResult {
  const warnings: string[] = [];
  const measuredCountertopSqft = countertopSqft(t);
  const ledLoadW = t.led_ft * t.led_watts_per_ft;
  const minDriverW = ledLoadW * (1 + s.ledHeadroom);

  if (t.led_ft > 0 && t.led_driver_w < minDriverW) {
    warnings.push(
      `LED driver ${t.led_driver_w} W is too small: needs at least ${minDriverW.toFixed(1)} W.`,
    );
  }
  if (t.counter_depth_in < 24) {
    warnings.push(`Counter depth ${t.counter_depth_in}" is less than a 24" base cabinet.`);
  }
  if (t.countertop_outlets === 0 && measuredCountertopSqft > 0) {
    warnings.push("No countertop outlets entered. Code requires receptacles along the counter.");
  }

  const quantities: Record<QtySource, number> = {
    countertop_sqft: ceil(measuredCountertopSqft * (1 + s.countertopOverage)),
    crown_sticks: trimSticks(t.crown_lf, s),
    light_rail_sticks: trimSticks(t.light_rail_lf, s),
    toe_kick_sticks: trimSticks(t.toe_kick_lf, s),
    scribe_sticks: trimSticks(t.scribe_lf, s),
    door_pulls: t.doors > 0 ? t.doors + s.hardwareSpares : 0,
    drawer_pulls: t.drawers > 0 ? t.drawers + s.hardwareSpares : 0,
    led_ft: t.led_ft,
    countertop_outlets: t.countertop_outlets,
    cover_plates: t.countertop_outlets + t.extra_cover_plates,
  };
  return { quantities, measuredCountertopSqft, ledLoadW, minDriverW, warnings };
}

/**
 * Returns the lines whose qty must change. Lines without a qty_source are left alone,
 * so a hand-typed qty is never overwritten.
 */
export function applyTakeoff<T extends { id: string; qty: number; qtySource: string | null }>(
  lines: T[],
  result: TakeoffResult,
): { id: string; qty: number }[] {
  const changes: { id: string; qty: number }[] = [];
  for (const line of lines) {
    if (!line.qtySource) continue;
    if (!(QTY_SOURCES as readonly string[]).includes(line.qtySource)) {
      throw new Error(`Unknown qty_source "${line.qtySource}" on line ${line.id}`);
    }
    const qty = result.quantities[line.qtySource as QtySource];
    if (qty !== line.qty) changes.push({ id: line.id, qty });
  }
  return changes;
}
