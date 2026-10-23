import Link from "next/link";
import { Car, Download, Plus, Receipt } from "lucide-react";
import { DeleteRow } from "@/components/money/delete-row";
import { EmptyState } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { formatDate, todayIn } from "@/lib/dates";
import { COMMISSION_STATUS_TONE, scopeInfo } from "@/lib/deals/display";
import { expenseLabel } from "@/lib/money-categories";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { listDeals } from "@/server/queries/deals";

export const metadata = { title: "Money" };

const TABS = [
  { key: "commissions", label: "Commission" },
  { key: "expenses", label: "Expenses" },
  { key: "mileage", label: "Mileage" },
  { key: "year", label: "Year" },
] as const;

export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ tab?: string; year?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "commissions";
  const s = await requireOwner();
  const thisYear = Number(todayIn(s.timezone).slice(0, 4));
  const year = Number(sp.year) || thisYear;
  const [rows, deals, summary] = await Promise.all([
    s.db
      .from("deal_commissions")
      .select("deal_id, deal_number, expected_cents, earned_cents, paid_cents, owed_cents, commission_status, plan_name, partner_name")
      .eq("company_id", s.companyId)
      .then(must),
    listDeals(s),
    s.db.rpc("rep_year_summary", { p_year: year, p_rate_cents_per_mile: s.settings.mileageRateCents }).single().then(must),
  ]);
  const byId = new Map(deals.map((d) => [d.id, d]));
  const owed = rows.reduce((n, r) => n + Math.max(0, r.owed_cents ?? 0), 0);
  const setAside = Math.max(0, Math.round(((summary.net_cents ?? 0) * s.settings.taxSetAsidePct) / 100));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[32px] leading-tight font-bold tracking-tight">Money</h1>
      <nav className="grid grid-cols-4 rounded-xl bg-muted p-1 text-[13px] font-semibold">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/money?tab=${t.key}`}
            className={cn("flex h-10 items-center justify-center rounded-lg text-muted-foreground", tab === t.key && "bg-card text-foreground shadow-sm")}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "commissions" ? (
        <>
          <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
            <p className="text-sm font-medium text-primary-foreground/80">Owed to you now</p>
            <p className="mt-0.5 text-[40px] leading-none font-bold tracking-tight tabular-nums">{formatCents(owed)}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
              <div>
                <p className="text-xs text-primary-foreground/80">Pipeline (not earned yet)</p>
                <p className="text-lg font-bold tabular-nums">{formatCents(summary.commissions_pipeline_cents)}</p>
              </div>
              <div>
                <p className="text-xs text-primary-foreground/80">Paid in {year}</p>
                <p className="text-lg font-bold tabular-nums">{formatCents(summary.commissions_paid_cents)}</p>
              </div>
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No commissions yet" description="A deal shows up here once it's handed off to a partner." />
          ) : (
            <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              {[...rows]
                .sort((a, b) => (b.owed_cents ?? 0) - (a.owed_cents ?? 0))
                .map((r) => {
                  const d = byId.get(r.deal_id!);
                  return (
                    <li key={r.deal_id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/deals/${r.deal_number}?tab=partner`} className="truncate font-semibold">
                          #{r.deal_number} {d?.contact?.name ?? ""} {scopeInfo(d?.scope)?.label ? `· ${scopeInfo(d?.scope)?.label}` : ""}
                        </Link>
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold", COMMISSION_STATUS_TONE[r.commission_status ?? ""] ?? "bg-muted")}>
                          {r.commission_status}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
                        Expected {formatCents(r.expected_cents)} · earned {formatCents(r.earned_cents)} · paid {formatCents(r.paid_cents)}
                        {(r.owed_cents ?? 0) > 0 ? <span className="font-semibold text-destructive"> · owed {formatCents(r.owed_cents)}</span> : null}
                      </p>
                      {(r.earned_cents ?? 0) > 0 ? (
                        <Link href={`/money/record?deal=${r.deal_number}`} className="mt-2 inline-flex h-10 items-center rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-foreground">
                          Record a payment I received
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      ) : null}

      {tab === "expenses" ? <Expenses year={year} /> : null}
      {tab === "mileage" ? <Mileage year={year} rate={s.settings.mileageRateCents} /> : null}

      {tab === "year" ? (
        <>
          <div className="flex gap-2">
            {[thisYear - 1, thisYear].map((y) => (
              <Link key={y} href={`/money?tab=year&year=${y}`} className={cn("h-10 rounded-xl px-4 text-sm leading-10 font-semibold ring-1 ring-border", y === year ? "bg-foreground text-background" : "bg-card")}>
                {y}
              </Link>
            ))}
          </div>
          <dl className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
            {[
              ["Commissions received", formatCents(summary.commissions_paid_cents)],
              ["Expenses", `− ${formatCents(summary.expenses_cents)}`],
              [`Mileage (${summary.miles} mi × ${s.settings.mileageRateCents}¢)`, `− ${formatCents(summary.mileage_deduction_cents)}`],
              ["Net", formatCents(summary.net_cents)],
              [`Set aside for tax (${s.settings.taxSetAsidePct}%)`, formatCents(setAside)],
              ["Still owed to you", formatCents(summary.commissions_owed_cents)],
            ].map(([k, v], i) => (
              <div key={k} className={cn("flex justify-between px-4 py-3", i === 3 && "font-bold", i === 4 && "text-warning font-semibold")}>
                <dt>{k}</dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <a href={`/money/export?year=${year}`} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-semibold">
            <Download className="size-5" /> CSV for the tax preparer
          </a>
          <p className="text-xs text-muted-foreground">
            As a 1099 contractor no tax is withheld from commissions. The set-aside % is a savings target, not tax advice.
          </p>
        </>
      ) : null}
    </div>
  );
}

async function Expenses({ year }: { year: number }) {
  const s = await requireOwner();
  const rows = must(
    await s.db
      .from("business_expenses")
      .select("id, spent_on, amount_cents, category, vendor, note, receipt_path")
      .eq("company_id", s.companyId)
      .gte("spent_on", `${year}-01-01`)
      .lte("spent_on", `${year}-12-31`)
      .order("spent_on", { ascending: false }),
  );
  const total = rows.reduce((n, r) => n + r.amount_cents, 0);
  return (
    <>
      <Link href="/money/expenses/new" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
        <Receipt className="size-5" /> Add expense
      </Link>
      <p className="text-sm text-muted-foreground">
        {year}: {formatCents(total)} in {rows.length} expense{rows.length === 1 ? "" : "s"}
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No expenses yet" description="Snap the receipt right after you buy samples, ads or tools." />
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.vendor || expenseLabel(r.category)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(r.spent_on)} · {expenseLabel(r.category)}
                  {r.receipt_path ? " · receipt" : ""}
                </p>
              </div>
              <span className="font-semibold tabular-nums">{formatCents(r.amount_cents)}</span>
              <DeleteRow table="business_expenses" id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function Mileage({ year, rate }: { year: number; rate: number }) {
  const s = await requireOwner();
  const rows = must(
    await s.db
      .from("mileage_trips")
      .select("id, trip_on, miles, purpose")
      .eq("company_id", s.companyId)
      .gte("trip_on", `${year}-01-01`)
      .lte("trip_on", `${year}-12-31`)
      .order("trip_on", { ascending: false }),
  );
  const miles = rows.reduce((n, r) => n + Number(r.miles), 0);
  return (
    <>
      <Link href="/money/mileage/new" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
        <Car className="size-5" /> Log a trip
      </Link>
      <p className="text-sm text-muted-foreground">
        {year}: {Math.round(miles * 10) / 10} mi ≈ {formatCents(Math.round(miles * rate))} at {rate}¢
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No trips yet" description="Log each site visit drive (round trip)." action={<Link href="/money/mileage/new" className="text-sm font-semibold text-primary"><Plus className="inline size-4" /> Log a trip</Link>} />
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.purpose}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.trip_on)}</p>
              </div>
              <span className="font-semibold tabular-nums">{Number(r.miles)} mi</span>
              <DeleteRow table="mileage_trips" id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
