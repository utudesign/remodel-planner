export type FinancialInput = {
  contract_value_cents: number;
  change_orders: {
    price_change_cents: number;
    cost_change_cents?: number;
    approved_at: string | null;
  }[];
  costs: { estimated_amount_cents: number; actual_amount_cents: number | null }[];
  payments: { amount_cents: number; status: string }[];
  locked?: {
    revenue_cents: number | null;
    cost_cents: number | null;
    margin_bps: number | null;
  } | null;
};

export type Financials = {
  revenueCents: number;
  estimatedCostCents: number;
  actualCostCents: number;
  grossProfitCents: number;
  /** Gross margin in basis points (2793 = 27.93%). null when revenue is 0. */
  marginBps: number | null;
  /** Margin if actual costs come in at estimate for lines without an actual yet. */
  projectedMarginBps: number | null;
  costVarianceCents: number;
  collectedCents: number;
  balanceDueCents: number;
  isLocked: boolean;
};

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const bps = (profit: number, revenue: number) =>
  revenue === 0 ? null : Math.round((profit * 10000) / revenue);

/** Spec §7: revenue = contract + approved change orders; margin = (revenue − actual cost) ÷ revenue. */
export function computeFinancials(p: FinancialInput): Financials {
  const approved = p.change_orders.filter((c) => c.approved_at);
  const liveRevenue = p.contract_value_cents + sum(approved.map((c) => c.price_change_cents));
  const estimated = sum(p.costs.map((c) => c.estimated_amount_cents));
  const liveActual = sum(p.costs.map((c) => c.actual_amount_cents ?? 0));
  const projectedCost = sum(p.costs.map((c) => c.actual_amount_cents ?? c.estimated_amount_cents));
  const collected = sum(
    p.payments.filter((x) => x.status === "received").map((x) => x.amount_cents),
  );

  const isLocked = !!p.locked && p.locked.revenue_cents !== null;
  const revenue = isLocked ? p.locked!.revenue_cents! : liveRevenue;
  const actual = isLocked ? (p.locked!.cost_cents ?? liveActual) : liveActual;
  const profit = revenue - actual;

  return {
    revenueCents: revenue,
    estimatedCostCents: estimated,
    actualCostCents: actual,
    grossProfitCents: profit,
    marginBps: isLocked ? p.locked!.margin_bps : bps(profit, revenue),
    projectedMarginBps: bps(revenue - projectedCost, revenue),
    costVarianceCents:
      liveActual -
      sum(
        p.costs.filter((c) => c.actual_amount_cents !== null).map((c) => c.estimated_amount_cents),
      ),
    collectedCents: collected,
    balanceDueCents: liveRevenue - collected,
    isLocked,
  };
}
