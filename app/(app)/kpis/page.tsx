import Link from "next/link";
import { ScopeBadge } from "@/components/deals/deal-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { jobStatusLabel } from "@/lib/deals/display";
import { kpiForDeal, kpiTotals } from "@/lib/kpis";
import { formatCentsWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { listDeals } from "@/server/queries/deals";

export const metadata = { title: "KPIs" };

/**
 * KPIs: estimated, won, job costs, profit — totals and by deal, for everyone or one salesperson.
 * Won = has a sold price and isn't cancelled. Profit = won − job costs (0015).
 */
export default async function KpisPage({ searchParams }: { searchParams: Promise<{ who?: string; year?: string }> }) {
  const { who = "all", year: yearParam } = await searchParams;
  const s = await requireStaff();
  const thisYear = Number(new Date().toISOString().slice(0, 4));
  const year = yearParam === "all" ? null : Number(yearParam) || thisYear;

  const [deals, peopleRes, quotesRes, totalsRes, projectsRes] = await Promise.all([
    listDeals(s),
    s.db.from("users").select("id, name").eq("company_id", s.companyId).eq("workspace_id", s.workspaceId).eq("active", true).in("role", ["owner", "team", "partner"]).order("created_at"),
    s.db.from("quotes").select("id, deal_id, version").eq("company_id", s.companyId),
    s.db.from("quote_totals").select("quote_id, total_price_cents").eq("company_id", s.companyId),
    s.db.from("projects").select("deal_id, costs(actual_amount)").eq("company_id", s.companyId),
  ]);
  const people = must(peopleRes);
  const totalOf = new Map(must(totalsRes).map((t) => [t.quote_id, Number(t.total_price_cents)]));
  const latest = new Map<string, { version: number; cents: number }>();
  for (const q of must(quotesRes)) {
    if (!q.deal_id) continue;
    const cur = latest.get(q.deal_id);
    if (!cur || q.version > cur.version) latest.set(q.deal_id, { version: q.version, cents: totalOf.get(q.id) ?? 0 });
  }
  const costsOf = new Map(must(projectsRes).map((p) => [p.deal_id, (p.costs ?? []).map((c) => c.actual_amount)]));

  // 0016: my workspace's deals; deals shared with me only under "Shared with me".
  const sharedIn = deals.filter((d) => d.workspace_id !== s.workspaceId);
  const scoped = (who === "shared" ? sharedIn : deals.filter((d) => d.workspace_id === s.workspaceId))
    .filter((d) => who === "all" || who === "shared" || d.owner_id === who)
    .filter((d) => !year || (d.created_at ?? "").startsWith(String(year)));
  const rows = scoped.map((d) => ({
    d,
    k: kpiForDeal({
      id: d.id,
      created_at: d.created_at,
      sold_price_cents: d.sold_price_cents,
      change_orders_cents: d.change_orders_cents,
      estimated_value_cents: d.estimated_value_cents,
      cancelled_at: d.cancelled_at,
      latestQuoteCents: latest.get(d.id)?.cents ?? null,
      costCents: costsOf.get(d.id) ?? [],
    }),
  }));
  const tot = kpiTotals(rows.map((r) => r.k));
  const shown = rows
    .filter((r) => r.k.estimatedCents > 0 || r.k.won || r.k.costCents > 0)
    .sort((a, b) => b.k.wonCents - a.k.wonCents || b.k.estimatedCents - a.k.estimatedCents);
  const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ who, year: year ? String(year) : "all", ...patch });
    return `/kpis?${p.toString()}`;
  };

  return (
    <>
      <PageHeader title="KPIs" description="Estimated, won, job costs and profit. Won = sold price set, not cancelled." />

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href={q({ who: "all" })} className={chip(who === "all")}>
          Everyone
        </Link>
        {people.map((p) => (
          <Link key={p.id} href={q({ who: p.id })} className={chip(who === p.id)}>
            {p.name || "No name"}
          </Link>
        ))}
        {sharedIn.length ? (
          <Link href={q({ who: "shared" })} className={chip(who === "shared")}>
            Shared with me
          </Link>
        ) : null}
        <span className="mx-1 w-px self-stretch bg-border" />
        {[thisYear, thisYear - 1].map((y) => (
          <Link key={y} href={q({ year: String(y) })} className={chip(year === y)}>
            {y}
          </Link>
        ))}
        <Link href={q({ year: "all" })} className={chip(!year)}>
          All time
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Estimated" value={formatCentsWhole(tot.estimatedCents)} hint={`${tot.estimated} estimates`} />
        <Tile label="Won" value={formatCentsWhole(tot.wonCents)} hint={`${tot.won} deals · win rate ${pct(tot.winRate)}`} />
        <Tile label="Job costs" value={formatCentsWhole(tot.costCents)} />
        <Tile label="Profit" value={formatCentsWhole(tot.profitCents)} hint={`${pct(tot.margin)} margin`} dark />
        <Tile label="Avg won deal" value={tot.avgWonCents ? formatCentsWhole(tot.avgWonCents) : "—"} />
      </div>

      <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">By deal</h2>
      {shown.length === 0 ? (
        <EmptyState title="Nothing to show yet" description="Deals appear here once they have an estimate, a sold price or job costs." />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {shown.map(({ d, k }) => (
            <li key={d.id}>
              <Link href={`/deals/${d.deal_number}?tab=${k.won ? "job" : "estimate"}`} className="flex flex-col gap-1 px-3.5 py-3 active:bg-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">
                    #{d.deal_number} {d.contact?.name || d.title || "No name"}
                  </span>
                  <ScopeBadge scope={d.scope} />
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{k.won ? jobStatusLabel(d.job_status) : "Not won yet"}</span>
                </span>
                <span className="grid grid-cols-4 gap-2 text-xs">
                  <Num label="Estimate" v={k.estimatedCents} />
                  <Num label="Won" v={k.wonCents} />
                  <Num label="Costs" v={k.costCents} />
                  <Num
                    label={k.margin !== null ? `Profit ${pct(k.margin)}` : "Profit"}
                    v={k.won ? k.profitCents : null}
                    tone={k.won ? (k.profitCents < 0 ? "text-destructive" : "text-primary") : undefined}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const chip = (on: boolean) =>
  cn("flex h-10 items-center rounded-full px-3.5 text-sm font-semibold", on ? "bg-foreground text-background" : "bg-card ring-1 ring-border");

function Tile({ label, value, hint, dark }: { label: string; value: string; hint?: string; dark?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3.5", dark ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border")}>
      <p className={cn("text-xs font-medium", dark ? "opacity-80" : "text-muted-foreground")}>{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {hint ? <p className={cn("text-xs", dark ? "opacity-80" : "text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}

function Num({ label, v, tone }: { label: string; v: number | null; tone?: string }) {
  return (
    <span>
      <span className="block text-muted-foreground">{label}</span>
      <span className={cn("block font-semibold tabular-nums", tone)}>{v === null ? "—" : formatCentsWhole(v)}</span>
    </span>
  );
}
