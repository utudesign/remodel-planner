import { jobMoney } from "@/lib/jobs";

/** Per-deal numbers for the KPIs page. */
export type KpiDealInput = {
  id: string;
  created_at: string | null;
  sold_price_cents: number | null;
  change_orders_cents: number;
  estimated_value_cents: number | null;
  cancelled_at: string | null;
  latestQuoteCents: number | null;
  costCents: (number | null)[];
};

export type KpiDeal = {
  id: string;
  estimatedCents: number;
  won: boolean;
  wonCents: number;
  costCents: number;
  profitCents: number;
  margin: number | null;
};

/** Won = a sold price and not cancelled. Profit = won − job costs (costs on a deal that wasn't won count as a loss). */
export function kpiForDeal(d: KpiDealInput): KpiDeal {
  const won = d.sold_price_cents !== null && d.sold_price_cents > 0 && !d.cancelled_at;
  const m = jobMoney({
    soldCents: won ? d.sold_price_cents : 0,
    changeOrdersCents: won ? d.change_orders_cents : 0,
    costs: d.costCents,
  });
  return {
    id: d.id,
    estimatedCents: d.latestQuoteCents ?? d.estimated_value_cents ?? 0,
    won,
    wonCents: m.revenueCents,
    costCents: m.costCents,
    profitCents: won ? m.profitCents : -m.costCents,
    margin: won ? m.margin : null,
  };
}

export type KpiTotals = {
  deals: number;
  estimated: number;
  estimatedCents: number;
  won: number;
  wonCents: number;
  costCents: number;
  profitCents: number;
  margin: number | null;
  winRate: number | null;
  avgWonCents: number | null;
};

export function kpiTotals(rows: KpiDeal[]): KpiTotals {
  const sum = (f: (r: KpiDeal) => number) => rows.reduce((n, r) => n + f(r), 0);
  const won = rows.filter((r) => r.won);
  const estimated = rows.filter((r) => r.estimatedCents > 0);
  const wonCents = sum((r) => r.wonCents);
  const profitCents = sum((r) => r.profitCents);
  return {
    deals: rows.length,
    estimated: estimated.length,
    estimatedCents: sum((r) => r.estimatedCents),
    won: won.length,
    wonCents,
    costCents: sum((r) => r.costCents),
    profitCents,
    margin: wonCents > 0 ? profitCents / wonCents : null,
    winRate: estimated.length ? won.length / estimated.length : null,
    avgWonCents: won.length ? Math.round(wonCents / won.length) : null,
  };
}
