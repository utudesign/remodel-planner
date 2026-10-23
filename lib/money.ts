/** Money is integer cents everywhere. These helpers are the only place cents become text. */

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return usd.format(cents / 100);
}

/** "$12,400" — for cards and budgets where cents are noise. */
export function formatCentsWhole(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return usdWhole.format(Math.round(cents / 100));
}

/** "$8k–$12k" budget range label. */
export function formatBudget(min: number | null, max: number | null): string {
  const k = (c: number) => {
    const d = c / 100;
    return d >= 1000 ? `$${Math.round(d / 100) / 10}k`.replace(".0k", "k") : `$${Math.round(d)}`;
  };
  if (min && max) return `${k(min)}–${k(max)}`;
  if (max) return `≤ ${k(max)}`;
  if (min) return `${k(min)}+`;
  return "—";
}

/**
 * Parses what a person types ("12,400", "$1,234.5", "99.99") into integer cents without floats.
 * Returns null for empty input; throws on anything that isn't a non-negative amount.
 */
export function parseDollarsToCents(input: string | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = input.trim().replace(/[$,\s]/g, "");
  if (s === "") return null;
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) throw new Error(`"${input}" is not a valid dollar amount`);
  const dollars = Number(m[1]);
  const cents = Number((m[2] ?? "").padEnd(2, "0"));
  const total = dollars * 100 + cents;
  if (!Number.isSafeInteger(total)) throw new Error("Amount is too large");
  return total;
}

/** Cents → "1234.50" for pre-filling inputs. */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

/** Basis points (2793) → "27.9%". */
export function formatBps(bps: number | null | undefined, digits = 1): string {
  if (bps === null || bps === undefined) return "—";
  return `${(bps / 100).toFixed(digits)}%`;
}
