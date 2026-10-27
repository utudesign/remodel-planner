import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CostList, MilestoneList, StartJobButton, TaskList } from "@/components/jobs/job-parts";
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
  const money = jobMoney({
    soldCents: deal?.sold_price_cents ?? null,
    changeOrdersCents: deal?.change_orders_cents ?? 0,
    costs: job.costs.map((x) => x.actual_amount),
  });
  const done = job.milestones.filter((m) => m.done_on).length;
  const total = job.milestones.length;
  const people = job.people.map((p) => ({ id: p.id, name: p.name ?? "No name" }));
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

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
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Timeline</CardTitle>
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
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList
            projectId={job.project.id}
            today={today}
            people={people}
            tasks={job.tasks.map((t) => ({
              id: t.id,
              title: t.title ?? "",
              status: t.status ?? "todo",
              due_date: t.due_date,
              assignee: t.assignee_id ? (nameOf.get(t.assignee_id) ?? null) : null,
            }))}
          />
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
