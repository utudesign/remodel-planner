import { describe, expect, it } from "vitest";
import {
  applyTakeoff,
  computeTakeoff,
  countertopSqft,
  trimSticks,
  type TakeoffInputs,
  type TakeoffSettings,
} from "../takeoff";

const settings: TakeoffSettings = {
  trimWaste: 0.15,
  trimStickFt: 8,
  countertopOverage: 0.05,
  hardwareSpares: 2,
  ledHeadroom: 0.2,
};

// Same defaults as the "10x10 L-shape - shaker + quartz" template and the estimate workbook.
const tenByTen: TakeoffInputs = {
  counter_runs_in: [120, 120],
  counter_depth_in: 25.5,
  corners: 1,
  openings_in: [30],
  crown_lf: 22,
  light_rail_lf: 14,
  toe_kick_lf: 14,
  scribe_lf: 12,
  doors: 19,
  drawers: 6,
  led_ft: 12,
  led_watts_per_ft: 4,
  led_driver_w: 60,
  countertop_outlets: 5,
  extra_cover_plates: 1,
};

describe("computeTakeoff: 10x10 matches the workbook Takeoff tab", () => {
  const r = computeTakeoff(tenByTen, settings);
  it("countertop", () => {
    expect(r.measuredCountertopSqft).toBeCloseTo(32.67, 2);
    expect(r.quantities.countertop_sqft).toBe(35);
  });
  it("trim sticks", () => {
    expect(r.quantities.crown_sticks).toBe(4);
    expect(r.quantities.light_rail_sticks).toBe(3);
    expect(r.quantities.toe_kick_sticks).toBe(3);
    expect(r.quantities.scribe_sticks).toBe(2);
  });
  it("hardware with spares", () => {
    expect(r.quantities.door_pulls).toBe(21);
    expect(r.quantities.drawer_pulls).toBe(8);
  });
  it("LED and electrical", () => {
    expect(r.ledLoadW).toBe(48);
    expect(r.minDriverW).toBeCloseTo(57.6, 5);
    expect(r.quantities.led_ft).toBe(12);
    expect(r.quantities.cover_plates).toBe(6);
    expect(r.warnings).toEqual([]);
  });
});

describe("edge cases", () => {
  it("warns when the LED driver is too small", () => {
    const r = computeTakeoff({ ...tenByTen, led_driver_w: 40 }, settings);
    expect(r.warnings.some((w) => w.includes("too small"))).toBe(true);
  });
  it("does not round an exact multiple up a whole stick", () => {
    // 8 ft at 0% waste is exactly one stick
    expect(trimSticks(8, { ...settings, trimWaste: 0 })).toBe(1);
    expect(trimSticks(0, settings)).toBe(0);
  });
  it("never returns negative countertop area", () => {
    expect(
      countertopSqft({
        counter_runs_in: [20],
        counter_depth_in: 25.5,
        corners: 1,
        openings_in: [0],
      }),
    ).toBe(0);
  });
  it("no pulls ordered when there are no doors", () => {
    expect(computeTakeoff({ ...tenByTen, doors: 0 }, settings).quantities.door_pulls).toBe(0);
  });
});

describe("applyTakeoff", () => {
  const r = computeTakeoff({ ...tenByTen, crown_lf: 30 }, settings);
  it("updates only lines tied to a takeoff key, and only when the qty changed", () => {
    const changes = applyTakeoff(
      [
        { id: "crown", qty: 4, qtySource: "crown_sticks" },
        { id: "pulls", qty: 21, qtySource: "door_pulls" },
        { id: "sink", qty: 1, qtySource: null },
      ],
      r,
    );
    expect(changes).toEqual([{ id: "crown", qty: 5 }]);
  });
  it("throws on an unknown key", () => {
    expect(() => applyTakeoff([{ id: "x", qty: 1, qtySource: "mystery" }], r)).toThrow();
  });
});
