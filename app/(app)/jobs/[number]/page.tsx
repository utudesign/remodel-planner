import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft, MapPin, Phone } from "lucide-react";
import { JobWorkspace, WorkspaceTabs } from "@/components/jobs/job-workspace";
import { parseView } from "@/lib/jobs/views";
import { SiteRulesSummary } from "@/components/jobs/site-rules";
import { requireStaff } from "@/lib/auth/require-role";
import { directionsUrl } from "@/lib/address";
import { formatDateTime, todayIn } from "@/lib/dates";
import { jobHealth } from "@/lib/jobs/colors";
import { crewConflicts, progress } from "@/lib/jobs/pm";
import { formatCentsWhole } from "@/lib/money";
import { signedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { listJobReports } from "@/server/queries/daily-reports";
import { getDealByNumber } from "@/server/queries/deals";
import { getJobPm, getPmSetup, getSiteRules, listPmJobs } from "@/server/queries/jobs-pm";

export const metadata = { title: "Job" };

/** One job, Asana-style (redesign 2026-11-01): Overview · List · Board · Timeline · Calendar · Dashboard. */
export default async function JobWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ view?: string; task?: string }>;
}) {
  const [{ number }, { view: v, task }] = await Promise.all([params, searchParams]);
  const view = parseView(v);
  const s = await requireStaff();
  const deal = await getDealByNumber(s, number);
  if (!deal) notFound();
  const pm = await getJobPm(s, deal.id);
  if (!pm) notFound();
  const today = todayIn(s.timezone);
  const [setup, rules, allJobs, reports] = await Promise.all([getPmSetup(s), getSiteRules(s, deal.id), listPmJobs(s), listJobReports(s, pm.projectId, 5)]);
  const photoUrls = await signedUrls(pm.comments.map((c) => c.photo_path).filter((x): x is string => !!x), s.companyId);

  const personOf = new Map(setup.people.map((p) => [p.id, p.name]));
  const numberOf = new Map(allJobs.map((j) => [j.projectId, j.number]));
  const conflictMap = crewConflicts(allJobs.flatMap((j) => j.tasks));
  const conflicts: Record<string, string[]> = {};
  for (const t of pm.tasks) {
    const others = conflictMap.get(t.id);
    if (others?.length) conflicts[t.id] = others.map((o) => `${personOf.get(o.assignee_id ?? "") ?? "Same person"} is also on #${numberOf.get(o.project_id) ?? "?"} (${o.title})`);
  }
  const health = jobHealth(pm.tasks, today);
  const pct = progress(pm.tasks);
  const name = deal.contact?.name || deal.title || "Job";
  const address = [deal.contact?.address, deal.contact?.city].filter(Boolean).join(", ");
  const members = [...new Set(pm.tasks.map((t) => t.assignee_id).filter((x): x is string => !!x))].map((id) => personOf.get(id) ?? "Someone");
  const rulesLite = rules ? { building_type: rules.building_type, hours: (rules.hours ?? {}) as never, loud_until: rules.loud_until } : null;
  const value = (deal.sold_price_cents ?? 0) + (deal.change_orders_cents ?? 0);
  const activity = [
    ...pm.comments.map((c) => ({
      at: c.created_at,
      text: `${(c.author_id && personOf.get(c.author_id)) || "Someone"} commented on “${pm.tasks.find((t) => t.id === c.task_id)?.title ?? "a task"}”`,
      sub: c.body,
    })),
    ...reports.map((r) => ({ at: r.created_at, text: `${r.author} sent a daily report`, sub: r.issues.length ? `${r.issues.length} issue(s)` : (r.tomorrow ?? "") })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  const overview = (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-bold">Job description</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {deal.scope ? `${deal.scope.replace("_", " ")} · ` : ""}
            {name}
            {address ? ` · ${address}` : ""}
            {value ? ` · contract ${formatCentsWhole(value)}` : ""}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums">{pct}%</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {address ? (
              <a href={directionsUrl(address)} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold">
                <MapPin className="size-4" /> Directions
              </a>
            ) : null}
            {deal.contact?.phone ? (
              <a href={`tel:${deal.contact.phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold">
                <Phone className="size-4" /> Call {name.split(" ")[0]}
              </a>
            ) : null}
            <Link href={`/deals/${number}?tab=job`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold">
              <ArrowUpRight className="size-4" /> Deal, payments, costs
            </Link>
          </div>
        </section>
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-bold">Site rules</h2>
          <div className="mt-2">
            <SiteRulesSummary rules={rules} />
          </div>
        </section>
        <section className="rounded-xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-bold">Job roles</h2>
          <ul className="mt-3 flex flex-wrap gap-4">
            {members.length === 0 ? <li className="text-sm text-muted-foreground">Nobody assigned yet. Assign tasks in List or Board.</li> : null}
            {members.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm">
                <span className="flex size-9 items-center justify-center rounded-full bg-violet-300 text-xs font-bold text-violet-950">
                  {m
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                {m}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <aside className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border">
        <h2 className="text-lg font-bold">What&apos;s the status?</h2>
        <div className="flex flex-wrap gap-2">
          {[
            { k: "on", l: "On track", d: "bg-emerald-500" },
            { k: "risk", l: "At risk", d: "bg-amber-500" },
            { k: "off", l: "Off track", d: "bg-rose-500" },
          ].map((x) => (
            <span key={x.k} className={cn("inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ring-1 ring-border", health.key === x.k ? "bg-secondary" : "opacity-50")}>
              <span className={cn("size-2 rounded-full", x.d)} /> {x.l}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Set from the tasks: late tasks or a blocked task → At risk; more than 3 days late → Off track.</p>
        <h3 className="mt-2 font-semibold">Recent activity</h3>
        {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
        <ul className="flex flex-col gap-3">
          {activity.map((a, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium">{a.text}</p>
              {a.sub ? <p className="line-clamp-2 text-muted-foreground">{a.sub}</p> : null}
              <p className="text-xs text-muted-foreground">{formatDateTime(a.at, s.timezone)}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/jobs" className="-ml-1 inline-flex h-9 items-center gap-0.5 text-sm font-medium text-muted-foreground">
          <ChevronLeft className="size-4" /> Jobs
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{name.slice(0, 1)}</span>
          <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">#{number}</span>
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ring-border">
            <span className={cn("size-2 rounded-full", health.dot)} /> {health.label}
          </span>
          <span className="text-sm text-muted-foreground tabular-nums">{pct}% done</span>
        </div>
      </div>
      <WorkspaceTabs base={`/jobs/${number}`} view={view} />
      <JobWorkspace
        view={view}
        projectId={pm.projectId}
        tasks={pm.tasks}
        phases={setup.phases}
        trades={setup.trades}
        people={setup.people}
        comments={pm.comments.map((c) => ({ ...c, photo_url: c.photo_path ? (photoUrls[c.photo_path] ?? null) : null }))}
        rules={rulesLite}
        today={today}
        conflicts={conflicts}
        overview={overview}
        initialTaskId={task && pm.tasks.some((t) => t.id === task) ? task : null}
      />
    </div>
  );
}
