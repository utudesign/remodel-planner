import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { WorkerTaskRow } from "@/components/work/worker-task";
import { requireCrew } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { bucketOf, isLate, whenText } from "@/lib/jobs/pm";
import { listWorkerJobs } from "@/server/queries/worker";

export const metadata = { title: "My work" };

const BUCKETS = [
  { key: "overdue", label: "Late" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
  { key: "nodate", label: "No date" },
] as const;

/** Worker home (v3 F1): my tasks across my jobs by when, then my jobs. No money anywhere (0022 views). */
export default async function WorkPage() {
  const s = await requireCrew();
  const today = todayIn(s.timezone);
  const { jobs, tasks } = await listWorkerJobs(s);
  const mine = tasks.filter((t) => t.mine && t.status !== "done");
  const jobName = new Map(jobs.map((j) => [j.project_id, j]));
  return (
    <>
      <PageHeader title={`Hi ${s.name.split(" ")[0] || "there"}`} description="Your tasks and jobs. Tap a job for the address, site rules and photos." />
      <div className="flex flex-col gap-6">
        {mine.length === 0 ? (
          <EmptyState title="No open tasks" description="When the office gives you a task, it shows up here." />
        ) : (
          BUCKETS.map((b) => {
            const list = mine.filter((t) => bucketOf(t, today) === b.key);
            if (!list.length) return null;
            return (
              <section key={b.key} className="flex flex-col gap-2">
                <h2 className={b.key === "overdue" ? "text-sm font-bold text-destructive" : "text-sm font-bold"}>
                  {b.label} <span className="text-muted-foreground">{list.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {list.map((t) => (
                    <div key={t.id} className="flex flex-col gap-1">
                      <Link href={`/work/${t.project_id}`} className="text-xs font-semibold text-muted-foreground">
                        #{jobName.get(t.project_id)?.deal_number} · {jobName.get(t.project_id)?.name}
                      </Link>
                      <WorkerTaskRow task={t} projectId={t.project_id} when={whenText(t)} late={isLate(t, today)} />
                    </div>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">My jobs</h2>
          {jobs.length === 0 ? (
            <EmptyState title="No jobs yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {jobs.map((j) => (
                <li key={j.project_id}>
                  <Link href={`/work/${j.project_id}`} className="flex min-h-16 items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-muted-foreground">#{j.deal_number}</p>
                      <p className="truncate font-semibold">{j.name}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {[j.address, j.city].filter(Boolean).join(", ") || "No address"}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${j.pct}%` }} />
                      </div>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
