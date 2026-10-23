import { formatCents } from "@/lib/money";

/**
 * Spec §3B close gate. Mirrors public.close_project() in SQL, which is the real guard;
 * this version renders the same reasons in the UI before the user clicks.
 */
export function closeBlockers(input: {
  balanceDueCents: number;
  openPunchItems: number;
  costs: { actual_amount_cents: number | null }[];
}): string[] {
  const reasons: string[] = [];
  if (input.balanceDueCents !== 0)
    reasons.push(`Balance due is ${formatCents(input.balanceDueCents)}, not $0`);
  if (input.openPunchItems > 0) {
    reasons.push(
      `${input.openPunchItems} punch list item${input.openPunchItems === 1 ? "" : "s"} still open`,
    );
  }
  if (input.costs.length === 0) reasons.push("No costs entered");
  else {
    const missing = input.costs.filter((c) => c.actual_amount_cents === null).length;
    if (missing > 0)
      reasons.push(`${missing} cost line${missing === 1 ? "" : "s"} missing an actual amount`);
  }
  return reasons;
}
