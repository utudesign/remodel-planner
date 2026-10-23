export type TemplateItem = {
  label: string;
  kind: "percent" | "fixed";
  percent_bps: number | null;
  amount_cents: number | null;
  due_trigger: string | null;
  sort_order: number;
};

export type Installment = { label: string; amount_cents: number; due_trigger: string | null };

/**
 * Turns a payment template into installments for a contract value (integer cents).
 * - Percent items round DOWN to the cent; fixed items are taken as-is.
 * - The LAST installment absorbs the remainder, so the schedule always sums to the contract exactly.
 * - Throws when fixed amounts already exceed the contract.
 */
export function buildPaymentSchedule(contractCents: number, items: TemplateItem[]): Installment[] {
  if (!Number.isSafeInteger(contractCents) || contractCents <= 0) {
    throw new Error("Contract value must be a positive amount");
  }
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  if (sorted.length === 0) {
    return [{ label: "Deposit", amount_cents: contractCents, due_trigger: "deposit_received" }];
  }

  const amounts = sorted.map((i) =>
    i.kind === "fixed"
      ? (i.amount_cents ?? 0)
      : Math.floor((contractCents * (i.percent_bps ?? 0)) / 10000),
  );
  const allButLast = amounts.slice(0, -1).reduce((s, a) => s + a, 0);
  const last = contractCents - allButLast;
  if (last < 0) throw new Error("Fixed installments add up to more than the contract value");
  amounts[amounts.length - 1] = last;

  return sorted.map((i, idx) => ({
    label: i.label,
    amount_cents: amounts[idx],
    due_trigger: idx === 0 ? "deposit_received" : i.due_trigger,
  }));
}
