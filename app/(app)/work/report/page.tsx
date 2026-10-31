import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { SiteRulesSummary } from "@/components/jobs/site-rules";
import { DailyReportForm } from "@/components/work/daily-report-form";
import { requireCrew } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { addDays, whenText } from "@/lib/jobs/pm";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { listWorkerJobs } from "@/server/queries/worker";

export const metadata = { title: "Daily report" };

/** Daily report (v3 F3): pick the job (skipped when there's one) → the form. */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const s = await requireCrew();
  const { job: picked } = await searchParams;
  const today = todayIn(s.timezone);
  const { jobs, tasks } = await listWorkerJobs(s);
  if (jobs.length === 0) {
    return (
      <>
        <PageHeader title="Daily report" />
        <EmptyState title="No jobs yet" description="When you have tasks on a job, report on it here." />
      </>
    );
  }
  const [reports, issueTypes] = await Promise.all([
    s.db.from("daily_reports").select("project_id, report_date, tomorrow_plan").eq("author_id", s.userId).gte("report_date", addDays(today, -1)).then(must),
    s.db.from("job_issue_types").select("key, label").eq("company_id", s.companyId).eq("active", true).order("sort_order").then(must),
  ]);
  const sentToday = new Set(reports.filter((r) => r.report_date === today).map((r) => r.project_id));
  // Jobs with a task of mine active today first.
  const activeToday = (pid: string) =>
    tasks.some((t) => t.project_id === pid && t.mine && t.status !== "done" && (!t.start_on || t.start_on <= today));
  const ordered = [...jobs].sort((a, b) => Number(activeToday(b.project_id)) - Number(activeToday(a.project_id)));
  const job = ordered.find((j) => j.project_id === picked) ?? (ordered.length === 1 ? ordered[0] : null);

  if (!job) {
    return (
      <>
        <PageHeader title="Daily report" description="Which job were you on today?" />
        <ul className="flex flex-col gap-2">
          {ordered.map((j) => (
            <li key={j.project_id}>
              <Link
                href={`/work/report?job=${j.project_id}`}
                className={cn("flex min-h-16 items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border", activeToday(j.project_id) && "ring-2 ring-primary/50")}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold text-muted-foreground">#{j.deal_number}</p>
                  <p className="truncate font-semibold">{j.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[j.address, j.city].filter(Boolean).join(", ")}</p>
                </div>
                {sentToday.has(j.project_id) ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="size-4" /> Sent
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  }

  const mine = tasks.filter(
    (t) => t.project_id === job.project_id && t.mine && (t.status !== "done" || t.pct < 100) && (!t.start_on || t.start_on <= addDays(today, 1)),
  );
  const yesterday = reports.find((r) => r.project_id === job.project_id && r.report_date !== today) ?? null;
  const rules = must(
    await s.db
      .from("site_rules")
      .select("building_type, hours, loud_until, hoa_contact, elevator, parking, debris, gate_code, pets, notes")
      .eq("deal_id", job.deal_id)
      .maybeSingle(),
  );
  return (
    <>
      <PageHeader
        title="Daily report"
        description={`#${job.deal_number} · ${job.name}${sentToday.has(job.project_id) ? " · already sent today (sending again replaces it)" : ""}`}
      />
      <div className="flex flex-col gap-4">
        {jobs.length > 1 ? (
          <Link href="/work/report" className="text-sm font-semibold text-primary">
            Other job
          </Link>
        ) : null}
        {yesterday?.tomorrow_plan ? (
          <p className="rounded-xl bg-secondary p-3 text-sm">
            <b>Your plan for today:</b> {yesterday.tomorrow_plan}
          </p>
        ) : null}
        <SiteRulesSummary rules={rules} compact />
        <DailyReportForm
          projectId={job.project_id}
          tasks={mine.map((t) => ({ id: t.id, title: t.title, pct: t.pct, when: whenText(t) }))}
          issueTypes={issueTypes}
          last={null}
        />
      </div>
    </>
  );
}
