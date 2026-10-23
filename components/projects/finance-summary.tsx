import { Lock } from "lucide-react";
import { formatBps, formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Financials } from "@/lib/margin";

export function FinanceSummary({ f, targetBps }: { f: Financials; targetBps: number }) {
  const margin = f.marginBps;
  const below = margin !== null && margin < targetBps;
  const tiles = [
    { label: "Revenue", value: formatCents(f.revenueCents) },
    { label: "Collected", value: formatCents(f.collectedCents) },
    { label: "Balance due", value: formatCents(f.balanceDueCents), warn: f.balanceDueCents !== 0 },
    { label: "Estimated cost", value: formatCents(f.estimatedCostCents) },
    { label: "Actual cost", value: formatCents(f.actualCostCents) },
    { label: "Gross profit", value: formatCents(f.grossProfitCents) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl border bg-card p-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Gross margin {f.isLocked ? <Lock className="size-3" /> : null}
            {f.isLocked ? "locked at close" : "so far"}
          </p>
          <p className={cn("text-3xl font-semibold tabular-nums", below && "text-destructive")}>
            {formatBps(margin)}
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Target {formatBps(targetBps, 0)}</p>
          {!f.isLocked && f.projectedMarginBps !== null ? (
            <p>Projected (estimates for missing actuals): {formatBps(f.projectedMarginBps)}</p>
          ) : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                t.warn && "underline decoration-warning decoration-2 underline-offset-4",
              )}
            >
              {t.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
