import Link from "next/link";
import { PmBoard, type BoardCard } from "@/components/jobs/pm-board";
import { TaskCheck } from "@/components/jobs/task-check";
import { TaskTimeline } from "@/components/jobs/job-workspace";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import {
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
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] lg:mx-0 lg:px-0" aria-label="View">
        {VIEWS.map((x) => (
          <Link
            key={x.key}
            href={`/jobs?view=${x.key}`}
            aria-current={view === x.key ? "page" : undefined}
            className={cn(
              "relative flex h-11 shrink-0 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground",
              view === x.key && "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
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
        active.length === 0 ? (
          <EmptyState title="No active jobs" description="Finished jobs are on the List view." />
        ) : (
          <TaskTimeline
            sections={active.map((j) => ({
              key: j.projectId,
              label: j.name,
              sub: `#${j.number} · ${progress(j.tasks)}% done`,
              href: `/jobs/${j.number}`,
              items: j.tasks,
            }))}
            trades={setup.trades}
            today={today}
            names={Object.fromEntries(nameOf)}
            warn={Object.fromEntries(
              active.flatMap((j) => j.tasks.map((t) => [t.id, hoursWarnings(t, j.rules).length + (conflicts.get(t.id)?.length ?? 0)])),
            )}
            taskHref={Object.fromEntries(active.flatMap((j) => j.tasks.map((t) => [t.id, `/jobs/${j.number}?view=list&task=${t.id}`])))}
          />
        )
      ) : view === "list" ? (
        <ul className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">
          {jobs.map((j) => {
            const phase = currentPhase(j.tasks, setup.phases);
            const n = nextTask(j.tasks);
            const late = j.tasks.filter((t) => isLate(t, today)).length;
            return (
              <li key={j.projectId}>
                <Link href={`/jobs/${j.number}`} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5 active:bg-secondary">
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
                    <Link href={`/jobs/${j.number}`} className="min-w-0 flex-1 py-2">
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
