import Link from "next/link";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requirePageRole } from "@/lib/auth/require-role";
import { computeFinancials } from "@/lib/margin";
import { formatBps, formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";

export const metadata = { title: "Analytics" };

/** Phase 1: per-project margin list. The company dashboard (charts, funnel, sources) is Phase 2. */
export default async function AnalyticsPage() {
  const s = await requirePageRole("owner", "team");
  const rows = must(
    await s.db
      .from("projects")
      .select(
        "id, name, status, contract_value_cents, closed_at, locked_revenue_cents, locked_cost_cents, locked_margin_bps, change_orders(price_change_cents, approved_at), costs(estimated_amount_cents, actual_amount_cents), payments(amount_cents, status)",
      )
      .order("created_at", { ascending: false }),
  );
  const target = s.settings.targetMarginBps;
  const projects = rows.map((p) => ({
    ...p,
    f: computeFinancials({
      contract_value_cents: p.contract_value_cents,
      change_orders: p.change_orders,
      costs: p.costs,
      payments: p.payments,
      locked:
        p.status === "closed"
          ? {
              revenue_cents: p.locked_revenue_cents,
              cost_cents: p.locked_cost_cents,
              margin_bps: p.locked_margin_bps,
            }
          : null,
    }),
  }));
  const closed = projects.filter((p) => p.status === "closed");
  const rev = closed.reduce((t, p) => t + p.f.revenueCents, 0);
  const profit = closed.reduce((t, p) => t + p.f.grossProfitCents, 0);
  const closedMargin = rev ? Math.round((profit * 10000) / rev) : null;
  const overBudget = projects.filter(
    (p) => p.f.estimatedCostCents > 0 && p.f.actualCostCents > p.f.estimatedCostCents * 1.1,
  ).length;

  return (
    <>
      <PageHeader
        title="Margin by project"
        description={`Target gross margin ${formatBps(target, 0)}. Charts and funnel come in Phase 2.`}
      />

      <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Closed jobs</dt>
          <dd className="font-semibold">{closed.length}</dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Closed revenue</dt>
          <dd className="font-semibold tabular-nums">{formatCents(rev)}</dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Closed margin</dt>
          <dd
            className={cn(
              "font-semibold",
              closedMargin !== null && closedMargin < target && "text-destructive",
            )}
          >
            {formatBps(closedMargin)}
          </dd>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Over budget &gt;10%</dt>
          <dd className={cn("font-semibold", overBudget && "text-destructive")}>{overBudget}</dd>
        </div>
      </dl>

      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Margins appear once a lead becomes a project."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Est. cost</TableHead>
                <TableHead className="text-right">Actual cost</TableHead>
                <TableHead className="text-right">Gross profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Balance due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => {
                const below = p.f.marginBps !== null && p.f.marginBps < target;
                const over =
                  p.f.estimatedCostCents > 0 && p.f.actualCostCents > p.f.estimatedCostCents * 1.1;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="max-w-56 truncate">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      {p.f.isLocked ? (
                        <Lock
                          className="ml-1 inline size-3 text-muted-foreground"
                          aria-label="Locked"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(p.f.revenueCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(p.f.estimatedCostCents)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        over && "font-semibold text-destructive",
                      )}
                    >
                      {formatCents(p.f.actualCostCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(p.f.grossProfitCents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={below ? "destructive" : "secondary"}>
                        {formatBps(p.f.marginBps)}
                      </Badge>
                      {!p.f.isLocked && p.f.projectedMarginBps !== null ? (
                        <p className="text-[11px] text-muted-foreground">
                          proj. {formatBps(p.f.projectedMarginBps)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        p.f.balanceDueCents > 0 && "font-medium",
                      )}
                    >
                      {formatCents(p.f.balanceDueCents)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Open projects show margin on actual costs entered so far, plus a projection that uses
        estimates for missing actuals. Closed projects show the locked margin.
      </p>
    </>
  );
}
