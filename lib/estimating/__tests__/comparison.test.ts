import { describe, expect, it } from 'vitest';
import { compareQuote, packsNeeded, priceAgeDays, retailerLineCost } from '../comparison';

const hd = (packQty: number, packPriceCents: number, extra: Partial<{ verified: boolean; isSubstitute: boolean; checkedOn: string }> = {}) => ({
  packQty, packPriceCents, verified: true, isSubstitute: false, checkedOn: '2026-10-23', ...extra,
});

describe('packs and line cost', () => {
  it('rounds up to whole packs', () => {
    expect(packsNeeded(21, 10)).toBe(3);   // 21 pulls from 10-packs
    expect(packsNeeded(20, 10)).toBe(2);
    expect(packsNeeded(0.25, 1)).toBe(1);  // a quarter box still means buying a box
  });
  it('adds sales tax', () => {
    expect(retailerLineCost(21, 10, 4242, 0.06)).toBe(13490); // 3 x $42.42 x 1.06
    expect(retailerLineCost(1, 1, 28900, 0)).toBe(28900);
  });
});

describe('compareQuote', () => {
  it('counts covered vs not-covered lines and never guesses the gaps', () => {
    const r = compareQuote(
      [
        { qty: 1, ourPriceCents: 60000, retailer: hd(1, 28900) },                         // sink base
        { qty: 2, ourPriceCents: 9000, retailer: hd(2, 4282, { isSubstitute: true }) },   // end panels 2-pack
        { qty: 35, ourPriceCents: 280000, retailer: null },                                // quartz: HD has no published price
        { qty: 20, ourPriceCents: 169231, retailer: null },                                // labor
        { qty: 0, ourPriceCents: 0, retailer: hd(1, 999) },                                // hidden line
      ],
      0.06,
      0,
    );
    expect(r.coveredLines).toBe(2);
    expect(r.uncoveredLines).toBe(2);
    expect(r.substituteLines).toBe(1);
    expect(r.retailerMaterialsCents).toBe(30634 + 4539);
    expect(r.ourPriceCoveredCents).toBe(69000);
    expect(r.retailerTotalCents).toBe(r.retailerMaterialsCents);
  });

  it('adds a real retailer quote as an adjustment', () => {
    const r = compareQuote([{ qty: 1, ourPriceCents: 100, retailer: hd(1, 100) }], 0, 1_250_000);
    expect(r.retailerTotalCents).toBe(1_250_100);
  });

  it('tracks the oldest price date', () => {
    const r = compareQuote(
      [
        { qty: 1, ourPriceCents: 1, retailer: hd(1, 1, { checkedOn: '2026-09-01' }) },
        { qty: 1, ourPriceCents: 1, retailer: hd(1, 1, { checkedOn: '2026-10-23', verified: false }) },
      ],
      0,
    );
    expect(r.oldestPriceDate).toBe('2026-09-01');
    expect(r.unverifiedLines).toBe(1);
    expect(priceAgeDays(r.oldestPriceDate, '2026-10-23')).toBe(52);
  });
});
