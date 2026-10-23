import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ten-by-ten.json";
import {
  divRound,
  marginToMarkup,
  markupToMargin,
  paymentSchedule,
  priceFromCost,
  priceLine,
  quoteTotals,
  sectionTotals,
  type LineInput,
  type QuoteAssumptions,
} from "../pricing";

const base: QuoteAssumptions = {
  targetMargin: 0.35,
  contingencyRate: 0.07,
  taxRate: 0.06,
  laborRateCents: 5500,
};

describe("divRound", () => {
  it("rounds half away from zero like Postgres round(numeric)", () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
    expect(divRound(5, 3)).toBe(2);
  });
  it("rejects unsafe input", () => {
    expect(() => divRound(1, 0)).toThrow();
    expect(() => divRound(1.5, 2)).toThrow();
  });
});

describe("margin vs markup", () => {
  it("prices by margin, not markup", () => {
    // $100 cost at 35% margin = $153.85, not $135
    expect(priceFromCost(10000, 0.35)).toBe(15385);
  });
  it("converts both ways", () => {
    expect(marginToMarkup(0.35)).toBeCloseTo(0.5385, 4);
    expect(markupToMargin(0.2)).toBeCloseTo(0.1667, 4); // a 20% markup is only a 16.7% margin
  });
  it("rejects a margin of 100% or more", () => {
    expect(() => priceFromCost(100, 1)).toThrow();
  });
});

describe("priceLine", () => {
  it("uses the quote labor rate for labor lines", () => {
    const p = priceLine(
      { qty: 20, unitCostCents: 0, usesLaborRate: true, marginOverride: null, taxable: false },
      base,
    );
    expect(p.extCostCents).toBe(110000);
    expect(p.priceCents).toBe(169231);
  });
  it("applies a margin override", () => {
    const p = priceLine(
      { qty: 1, unitCostCents: 25000, usesLaborRate: false, marginOverride: 0.1, taxable: true },
      base,
    );
    expect(p.priceCents).toBe(27778);
    expect(p.lineMargin).toBe(0.1);
  });
  it("handles fractional quantities without float drift", () => {
    // 25 ft of wire at $0.60 = $15.00 exactly
    const p = priceLine(
      { qty: 25, unitCostCents: 60, usesLaborRate: false, marginOverride: null, taxable: true },
      base,
    );
    expect(p.extCostCents).toBe(1500);
    const q = priceLine(
      { qty: 0.3, unitCostCents: 333, usesLaborRate: false, marginOverride: null, taxable: true },
      base,
    );
    expect(q.extCostCents).toBe(100); // 99.9 → 100
  });
  it("prices a zero-qty line at zero", () => {
    const p = priceLine(
      { qty: 0, unitCostCents: 2500, usesLaborRate: false, marginOverride: null, taxable: true },
      base,
    );
    expect(p.priceCents).toBe(0);
    expect(p.lineMargin).toBe(0);
  });
});

describe("quoteTotals: parity with the Postgres quote_totals view", () => {
  const a = fixture.assumptions as QuoteAssumptions;
  const lines = fixture.lines as LineInput[];
  const t = quoteTotals(lines, a);
  const e = fixture.expected;

  it.each([
    ["lineCount", "line_count"],
    ["directCostCents", "direct_cost_cents"],
    ["taxableCostCents", "taxable_cost_cents"],
    ["linesPriceCents", "lines_price_cents"],
    ["contingencyCostCents", "contingency_cost_cents"],
    ["taxCostCents", "tax_cost_cents"],
    ["contingencyPriceCents", "contingency_price_cents"],
    ["taxPriceCents", "tax_price_cents"],
    ["totalCostCents", "total_cost_cents"],
    ["totalPriceCents", "total_price_cents"],
    ["grossProfitCents", "gross_profit_cents"],
    ["grossMargin", "gross_margin"],
  ] as const)("%s matches SQL", (ts, sql) => {
    expect(t[ts]).toBe(e[sql]);
  });

  it("flags a quote that slipped below target margin", () => {
    // the 10% faucet override pulls this quote to 34.72%
    expect(t.belowTarget).toBe(true);
  });

  it("matches the estimate workbook at default settings", () => {
    const atDefaults = lines.map((l) => ({ ...l, marginOverride: null }));
    const w = quoteTotals(atDefaults, { ...a, laborRateCents: 5500 });
    expect(w.totalCostCents).toBe(1568050); // workbook: $15,680.50
    expect(Math.abs(w.totalPriceCents - 2412385)).toBeLessThanOrEqual(2); // workbook: $24,123.85 (per-line rounding)
    expect(w.grossMargin).toBe(0.35);
    expect(w.belowTarget).toBe(false);
  });
});

describe("sectionTotals", () => {
  it("folds contingency and tax into the absorbing section and sums to the total", () => {
    const lines = [
      {
        qty: 1,
        unitCostCents: 10000,
        usesLaborRate: false,
        marginOverride: null,
        taxable: true,
        sectionId: "cab",
      },
      {
        qty: 2,
        unitCostCents: 0,
        usesLaborRate: true,
        marginOverride: null,
        taxable: false,
        sectionId: "install",
      },
      {
        qty: 0,
        unitCostCents: 999,
        usesLaborRate: false,
        marginOverride: null,
        taxable: true,
        sectionId: "hidden",
      },
    ];
    const s = sectionTotals(lines, base, "install");
    const total = quoteTotals(lines, base).totalPriceCents;
    expect([...s.values()].reduce((x, y) => x + y, 0)).toBe(total);
    expect(s.has("hidden")).toBe(false);
  });
});

describe("paymentSchedule", () => {
  it("always sums exactly to the total", () => {
    const parts = paymentSchedule(2412386, [0.5, 0.25, 0.25]);
    expect(parts).toEqual([1206193, 603097, 603096]);
    expect(parts.reduce((s, x) => s + x, 0)).toBe(2412386);
  });
  it("rejects percents that do not add to 100%", () => {
    expect(() => paymentSchedule(1000, [0.7, 0.2])).toThrow();
  });
});
