import { describe, expect, it } from 'vitest';
import { commission, previewCommission, type CommissionPlan } from '../commission';

const kitchens: CommissionPlan = { basis: 'contract_price', rate: 0.05, firstPayoutPct: 0.5, minCents: 0 };
const cabinets: CommissionPlan = { basis: 'contract_price', rate: 0.08, firstPayoutPct: 1, minCents: 25000 };
const base = { changeOrdersCents: 0, depositReceived: false, paidInFull: false, cancelled: false };

// Same scenarios and numbers as test/run_sales_tests.sql
describe('commission (matches deal_commissions view)', () => {
  it('kitchen: half earned at deposit', () => {
    const c = commission(kitchens, { ...base, soldPriceCents: 3850000, depositReceived: true });
    expect([c.commissionCents, c.earnedCents, c.owedCents, c.status]).toEqual([192500, 96250, 96250, 'owed']);
  });

  it('cabinets: all at deposit, floor applies', () => {
    expect(commission(cabinets, { ...base, soldPriceCents: 420000, depositReceived: true }).earnedCents).toBe(33600);
    expect(commission(cabinets, { ...base, soldPriceCents: 180000, depositReceived: true }).commissionCents).toBe(25000);
  });

  it('change order + paid in full', () => {
    const c = commission(kitchens, { ...base, soldPriceCents: 3850000, changeOrdersCents: 150000, depositReceived: true, paidInFull: true }, 96250);
    expect([c.commissionCents, c.earnedCents, c.owedCents, c.status]).toEqual([200000, 200000, 103750, 'owed']);
    expect(commission(kitchens, { ...base, soldPriceCents: 3850000, changeOrdersCents: 150000, depositReceived: true, paidInFull: true }, 200000).status).toBe('paid');
  });

  it('cancelled before deposit pays nothing; no price yet waits', () => {
    expect(commission(kitchens, { ...base, soldPriceCents: null, cancelled: true }).status).toBe('cancelled');
    expect(commission(kitchens, { ...base, soldPriceCents: null }).status).toBe('waiting for price');
    expect(commission(kitchens, { ...base, soldPriceCents: 100 }).status).toBe('pending');
  });

  it('rounds half away from zero', () => {
    // 5% of 10.10 = 0.505 → 0.51; first half of 51¢ = 25.5 → 26
    const c = commission(kitchens, { ...base, soldPriceCents: 1010, depositReceived: true });
    expect([c.commissionCents, c.earnedCents]).toEqual([51, 26]);
  });

  it('previews what a price pays', () => {
    expect(previewCommission(kitchens, 2089643)).toBe(104482);
  });
});
