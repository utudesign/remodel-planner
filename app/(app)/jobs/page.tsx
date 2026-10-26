import Link from "next/link";
import { ScopeBadge } from "@/components/deals/deal-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { formatCentsWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import { listJobs } from "@/server/queries/jobs";

export const metadata = { title: "Jobs" };

const DAY = 86400_000;
const t = (d: string) => new Date(`${d}T12:00:00Z`).getTime();
const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Every job on one screen (the "Asana" view): a bar from start to the last planned step,
 * filled as steps are done, a line for today, late steps in red. Tap a job for its timeline.
 */
export default async function JobsPage() {
  const s = await requireStaff();
  const jobs = await listJobs(s);
  const today = todayIn(s.timezone);
  const active = jobs.filter((j) => j.done < j.total);
  const finished = jobs.filter((j) => j.total > 0 && j.done === j.total);

  const starts = active.map((j) => t(j.startedOn));
  const ends = active.map((j) => t(j.lastPlanned ?? j.startedOn));
  const from = Math.min(t(today) - 7 * DAY, ...starts);
  const to = Math.max(t(today) + 21 * DAY, ...ends);
  const span = Math.max(DAY, to - from);
  const pct = (ms: number) => `${Math.max(0, Math.min(100, ((ms - from) / span) * 100))}%`;
  const months: { label: string; at: number }[] = [];
  for (let d = new Date(from); d.getTime() <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDate() === 1) months.push({ label: d.toLocaleDateString("en-US", { month: "short" }), at: d.getTime() });
  }

  return (
    <>
      <PageHeader title="Jobs" description="Every job after the hand-off or the signed contract. Red = a step is late." />
      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="A job starts from a deal's Job tab once it's handed off (or, for RenoDesign's own deals, once the contract is signed)."
        />
      ) : null}

      {active.length ? (
        <section className="mb-6 flex flex-col gap-2">
          <div className="relative ml-[40%] h-5 text-[11px] font-semibold text-muted-foreground sm:ml-[30%]">
            {months.map((m) => (
              <span key={m.at} className="absolute -translate-x-1/2" style={{ left: pct(m.at) }}>
                {m.label}
              </span>
            ))}
          </div>
          <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {active.map((j) => {
              const start = t(j.startedOn);
              const end = t(j.lastPlanned ?? j.startedOn);
              const left = ((start - from) / span) * 100;
              const width = Math.max(2, ((end - start) / span) * 100);
              return (
                <li key={j.dealId}>
                  <Link href={`/deals/${j.number}?tab=job`} className="flex min-h-16 items-center gap-2 px-3 py-2 active:bg-secondary">
                    <div className="w-[40%] min-w-0 shrink-0 sm:w-[30%]">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                        {j.name} <ScopeBadge scope={j.scope} />
                      </p>
                      <p className={cn("truncate text-xs", j.late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                        {j.next ? `${j.late ? `${j.late} late · ` : ""}${j.next.label}${j.next.planned_on ? ` ${short(j.next.planned_on)}` : ""}` : "All done"}
                      </p>
                    </div>
                    <div className="relative h-7 flex-1">
                      <span className="absolute inset-y-0 w-px bg-destructive/60" style={{ left: pct(t(today)) }} aria-hidden />
                      <span
                        className={cn("absolute top-1.5 h-4 overflow-hidden rounded-full", j.late ? "bg-destructive/20" : "bg-accent")}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span
                          className={cn("block h-full rounded-full", j.late ? "bg-destructive" : "bg-primary")}
                          style={{ width: `${j.total ? (j.done / j.total) * 100 : 0}%` }}
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Bar = start → last planned step · filled part = steps done · red line = today</p>
        </section>
      ) : null}

      {active.length ? (
        <section className="mb-6 flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">In progress</h2>
          <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {active.map((j) => (
              <li key={j.dealId}>
                <Link href={`/deals/${j.number}?tab=job`} className="flex min-h-15 items-center gap-3 px-3.5 py-2.5 active:bg-secondary">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      #{j.number} {j.name}
                      {j.origin === "partner" ? <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[11px] font-bold">RenoDesign</span> : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {j.done}/{j.total} steps · {j.value ? formatCentsWhole(j.value) : "no price yet"}
                    </span>
                  </span>
                  {j.late ? <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">{j.late} late</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {finished.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Finished</h2>
          <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
            {finished.map((j) => (
              <li key={j.dealId}>
                <Link href={`/deals/${j.number}?tab=job`} className="flex min-h-14 items-center justify-between px-3.5 py-2 active:bg-secondary">
                  <span className="truncate font-medium">
                    #{j.number} {j.name}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{j.value ? formatCentsWhole(j.value) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
