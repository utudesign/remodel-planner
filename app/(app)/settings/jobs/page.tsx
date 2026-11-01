import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobPhasesEditor, PaymentStepsEditor, TradesEditor } from "@/components/settings/jobs-editor";
import { requireOwner } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export const metadata = { title: "Settings · Jobs" };

export default async function JobsSettings() {
  const s = await requireOwner();
  const [phases, trades, steps] = await Promise.all([
    s.db
      .from("job_phase_templates")
      .select("key, label, trade_key, start_offset_days, duration_days, active, sort_order")
      .eq("company_id", s.companyId)
      .order("sort_order")
      .then(must),
    s.db.from("trades").select("key, label, active, sort_order").eq("company_id", s.companyId).order("sort_order").then(must),
    s.db.from("payment_steps").select("key, label, pct, active, sort_order").eq("company_id", s.companyId).order("sort_order").then(must),
  ]);
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Job phases</CardTitle>
          <CardDescription>Every new job gets one task per phase, planned from its start day. Each job can add, remove or reorder tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <JobPhasesEditor
            phases={phases.map((p) => ({ key: p.key, label: p.label, trade_key: p.trade_key, start_offset_days: p.start_offset_days, duration_days: p.duration_days, active: p.active }))}
            trades={trades.filter((t) => t.active).map((t) => ({ key: t.key, label: t.label }))}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trades</CardTitle>
          <CardDescription>Installer, plumber, electrician… used on tasks and (soon) on worker logins.</CardDescription>
        </CardHeader>
        <CardContent>
          <TradesEditor trades={trades.map((t) => ({ key: t.key, label: t.label, active: t.active }))} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Payment schedule</CardTitle>
          <CardDescription>&quot;Use the standard schedule&quot; on a job splits the contract by these steps (rounded down; the last one takes the cents).</CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentStepsEditor steps={steps.map((x) => ({ key: x.key, label: x.label, pct: Number(x.pct), active: x.active }))} />
        </CardContent>
      </Card>
    </div>
  );
}
