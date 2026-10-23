import { describe, expect, it } from "vitest";
import { computeFinancials } from "@/lib/margin";

const base = {
  contract_value_cents: 1450000,
  change_orders: [] as { price_change_cents: number; approved_at: string | null }[],
  costs: [
    { estimated_amount_cents: 800000, actual_amount_cents: 815000 },
    { estimated_amount_cents: 250000, actual_amount_cents: 230000 },
  ],
  payments: [
    { amount_cents: 1015000, status: "received" },
    { amount_cents: 435000, status: "due" },
  ],
};

describe("computeFinancials", () => {
  it("matches spec §7 formulas", () => {
    const f = computeFinancials(base);
    expect(f.revenueCents).toBe(1450000);
    expect(f.estimatedCostCents).toBe(1050000);
    expect(f.actualCostCents).toBe(1045000);
    expect(f.grossProfitCents).toBe(405000);
    expect(f.marginBps).toBe(2793); // 27.93% — same as the SQL lock
    expect(f.collectedCents).toBe(1015000);
    expect(f.balanceDueCents).toBe(435000);
    expect(f.costVarianceCents).toBe(-5000);
  });

  it("adds only APPROVED change orders to revenue", () => {
    const f = computeFinancials({
      ...base,
      change_orders: [
        { price_change_cents: 100000, approved_at: "2026-10-01T00:00:00Z" },
        { price_change_cents: 999999, approved_at: null },
      ],
    });
    expect(f.revenueCents).toBe(1550000);
    expect(f.balanceDueCents).toBe(535000);
  });

  it("projected margin uses estimates where actuals are missing", () => {
    const f = computeFinancials({
      ...base,
      costs: [
        { estimated_amount_cents: 800000, actual_amount_cents: 900000 },
        { estimated_amount_cents: 250000, actual_amount_cents: null },
      ],
    });
    expect(f.actualCostCents).toBe(900000);
    expect(f.projectedMarginBps).toBe(Math.round(((1450000 - 1150000) * 10000) / 1450000));
  });

  it("uses locked values once closed", () => {
    const f = computeFinancials({
      ...base,
      locked: { revenue_cents: 1450000, cost_cents: 1045000, margin_bps: 2793 },
      costs: [{ estimated_amount_cents: 1, actual_amount_cents: 1 }], // later edits don't move the lock
    });
    expect(f.isLocked).toBe(true);
    expect(f.marginBps).toBe(2793);
    expect(f.actualCostCents).toBe(1045000);
  });

  it("returns null margin for zero revenue", () => {
    expect(computeFinancials({ ...base, contract_value_cents: 0 }).marginBps).toBeNull();
  });
});
