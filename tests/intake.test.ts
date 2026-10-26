import { describe, expect, it } from "vitest";
import { budgetRange, intakeSchema, primaryScope, roughRunFt, summarizeIntake, wallsFromRun } from "@/lib/intake";

// What the form sends for a full kitchen (JSON from components/public/lead-form.tsx).
const kitchenForm = {
  projects: ["kitchen", "bath"],
  kitchen: {
    layout: "l_shape",
    island: "has",
    base: 14,
    wall: 10,
    tall: 1,
    ceiling: "9",
    layout_change: "same",
    appliances_plan: "some",
    appliances: ["fridge", "range", "dishwasher", "microwave_otr", "wall_oven"],
    appliances_other: "48\" range",
    also: ["backsplash", "sink_faucet"],
    door: "shaker",
    color: "white",
  },
  tops: { size: "l", sqft: null, now: null, want: "quartz" },
  bath: { room: "hall", now: "tub_shower", want: "tub_to_shower", scope: "full", vanity: "36", size: "small" },
  when: "1_3_months",
  budget: "35_50",
  owns_home: true,
};

describe("intake", () => {
  it("accepts what the form sends", () => {
    const a = intakeSchema.parse(kitchenForm);
    expect(a.kitchen?.base).toBe(14);
    expect(a.tops?.want).toBe("quartz");
  });
  it("rejects made-up values", () => {
    expect(() => intakeSchema.parse({ ...kitchenForm, budget: "1000000" })).toThrow();
    expect(() => intakeSchema.parse({ projects: ["pool"] })).toThrow();
    expect(() => intakeSchema.parse({ projects: [], kitchen: { ...kitchenForm.kitchen, base: 500 } })).toThrow();
  });
  it("an empty form is fine (name + phone are checked elsewhere)", () => {
    expect(intakeSchema.parse({}).projects).toEqual([]);
  });
  it("files the deal under the main project", () => {
    expect(primaryScope(["bath", "countertops"])).toBe("countertops");
    expect(primaryScope(["bath", "kitchen"])).toBe("kitchen");
    expect(primaryScope([])).toBeNull();
  });
  it("summarizes for me in a few lines", () => {
    const lines = summarizeIntake(intakeSchema.parse(kitchenForm));
    expect(lines[0]).toBe("Kitchen: L-shape, has an island · cabinets now 14 bottom + 10 wall + 1 tall · 9 ft ceiling · keep the same layout");
    expect(lines[1]).toContain("Replacing some · Fridge, Range / stove, Dishwasher, Microwave over range, Wall oven · other: 48\" range");
    expect(lines[2]).toBe("Style: Shaker, White · Also: Backsplash, Sink + faucet");
    expect(lines[3]).toBe("Countertops: Large · 50–80 sq ft · wants quartz");
    expect(lines[4]).toContain("Bath: Hall / kids bath · now tub with shower · wants tub → walk-in shower");
    expect(lines[5]).toBe("When: 1–3 months · Budget: $35k–$50k · owns the home");
  });
  it("rough wall run from the cabinet count", () => {
    expect(roughRunFt({ ...intakeSchema.parse(kitchenForm).kitchen!, island: "no" })).toBe(33); // 14×2 + 5
    expect(roughRunFt(intakeSchema.parse(kitchenForm).kitchen)).toBe(25); // island boxes off the walls
    expect(roughRunFt({ ...intakeSchema.parse(kitchenForm).kitchen!, base: null })).toBeNull();
    expect(wallsFromRun(25, "l_shape")).toEqual([{ ft: 12.5 }, { ft: 12.5 }]);
    expect(wallsFromRun(30, "u_shape")).toHaveLength(3);
  });
  it("budget keys map to cents", () => {
    expect(budgetRange("20_35")).toEqual({ min: 2_000_000, max: 3_500_000 });
    expect(budgetRange("50p")).toEqual({ min: 5_000_000, max: null });
    expect(budgetRange(null)).toEqual({ min: null, max: null });
  });
});
