import { describe, expect, it } from "vitest";
import { TAB_ITEMS } from "@/lib/nav";
import { defaultPlanFor, previewFor, type PlanRow } from "@/lib/deals/plans";

describe("nav", () => {
  it("phone tabs: Today · Deals · Money · More", () => {
    expect(TAB_ITEMS.map((i) => i.label)).toEqual(["Today", "Deals", "Money", "More"]);
  });
});

const plans: PlanRow[] = [
  { id: "k", name: "Kitchens 5% (50% at deposit)", basis: "contract_price", rate: 0.05, first_payout_pct: 0.5, min_cents: 0, active: true },
  { id: "c", name: "Cabinets only 8% (all at deposit, $250 floor)", basis: "contract_price", rate: 0.08, first_payout_pct: 1, min_cents: 25000, active: true },
];

describe("commission preview before a plan is picked", () => {
  it("kitchen → 5% plan: $38,500 pays $1,925", () => {
    expect(previewFor(defaultPlanFor(plans, "kitchen"), 3_850_000)).toBe(192_500);
  });
  it("cabinets only → 8% plan with the $250 floor", () => {
    expect(previewFor(defaultPlanFor(plans, "cabinets_only"), 420_000)).toBe(33_600);
    expect(previewFor(defaultPlanFor(plans, "cabinets_only"), 180_000)).toBe(25_000);
  });
  it("no price or gross-profit plan → no preview", () => {
    expect(previewFor(defaultPlanFor(plans, "kitchen"), null)).toBeNull();
    expect(previewFor({ ...plans[0], basis: "gross_profit" }, 100)).toBeNull();
  });
});
