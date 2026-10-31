import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PmBoard, type BoardCard } from "@/components/jobs/pm-board";
import { TaskCheck } from "@/components/jobs/task-check";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import {
  addDays,
  bucketOf,
  crewConflicts,
  currentPhase,
  hoursWarnings,
  isLate,
  nextTask,
  progress,
  rulesSummary,
  type Bucket,
} from "@/lib/jobs/pm";
import { cn } from "@/lib/utils";
import { getPmSetup, listPmJobs } from "@/server/queries/jobs-pm";

export const metadata = { title: "Jobs" };

const VIEWS = [
  { key: "board", label: "Board" },
  { key: "timeline", label: "Timeline" },
  { key: "list", label: "List" },
  { key: "mine", label: "My work" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const short = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
// Phase colors for the Timeline bars (cycled by phase order).
const PHASE_COLORS = ["bg-sky-500", "bg-amber-500", "bg-emerald-600", "bg-blue-600", "bg-yellow-500", "bg-violet-500", "bg-fuchsia-600", "bg-teal-500", "bg-rose-500"];

/**
 * Jobs, Asana-style (change request v3 item 13): Board (columns = phase), Timeline (Gantt of every active job
 * with crew conflicts and site-rule warnings), List, and My work. Tap a job for its tasks.
 */
export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: v } = await searchParams;
  const view: View = VIEWS.find((x) => x.key === v)?.key ?? "board";
  const s = await requireStaff();
  const [jobs, setup] = await Promise.all([listPmJobs(s), getPmSetup(s)]);
  const today = todayIn(s.timezone);
  const nameOf = new Map(setup.people.map((p) => [p.id, p.name]));
  const allTasks = jobs.flatMap((j) => j.tasks);
  const conflicts = crewConflicts(allTasks);
  const jobOf = new Map(jobs.map((j) => [j.projectId, j]));
  const active = jobs.filter((j) => currentPhase(j.tasks, setup.phases) !== "done");

  return (
    <>
      <PageHeader title="Jobs" description="Every sold job: phases, tasks, who's on site and when." />
      <nav className="mb-4 flex gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="View">
        {VIEWS.map((x) => (
          <Link
            key={x.key}
            href={`/jobs?view=${x.key}`}
            className={cn(
              "flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold",
              view === x.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet" description="A job starts when you tap Mark sold on a deal's Job tab." />
      ) : view === "board" ? (
        <PmBoard
          columns={[...setup.phases.map((p) => ({ key: p.key, label: p.label })), { key: "done", label: "Done" }]}
          cards={jobs.map((j): BoardCard => {
            const n = nextTask(j.tasks);
            return {
              projectId: j.projectId,
              number: j.number,
              name: j.name,
              phase: currentPhase(j.tasks, setup.phases),
              pct: progress(j.tasks),
              next: n?.title ?? null,
              nextDate: n?.start_on ? short(n.start_on) : null,
              late: j.tasks.filter((t) => isLate(t, today)).length,
              warnings: j.tasks.filter((t) => conflicts.has(t.id) || hoursWarnings(t, j.rules).length).length,
              people: [...new Set(j.tasks.filter((t) => t.assignee_id && t.status !== "done").map((t) => initials(nameOf.get(t.assignee_id!) ?? "?")))],
            };
          })}
        />
      ) : view === "timeline" ? (
        <Timeline jobs={active} phases={setup.phases} today={today} conflicts={conflicts} />
      ) : view === "list" ? (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {jobs.map((j) => {
            const phase = currentPhase(j.tasks, setup.phases);
            const n = nextTask(j.tasks);
            const late = j.tasks.filter((t) => isLate(t, today)).length;
            return (
              <li key={j.projectId}>
                <Link href={`/deals/${j.number}?tab=job`} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5 active:bg-secondary">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      #{j.number} {j.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {phase === "done" ? "Done" : setup.phases.find((p) => p.key === phase)?.label} ·{" "}
                      {n ? `next ${n.title}${n.start_on ? ` ${short(n.start_on)}` : ""}` : "all tasks done"}
                    </span>
                    {j.rules ? <span className="block truncate text-xs text-amber-700">{rulesSummary(j.rules)}</span> : null}
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">{progress(j.tasks)}%</span>
                    {late ? <span className="rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-white">{late} late</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <MyWork
          tasks={allTasks.filter((t) => t.assignee_id === s.userId && t.status !== "done")}
          today={today}
          jobOf={jobOf}
          conflicts={conflicts}
        />
      )}
    </>
  );
}

function Timeline({
  jobs,
  phases,
  today,
  conflicts,
}: {
  jobs: Awaited<ReturnType<typeof listPmJobs>>;
  phases: { key: string; label: string; sort_order: number }[];
  today: string;
  conflicts: ReturnType<typeof crewConflicts>;
}) {
  if (!jobs.length) return <EmptyState title="No active jobs" description="Finished jobs are on the List view." />;
  const dated = jobs.flatMap((j) => j.tasks).filter((t) => t.start_on);
  const from = [addDays(today, -7), ...dated.map((t) => t.start_on!)].sort()[0];
  const to = [addDays(today, 35), ...dated.map((t) => t.end_on ?? t.start_on!)].sort().at(-1)!;
  const days = Math.max(14, (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1);
  const x = (d: string) => ((Date.parse(d) - Date.parse(from)) / 86_400_000 / days) * 100;
  const color = new Map(phases.map((p, i) => [p.key, PHASE_COLORS[i % PHASE_COLORS.length]]));
  const weeks: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 7)) weeks.push(d);
  return (
    <section className="flex flex-col gap-2">
      <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <div className="min-w-[720px] overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          <div className="relative ml-40 h-6 border-b text-[10px] font-semibold text-muted-foreground">
            {weeks.map((w) => (
              <span key={w} className="absolute top-1 -translate-x-1/2" style={{ left: `${x(w)}%` }}>
                {short(w)}
              </span>
            ))}
          </div>
          <ul className="divide-y">
            {jobs.map((j) => {
              const issues = j.tasks.filter((t) => conflicts.has(t.id) || hoursWarnings(t, j.rules).length);
              return (
                <li key={j.projectId} className="flex min-h-14 items-stretch">
                  <Link href={`/deals/${j.number}?tab=job`} className="flex w-40 shrink-0 flex-col justify-center border-r px-2.5 py-1.5">
                    <span className="truncate text-sm font-semibold">{j.name}</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      #{j.number} · {progress(j.tasks)}%
                      {issues.length ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                          <AlertTriangle className="size-3" /> {issues.length}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 w-px bg-destructive/70" style={{ left: `${x(today)}%` }} aria-hidden />
                    {j.tasks
                      .filter((t) => t.start_on)
                      .map((t, i) => {
                        const warn = conflicts.has(t.id) || hoursWarnings(t, j.rules).length > 0;
                        const end = addDays(t.end_on ?? t.start_on!, 1);
                        return (
                          <span
                            key={t.id}
                            title={`${t.title} · ${short(t.start_on)}${t.end_on && t.end_on !== t.start_on ? `–${short(t.end_on)}` : ""}${
                              conflicts.has(t.id) ? " · crew conflict" : ""
                            }`}
                            className={cn(
                              "absolute h-3 rounded-sm",
                              t.phase_key ? color.get(t.phase_key) : "bg-slate-400",
                              t.status === "done" && "opacity-40",
                              warn && "ring-2 ring-amber-500 ring-offset-1",
                              isLate(t, today) && "ring-2 ring-destructive ring-offset-1",
                            )}
                            style={{
                              left: `${x(t.start_on!)}%`,
                              width: `${Math.max(0.8, x(end) - x(t.start_on!))}%`,
                              top: `${8 + (i % 3) * 14}px`,
                            }}
                          />
                        );
                      })}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {phases.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1">
            <span className={cn("size-2.5 rounded-sm", color.get(p.key))} /> {p.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm ring-2 ring-amber-500" /> crew conflict / outside site hours
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-px bg-destructive" /> today
        </span>
      </div>
    </section>
  );
}

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "Next 7 days" },
  { key: "later", label: "Later" },
  { key: "nodate", label: "No date" },
];

function MyWork({
  tasks,
  today,
  jobOf,
  conflicts,
}: {
  tasks: Awaited<ReturnType<typeof listPmJobs>>[number]["tasks"];
  today: string;
  jobOf: Map<string, Awaited<ReturnType<typeof listPmJobs>>[number]>;
  conflicts: ReturnType<typeof crewConflicts>;
}) {
  if (!tasks.length) return <EmptyState title="Nothing assigned to you" description="Tasks you're assigned on any job show up here." />;
  return (
    <div className="flex flex-col gap-4">
      {BUCKETS.map((b) => {
        const list = tasks
          .filter((t) => bucketOf(t, today) === b.key)
          .sort((a, c) => (a.start_on ?? "9999").localeCompare(c.start_on ?? "9999"));
        if (!list.length) return null;
        return (
          <section key={b.key}>
            <h2 className={cn("mb-1 text-xs font-semibold tracking-wide uppercase", b.key === "overdue" ? "text-destructive" : "text-muted-foreground")}>
              {b.label} · {list.length}
            </h2>
            <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
              {list.map((t) => {
                const j = jobOf.get(t.project_id)!;
                const warn = [...hoursWarnings(t, j.rules), ...(conflicts.get(t.id) ?? []).map((o) => `also on #${jobOf.get(o.project_id)?.number}`)];
                return (
                  <li key={t.id} className="flex items-center gap-1 pr-3">
                    <TaskCheck id={t.id} done={false} label={t.title} />
                    <Link href={`/deals/${j.number}?tab=job`} className="min-w-0 flex-1 py-2">
                      <span className="block truncate font-medium">{t.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        #{j.number} {j.name}
                        {t.start_on ? ` · ${short(t.start_on)}${t.end_on && t.end_on !== t.start_on ? `–${short(t.end_on)}` : ""}` : ""}
                        {t.pct ? ` · ${t.pct}%` : ""}
                      </span>
                      {j.rules ? <span className="block truncate text-xs text-amber-700">{rulesSummary(j.rules)}</span> : null}
                      {warn.length ? <span className="block truncate text-xs font-semibold text-amber-600">⚠ {warn.join(" · ")}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
