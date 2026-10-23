import { describe, expect, it } from "vitest";
import { computeTakeoff } from "@/lib/estimating/takeoff";
import { formFromTakeoff, measureFromWalls, parseFeetList, parseInchList, takeoffFromForm, takeoffSettings } from "@/lib/quick-estimate";

const template = {
  counter_runs_in: [120, 120], counter_depth_in: 25.5, corners: 1, openings_in: [30], crown_lf: 22,
  light_rail_lf: 14, toe_kick_lf: 14, scribe_lf: 12, doors: 19, drawers: 6, led_ft: 12, led_watts_per_ft: 4,
  led_driver_w: 60, countertop_outlets: 5, extra_cover_plates: 1, cabinet_lf: 29.5,
};

describe("measure form ↔ takeoff", () => {
  it("round-trips the 10x10 template exactly", () => {
    expect(takeoffFromForm(formFromTakeoff(template), template)).toEqual(template);
  });
  it("feet with inches and decimal feet", () => {
    expect(parseFeetList("10, 12 6")).toEqual([10, 12.5]);
    expect(parseFeetList("9.5 / 11'")).toEqual([9.5, 11]);
    expect(parseFeetList("abc, 0")).toEqual([]);
    expect(parseInchList("30, 36")).toEqual([30, 36]);
  });
  it("a bigger LED run gets a bigger driver (20 W steps with 20% headroom)", () => {
    const t = takeoffFromForm({ ...formFromTakeoff(template), led_ft: 20 }, template);
    expect(t.led_driver_w).toBe(100);
    expect(computeTakeoff(t, takeoffSettings(null)).warnings.some((w) => w.includes("driver"))).toBe(false);
  });
  it("site-visit walls seed the runs, corners and cabinet feet", () => {
    const m = measureFromWalls([{ ft: 10 }, { ft: 12 }, { ft: 8 }], formFromTakeoff(template));
    expect(m.walls_ft).toEqual([10, 12, 8]);
    expect(m.corners).toBe(2);
    expect(m.cabinet_lf).toBe(30);
  });
});
