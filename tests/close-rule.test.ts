import { describe, expect, it } from "vitest";
import { closeBlockers } from "@/lib/close-rule";

describe("closeBlockers", () => {
  it("allows close when balance is $0, punch list clear and every cost has an actual", () => {
    expect(
      closeBlockers({
        balanceDueCents: 0,
        openPunchItems: 0,
        costs: [{ actual_amount_cents: 100 }],
      }),
    ).toEqual([]);
  });

  it("lists every blocker", () => {
    const r = closeBlockers({
      balanceDueCents: 435000,
      openPunchItems: 2,
      costs: [{ actual_amount_cents: null }, { actual_amount_cents: 5 }],
    });
    expect(r).toHaveLength(3);
    expect(r[0]).toContain("$4,350.00");
    expect(r[1]).toContain("2 punch list items");
    expect(r[2]).toContain("1 cost line missing");
  });

  it("requires at least one cost line", () => {
    expect(closeBlockers({ balanceDueCents: 0, openPunchItems: 0, costs: [] })).toEqual([
      "No costs entered",
    ]);
  });

  it("treats overpayment as a blocker too (balance must be exactly $0)", () => {
    expect(
      closeBlockers({
        balanceDueCents: -100,
        openPunchItems: 0,
        costs: [{ actual_amount_cents: 1 }],
      }),
    ).toHaveLength(1);
  });
});
