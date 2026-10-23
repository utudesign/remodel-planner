import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { COMMISSION_STATUS_TONE, scopeInfo } from "@/lib/deals/display";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { listDeals } from "@/server/queries/deals";

export const metadata = { title: "Money" };

export default async function MoneyPage() {
  const s = await requireOwner();
  const year = Number(todayIn(s.timezone).slice(0, 4));
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
  const setAside = Math.round(((summary.net_cents ?? 0) * s.settings.taxSetAsidePct) / 100);
  const sorted = [...rows].sort((a, b) => (b.owed_cents ?? 0) - (a.owed_cents ?? 0));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[32px] leading-tight font-bold tracking-tight">Money</h1>

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

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">By deal</h2>
        {sorted.length === 0 ? (
          <EmptyState title="No commissions yet" description="A deal shows up here once it's handed off to a partner." />
        ) : (
          <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {sorted.map((r) => {
              const d = byId.get(r.deal_id!);
              return (
                <li key={r.deal_id}>
                  <Link href={`/deals/${r.deal_number}?tab=partner`} className="block px-4 py-3 active:bg-secondary">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        #{r.deal_number} {d?.contact?.name ?? ""} {scopeInfo(d?.scope)?.label ? `· ${scopeInfo(d?.scope)?.label}` : ""}
                      </span>
                      <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold", COMMISSION_STATUS_TONE[r.commission_status ?? ""] ?? "bg-muted")}>
                        {r.commission_status}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
                      Expected {formatCents(r.expected_cents)} · earned {formatCents(r.earned_cents)} · paid {formatCents(r.paid_cents)}
                      {(r.owed_cents ?? 0) > 0 ? <span className="font-semibold text-destructive"> · owed {formatCents(r.owed_cents)}</span> : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <div>
          <p className="text-xs text-muted-foreground">{year} net after expenses + mileage</p>
          <p className="text-lg font-bold tabular-nums">{formatCents(summary.net_cents)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Set aside for tax ({s.settings.taxSetAsidePct}%)</p>
          <p className="text-lg font-bold text-warning tabular-nums">{formatCents(Math.max(0, setAside))}</p>
        </div>
      </div>
    </div>
  );
}
