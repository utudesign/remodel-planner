import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ten-by-ten-template.json";
import { ballpark, type BallparkLine, type BallparkSettings, type RoughInputs } from "../ballpark";
import type { QuoteAssumptions } from "../pricing";
import type { TakeoffSettings } from "../takeoff";

const a = fixture.assumptions as QuoteAssumptions;
const lines = fixture.lines as BallparkLine[];
const template = fixture.takeoff as RoughInputs;
const ts: TakeoffSettings = {
  trimWaste: 0.15,
  trimStickFt: 8,
  countertopOverage: 0.05,
  hardwareSpares: 2,
  ledHeadroom: 0.2,
};
const bs: BallparkSettings = { lowPct: 0.05, highPct: 0.15, roundToCents: 50000 };

describe("ballpark", () => {
  it("at the template size, the middle equals the real quote price from Postgres", () => {
    const r = ballpark(lines, template, template, a, ts, bs);
    expect(r.midCents).toBe(fixture.expectedTotalPriceCents);
    expect(r.cabinetFactor).toBe(1);
    expect(r.warnings).toEqual([]);
  });

  it("gives a rounded range around the middle ($500 steps)", () => {
    const r = ballpark(lines, template, template, a, ts, bs);
    expect(r.lowCents % 50000).toBe(0);
    expect(r.highCents % 50000).toBe(0);
    expect(r.lowCents).toBeLessThanOrEqual(r.midCents * 0.95);
    expect(r.highCents).toBeGreaterThanOrEqual(r.midCents * 1.15);
    // 10x10 at sample costs: about $24.1K → say "$22,500 to $28,000"
    expect([r.lowCents, r.highCents]).toEqual([2250000, 2800000]);
  });

  it("a bigger kitchen costs more: more cabinets, more counter, more trim", () => {
    const bigger: RoughInputs = {
      ...template,
      cabinet_lf: 38,
      counter_runs_in: [144, 132],
      crown_lf: 30,
      light_rail_lf: 18,
      toe_kick_lf: 18,
      doors: 24,
      drawers: 8,
    };
    const base = ballpark(lines, template, template, a, ts, bs);
    const big = ballpark(lines, template, bigger, a, ts, bs);
    expect(big.cabinetFactor).toBeCloseTo(38 / 29.5, 6);
    expect(big.midCents).toBeGreaterThan(base.midCents);
  });

  it("dropping LED lighting and crown lowers the price", () => {
    const base = ballpark(lines, template, template, a, ts, bs);
    const plain = ballpark(lines, template, { ...template, led_ft: 0, crown_lf: 0 }, a, ts, bs);
    expect(plain.midCents).toBeLessThan(base.midCents);
  });

  it("warns when the kitchen is far from the template size", () => {
    const r = ballpark(lines, template, { ...template, cabinet_lf: 70 }, a, ts, bs);
    expect(r.warnings.some((w) => w.includes("closer template"))).toBe(true);
  });

  it("refuses a template without cabinet_lf", () => {
    expect(() => ballpark(lines, { ...template, cabinet_lf: 0 }, template, a, ts, bs)).toThrow();
  });
});
