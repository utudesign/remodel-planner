/**
 * Sales-rep commission, mirroring the deal_commissions view in 0006_sales_rep.sql.
 * Money in integer cents; rates as decimals (0.05 = 5%); rounding half away from zero.
 */
export type CommissionPlan = {
  basis: 'contract_price' | 'gross_profit';
  rate: number;            // 0.05
  firstPayoutPct: number;  // share earned at deposit; rest at paid-in-full
  minCents: number;        // floor per deal
};

export type DealProgress = {
  soldPriceCents: number | null;
  changeOrdersCents: number;
  partnerGrossProfitCents?: number | null;
  depositReceived: boolean;
  paidInFull: boolean;
  cancelled: boolean;
};

export type CommissionStatus = 'cancelled' | 'waiting for price' | 'pending' | 'owed' | 'part paid' | 'paid';

/** Math.round rounds .5 toward +∞; this rounds half away from zero like Postgres numeric round(). */
export function roundHalfAway(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** Multiply cents by a rate with 4 decimals, using integer basis points to avoid float drift. */
function mulRate(cents: number, rate: number): number {
  const bp = Math.round(rate * 10000);
  const num = cents * bp;
  const q = Math.trunc(num / 10000);
  const r = num - q * 10000;
  return Math.abs(r) * 2 >= 10000 ? q + Math.sign(num) : q;
}

export function commission(plan: CommissionPlan, d: DealProgress, paidCents = 0) {
  const contractTotalCents = (d.soldPriceCents ?? 0) + d.changeOrdersCents;
  const basisCents = plan.basis === 'contract_price' ? contractTotalCents : (d.partnerGrossProfitCents ?? 0);
  const commissionCents = basisCents > 0 ? Math.max(mulRate(basisCents, plan.rate), plan.minCents) : 0;
  const firstCents = mulRate(commissionCents, plan.firstPayoutPct);

  let earnedCents = 0;
  if (d.cancelled && !d.depositReceived) earnedCents = 0;
  else if (d.paidInFull) earnedCents = commissionCents;
  else if (d.depositReceived) earnedCents = firstCents;

  const expectedCents = d.cancelled ? 0 : commissionCents;
  let status: CommissionStatus;
  if (d.cancelled) status = 'cancelled';
  else if (basisCents === 0) status = 'waiting for price';
  else if (!d.paidInFull && !d.depositReceived) status = 'pending';
  else if (paidCents >= (d.paidInFull ? commissionCents : firstCents)) status = d.paidInFull ? 'paid' : 'part paid';
  else status = 'owed';

  return {
    contractTotalCents, basisCents, commissionCents, earnedCents, paidCents,
    owedCents: earnedCents - paidCents, expectedCents, status,
  };
}

/** "If you close this at $X, you make $Y" — for the quick estimate screen. */
export function previewCommission(plan: CommissionPlan, priceCents: number): number {
  return commission(plan, { soldPriceCents: priceCents, changeOrdersCents: 0, depositReceived: true, paidInFull: true, cancelled: false }).commissionCents;
}
