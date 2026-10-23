import { getSession } from "@/lib/auth/require-role";
import { expenseLabel } from "@/lib/money-categories";

/** CSV for the tax preparer: commissions received, expenses, mileage for one year. */
export async function GET(req: Request) {
  const s = await getSession();
  if (s.role !== "owner") return new Response("Forbidden", { status: 403 });
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const [pay, exp, mi] = await Promise.all([
    s.db.from("commission_payments").select("paid_on, amount_cents, method, reference, deal:deals(deal_number)").eq("company_id", s.companyId).gte("paid_on", from).lte("paid_on", to).order("paid_on"),
    s.db.from("business_expenses").select("spent_on, amount_cents, category, vendor, note, deal:deals(deal_number)").eq("company_id", s.companyId).gte("spent_on", from).lte("spent_on", to).order("spent_on"),
    s.db.from("mileage_trips").select("trip_on, miles, purpose, deal:deals(deal_number)").eq("company_id", s.companyId).gte("trip_on", from).lte("trip_on", to).order("trip_on"),
  ]);
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const usd = (c: number) => (c / 100).toFixed(2);
  const rows: unknown[][] = [["type", "date", "amount_usd", "miles", "category_or_method", "description", "deal"]];
  for (const p of pay.data ?? []) rows.push(["commission received", p.paid_on, usd(p.amount_cents), "", p.method ?? "", p.reference ?? "", p.deal?.deal_number ?? ""]);
  for (const e of exp.data ?? []) rows.push(["expense", e.spent_on, usd(e.amount_cents), "", expenseLabel(e.category), [e.vendor, e.note].filter(Boolean).join(" — "), e.deal?.deal_number ?? ""]);
  const rate = s.settings.mileageRateCents;
  for (const m of mi.data ?? []) rows.push(["mileage", m.trip_on, usd(Math.round(Number(m.miles) * rate)), m.miles, `${rate}¢/mile`, m.purpose, m.deal?.deal_number ?? ""]);
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kitchen-sales-${year}.csv"`,
    },
  });
}
