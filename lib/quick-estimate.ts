import type { TakeoffInputs, TakeoffSettings } from "@/lib/estimating/takeoff";
import type { QuoteAssumptions } from "@/lib/estimating/pricing";

/** The phone "Measure" form uses feet for walls; the handoff takeoff wants inches. */
export type MeasureForm = {
  walls_ft: number[]; // counter runs along each wall, corner to end
  corners: number;
  openings_in: number[]; // range 30, fridge 36 … (no countertop)
  crown_lf: number;
  light_rail_lf: number;
  toe_kick_lf: number;
  scribe_lf: number;
  doors: number;
  drawers: number;
  led_ft: number;
  countertop_outlets: number;
  cabinet_lf: number;
};

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : d;
};

/** "10, 12 6" → [10, 12.5]: feet with optional inches after a space, or decimal feet. */
export function parseFeetList(input: string): number[] {
  return input
    .split(/[,;/+]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft)?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i);
      if (!m) return NaN;
      return Number(m[1]) + (m[2] ? Number(m[2]) / 12 : 0);
    })
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100);
}

export function parseInchList(input: string): number[] {
  return input
    .split(/[,;/+\s]+/)
    .map((x) => Number(x.replace(/[^\d.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 300);
}

export function takeoffFromForm(f: MeasureForm, base: Partial<TakeoffInputs>): TakeoffInputs {
  return {
    counter_runs_in: f.walls_ft.map((ft) => Math.round(ft * 12 * 10) / 10),
    counter_depth_in: num(base.counter_depth_in, 25.5),
    corners: Math.max(0, Math.round(f.corners)),
    openings_in: f.openings_in,
    crown_lf: f.crown_lf,
    light_rail_lf: f.light_rail_lf,
    toe_kick_lf: f.toe_kick_lf,
    scribe_lf: f.scribe_lf,
    doors: Math.round(f.doors),
    drawers: Math.round(f.drawers),
    led_ft: f.led_ft,
    led_watts_per_ft: num(base.led_watts_per_ft, 4),
    led_driver_w: Math.max(num(base.led_driver_w, 60), Math.ceil(f.led_ft * num(base.led_watts_per_ft, 4) * 1.2 / 20) * 20),
    countertop_outlets: Math.round(f.countertop_outlets),
    extra_cover_plates: num(base.extra_cover_plates, 1),
    cabinet_lf: f.cabinet_lf,
  };
}

export function formFromTakeoff(t: Partial<TakeoffInputs>): MeasureForm {
  return {
    walls_ft: (t.counter_runs_in ?? []).map((i) => Math.round((i / 12) * 100) / 100),
    corners: num(t.corners),
    openings_in: t.openings_in ?? [],
    crown_lf: num(t.crown_lf),
    light_rail_lf: num(t.light_rail_lf),
    toe_kick_lf: num(t.toe_kick_lf),
    scribe_lf: num(t.scribe_lf),
    doors: num(t.doors),
    drawers: num(t.drawers),
    led_ft: num(t.led_ft),
    countertop_outlets: num(t.countertop_outlets),
    cabinet_lf: num(t.cabinet_lf),
  };
}

/** Walls from a site visit → a first guess for the estimate (cabinets along every wall). */
export function measureFromWalls(walls: { ft: number }[], base: MeasureForm): MeasureForm {
  const ft = walls.map((w) => w.ft).filter((x) => x > 0);
  if (!ft.length) return base;
  const total = ft.reduce((a, b) => a + b, 0);
  return { ...base, walls_ft: ft, corners: Math.max(0, ft.length - 1), cabinet_lf: Math.round(total * 10) / 10 };
}

type SettingsRow = {
  trim_waste: number;
  trim_stick_ft: number;
  countertop_overage: number;
  hardware_spares: number;
  led_headroom: number;
} | null;

export function takeoffSettings(s: SettingsRow): TakeoffSettings {
  return {
    trimWaste: Number(s?.trim_waste ?? 0.15),
    trimStickFt: Number(s?.trim_stick_ft ?? 8),
    countertopOverage: Number(s?.countertop_overage ?? 0.05),
    hardwareSpares: Number(s?.hardware_spares ?? 2),
    ledHeadroom: Number(s?.led_headroom ?? 0.2),
  };
}

export function assumptions(q: {
  target_margin: number;
  contingency_rate: number;
  tax_rate: number;
  labor_rate_cents: number;
}): QuoteAssumptions {
  return {
    targetMargin: Number(q.target_margin),
    contingencyRate: Number(q.contingency_rate),
    taxRate: Number(q.tax_rate),
    laborRateCents: Number(q.labor_rate_cents),
  };
}
