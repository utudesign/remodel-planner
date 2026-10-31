import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CostList, MilestoneList, StartJobButton } from "@/components/jobs/job-parts";
import { PhaseTasks } from "@/components/jobs/phase-tasks";
import { SiteRulesForm, SiteRulesSummary } from "@/components/jobs/site-rules";
import { crewConflicts } from "@/lib/jobs/pm";
import { signedUrls } from "@/lib/storage";
import { getJobPm, getPmSetup, getSiteRules, listPmJobs, toRules } from "@/server/queries/jobs-pm";
import { requireStaff } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { jobMoney } from "@/lib/jobs";
import { formatCentsWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SaleForm } from "@/components/jobs/sale-forms";
import { getJob } from "@/server/queries/jobs";

/** Deal → Job tab once sold: money, sale + payments, timeline (milestones), tasks, costs. */
export async function JobTab({ dealId }: { dealId: string; number: string }) {
  const s = await requireStaff();
  const [job, dealRes] = await Promise.all([
    getJob(s, dealId),
    s.db
      .from("deals")
      .select("job_status, sold_price_cents, change_orders_cents, deposit_received_at, paid_in_full_at, job_completed_at, partner_note")
      .eq("id", dealId)
      .single(),
  ]);
  const deal = dealRes.data;
  if (!job) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start the job</CardTitle>
          <CardDescription>
            Creates the job timeline (contract → deposit → measure → design → order → delivery → install → countertops →
            walkthrough → paid), planned from today. Change any date after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StartJobButton dealId={dealId} />
        </CardContent>
      </Card>
    );
  }
  const today = todayIn(s.timezone);
  // Tasks by phase (v3 item 13): this job's tasks + comments; crew conflicts are checked against every job.
  const [pm, setup, rules, allJobs] = await Promise.all([getJobPm(s, dealId), getPmSetup(s), getSiteRules(s, dealId), listPmJobs(s)]);
  const photoUrls = pm ? await signedUrls(pm.comments.map((c) => c.photo_path).filter((x): x is string => !!x), s.companyId) : {};
  const conflictMap = crewConflicts(allJobs.flatMap((j) => j.tasks));
  const numberOf = new Map(allJobs.map((j) => [j.projectId, j.number]));
  const personOf = new Map(setup.people.map((p) => [p.id, p.name]));
  const conflictText: Record<string, string[]> = {};
  for (const t of pm?.tasks ?? []) {
    const others = conflictMap.get(t.id);
    if (others?.length) {
      conflictText[t.id] = others.map(
        (o) => `${personOf.get(o.assignee_id ?? "") ?? "Same person"} is also on #${numberOf.get(o.project_id) ?? "?"} (${o.title})`,
      );
    }
  }
  const money = jobMoney({
    soldCents: deal?.sold_price_cents ?? null,
    changeOrdersCents: deal?.change_orders_cents ?? 0,
    costs: job.costs.map((x) => x.actual_amount),
  });
  const done = job.milestones.filter((m) => m.done_on).length;
  const total = job.milestones.length;

  return (
    <>
      <div className="grid grid-cols-3 gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <Money label="Contract" value={money.revenueCents} hint={money.revenueCents ? "sold + change orders" : "set it below"} />
        <Money label="Job costs" value={money.costCents} />
        <Money
          label="Profit"
          value={money.profitCents}
          tone={money.profitCents < 0 ? "text-destructive" : "text-primary"}
          hint={money.margin !== null ? `${Math.round(money.margin * 100)}% margin` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Site rules</CardTitle>
          <CardDescription>Shown to workers at the top of the job and on their daily report.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <SiteRulesSummary rules={rules} />
          <details>
            <summary className="flex h-11 cursor-pointer items-center text-sm font-semibold text-primary">Edit site rules</summary>
            <SiteRulesForm dealId={dealId} rules={rules} />
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Checkpoints</CardTitle>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <MilestoneList
            items={job.milestones.map((m) => ({ id: m.id, label: m.label, planned_on: m.planned_on, done_on: m.done_on }))}
            today={today}
          />
          <p className="text-xs text-muted-foreground">
            Ticking Contract signed, Deposit, Cabinets ordered, Demo, Install, Walkthrough or Paid in full also updates the
            sale below, the Deals list and the KPIs.
          </p>
        </CardContent>
      </Card>

      {deal ? (
        <Card>
          <CardHeader>
            <CardTitle>Sale + payments</CardTitle>
            <CardDescription>What the client signed, change orders, and when the money came in.</CardDescription>
          </CardHeader>
          <CardContent>
            <SaleForm dealId={dealId} v={deal} tz={s.timezone} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Tasks by phase</CardTitle>
          <a href="/jobs?view=board" className="text-sm font-semibold text-primary">
            All jobs
          </a>
        </CardHeader>
        <CardContent>
          {pm ? (
            <PhaseTasks
              projectId={pm.projectId}
              tasks={pm.tasks}
              phases={setup.phases}
              trades={setup.trades}
              people={setup.people}
              comments={pm.comments.map((c) => ({ ...c, photo_url: c.photo_path ? (photoUrls[c.photo_path] ?? null) : null }))}
              rules={toRules(rules)}
              today={today}
              conflicts={conflictText}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Job costs</CardTitle>
          <span className="font-semibold tabular-nums">{formatCentsWhole(money.costCents)}</span>
        </CardHeader>
        <CardContent>
          <CostList
            projectId={job.project.id}
            categories={job.categories}
            costs={job.costs.map((x) => ({
              id: x.id,
              category: x.category,
              vendor: x.vendor,
              amount: x.actual_amount ?? 0,
              paid_on: x.paid_at ? x.paid_at.slice(0, 10) : null,
            }))}
          />
        </CardContent>
      </Card>
    </>
  );
}

function Money({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold tabular-nums", tone)}>{formatCentsWhole(value)}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
