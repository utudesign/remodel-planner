import { describe, expect, it } from "vitest";
import { buildPaymentSchedule, type TemplateItem } from "@/lib/payment-schedule";

const pct = (
  label: string,
  bps: number,
  order: number,
  trigger: string | null = null,
): TemplateItem => ({
  label,
  kind: "percent",
  percent_bps: bps,
  amount_cents: null,
  due_trigger: trigger,
  sort_order: order,
});

const sum = (xs: { amount_cents: number }[]) => xs.reduce((s, x) => s + x.amount_cents, 0);

describe("buildPaymentSchedule", () => {
  it("50/25/25 on an even contract", () => {
    const s = buildPaymentSchedule(3600000, [
      pct("Deposit", 5000, 1),
      pct("Mid", 2500, 2, "mid_check"),
      pct("Final", 2500, 3, "final_inspection"),
    ]);
    expect(s.map((x) => x.amount_cents)).toEqual([1800000, 900000, 900000]);
    expect(s[0].due_trigger).toBe("deposit_received");
    expect(s[2].due_trigger).toBe("final_inspection");
  });

  it("rounds down and the last installment absorbs the remainder", () => {
    // $1,000.01 at 33.33 / 33.33 / 33.34
    const s = buildPaymentSchedule(100001, [
      pct("A", 3333, 1),
      pct("B", 3333, 2),
      pct("C", 3334, 3),
    ]);
    expect(s.map((x) => x.amount_cents)).toEqual([33330, 33330, 33341]);
    expect(sum(s)).toBe(100001);
  });

  it("always sums to the contract for awkward amounts", () => {
    for (const contract of [1, 7, 99999, 1234567, 3333333]) {
      const s = buildPaymentSchedule(contract, [
        pct("A", 3000, 1),
        pct("B", 3000, 2),
        pct("C", 3000, 3),
        pct("D", 1000, 4),
      ]);
      expect(sum(s)).toBe(contract);
      expect(s.every((x) => x.amount_cents >= 0)).toBe(true);
    }
  });

  it("mixes fixed and percent items", () => {
    const s = buildPaymentSchedule(2000000, [
      {
        label: "Deposit",
        kind: "fixed",
        percent_bps: null,
        amount_cents: 500000,
        due_trigger: null,
        sort_order: 1,
      },
      pct("Balance", 0, 2, "final_inspection"),
    ]);
    expect(s.map((x) => x.amount_cents)).toEqual([500000, 1500000]);
  });

  it("sorts by sort_order", () => {
    const s = buildPaymentSchedule(1000, [pct("Second", 3000, 2), pct("First", 7000, 1)]);
    expect(s.map((x) => x.label)).toEqual(["First", "Second"]);
  });

  it("rejects fixed amounts over the contract and non-positive contracts", () => {
    expect(() =>
      buildPaymentSchedule(1000, [
        {
          label: "A",
          kind: "fixed",
          percent_bps: null,
          amount_cents: 2000,
          due_trigger: null,
          sort_order: 1,
        },
        pct("B", 0, 2),
      ]),
    ).toThrow();
    expect(() => buildPaymentSchedule(0, [])).toThrow();
  });

  it("no template → one deposit for the full amount", () => {
    expect(buildPaymentSchedule(5000, [])).toEqual([
      { label: "Deposit", amount_cents: 5000, due_trigger: "deposit_received" },
    ]);
  });
});
