import { previewCommission, type CommissionPlan } from "@/lib/commission/commission";

export type PlanRow = {
  id: string;
  name: string;
  basis: string;
  rate: number;
  first_payout_pct: number;
  min_cents: number;
  active: boolean;
};

export function toPlan(p: PlanRow): CommissionPlan {
  return {
    basis: p.basis === "gross_profit" ? "gross_profit" : "contract_price",
    rate: Number(p.rate),
    firstPayoutPct: Number(p.first_payout_pct),
    minCents: Number(p.min_cents),
  };
}

/**
 * The plan to preview "this pays you $X" before one is picked (PLAN.md Q10):
 * cabinets-only / countertop jobs → a plan named "Cabinet…", everything else → the first other plan.
 */
export function defaultPlanFor(plans: PlanRow[], scope: string | null): PlanRow | null {
  const active = plans.filter((p) => p.active);
  if (!active.length) return null;
  const cabinets = active.find((p) => /cabinet/i.test(p.name));
  const other = active.find((p) => !/cabinet/i.test(p.name));
  if (scope === "cabinets_only" || scope === "countertops") return cabinets ?? other ?? active[0];
  return other ?? active[0];
}

/** Gross-profit plans can't be previewed from a price alone. */
export function previewFor(plan: PlanRow | null, priceCents: number | null | undefined): number | null {
  if (!plan || !priceCents || plan.basis !== "contract_price") return null;
  return previewCommission(toPlan(plan), priceCents);
}
