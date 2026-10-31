"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, PackageX } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveIssue } from "@/server/actions/daily-report";
import type { ReportFeedItem } from "@/server/queries/daily-reports";

/** Job tab: the workers' daily reports (v3 F3), newest first, with issues you can mark fixed. */
export function DailyReportFeed({ reports, dateLabel }: { reports: ReportFeedItem[]; dateLabel: Record<string, string> }) {
  if (reports.length === 0) return <p className="text-sm text-muted-foreground">No daily reports yet. Workers send them from their phone at the end of the day.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {reports.map((r) => (
        <li key={r.id} className="flex flex-col gap-1.5 border-b border-border/60 pb-3 last:border-0">
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">{r.author}</b> · {dateLabel[r.date] ?? r.date}
          </p>
          {r.progress.length ? (
            <ul className="text-sm">
              {r.progress.map((p, i) => (
                <li key={i}>
                  {p.title}: <span className="tabular-nums">{p.pct_before}% → <b>{p.pct_after}%</b></span>
                </li>
              ))}
            </ul>
          ) : null}
          {r.issues.map((i) => (
            <IssueRow key={i.id} issue={i} />
          ))}
          {r.tomorrow ? <p className="text-sm text-muted-foreground">Tomorrow: {r.tomorrow}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export function IssueRow({ issue: i }: { issue: { id: string; type: string; note: string; needs_reorder: boolean; resolved: boolean; photo?: string | null } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className={cn("flex gap-2 rounded-xl p-2 text-sm", i.resolved ? "bg-secondary text-muted-foreground" : "bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50")}>
      {i.needs_reorder ? <PackageX className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className={cn("font-semibold", i.resolved && "line-through")}>
          {i.type}
          {i.needs_reorder ? " · needs re-order" : ""}
        </p>
        {i.note ? <p className="break-words">{i.note}</p> : null}
        {i.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={i.photo} alt="" className="mt-1 max-h-40 rounded-lg" loading="lazy" />
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await resolveIssue({ id: i.id, resolved: !i.resolved });
            router.refresh();
          })
        }
        className="flex min-h-11 shrink-0 items-center gap-1 self-start rounded-lg bg-card px-2 text-xs font-semibold ring-1 ring-border"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {i.resolved ? "Reopen" : "Fixed"}
      </button>
    </div>
  );
}
