import Link from "next/link";
import { formatCentsWhole } from "@/lib/money";
import { scopeInfo, sourceLabel, jobStatusLabel } from "@/lib/deals/display";
import { nextStep, type StageKind } from "@/lib/deals/segments";
import { cn } from "@/lib/utils";
import type { DealRow } from "@/server/queries/deals";

export function ScopeBadge({ scope, className }: { scope: string | null; className?: string }) {
  const info = scopeInfo(scope);
  if (!info) return null;
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-xs font-semibold", info.tone, className)}>{info.label}</span>
  );
}

/** One deal on the list: #26-1047, name, scope badge, value, next step, who's on it. */
export function DealCard({
  deal: d,
  stageKind,
  ownerName,
  sharedBy,
  now,
}: {
  deal: DealRow;
  stageKind: StageKind | undefined;
  /** First name of the person working the deal. */
  ownerName?: string | null;
  /** 0016: another workspace's name when this deal was shared with mine. */
  sharedBy?: string | null;
  now: Date;
}) {
  const step = nextStep({ ...d, stageKind }, now);
  const value = d.sold_price_cents ? d.sold_price_cents + d.change_orders_cents : d.estimated_value_cents;
  const name = d.contact?.name || d.title || "No name yet";
  return (
    <Link
      href={`/deals/${d.deal_number}`}
      className={cn(
        "block rounded-2xl bg-card px-3.5 py-3 shadow-xs ring-1 ring-border transition-colors active:bg-secondary",
        step.urgent && "ring-[1.5px] ring-destructive/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-muted-foreground tabular-nums">#{d.deal_number}</span>
        {value ? <span className="text-base font-bold tabular-nums">{formatCentsWhole(value)}</span> : null}
      </div>
      <p className="mt-0.5 truncate text-base font-semibold">{name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <ScopeBadge scope={d.scope} />
        {sharedBy ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">Shared · {sharedBy}</span>
        ) : null}
        {stageKind === "handed_off" ? (
          <span>{jobStatusLabel(d.job_status)}</span>
        ) : (
          <span>
            {sourceLabel(d.source)}
            {d.contact?.city ? ` · ${d.contact.city}` : ""}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[13px]">
        <span className={cn("font-semibold", step.urgent ? "text-destructive" : "text-muted-foreground")}>
          {step.label}
        </span>
        {ownerName ? <span className="shrink-0 text-muted-foreground">{ownerName}</span> : null}
      </div>
    </Link>
  );
}
