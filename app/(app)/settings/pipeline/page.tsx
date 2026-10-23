import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FollowUpEditor } from "@/components/settings/follow-up-editor";
import { LookupEditor } from "@/components/settings/lookup-editor";
import { requireOwner } from "@/lib/auth/require-role";
import { getFollowUpRules, getLostReasonRows, getStageRows } from "@/server/queries/settings";

export const metadata = { title: "Stages & follow-ups" };

export default async function PipelineSettingsPage() {
  const s = await requireOwner();
  const [stages, reasons, rules] = await Promise.all([getStageRows(s), getLostReasonRows(s), getFollowUpRules(s)]);
  const withRules = stages.filter((x) => x.active && x.kind !== "lost");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-5">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>My stages</CardTitle>
            <CardDescription>Rename or reorder. Built-in stages (Lead, Visit booked/done, Ready, Handed off, Lost) can&apos;t be hidden.</CardDescription>
          </CardHeader>
          <CardContent>
            <LookupEditor
              table="pipeline_stages"
              rows={stages}
              lockedKeys={["new", "visit_booked", "visit_done", "ready", "handed_off", "lost"]}
              addLabel="Stage"
            />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Lost reasons</CardTitle>
            <CardDescription>Required when a deal is marked lost.</CardDescription>
          </CardHeader>
          <CardContent>
            <LookupEditor table="lost_reasons" rows={reasons} addLabel="Reason" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Follow-up rules</CardTitle>
          <CardDescription>
            When a deal enters a stage, or you log a call/text/visit, the next follow-up is set from the first rule.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {withRules.map((st) => (
            <FollowUpEditor
              key={st.key}
              stageKey={st.key}
              stageLabel={st.label}
              rules={rules
                .filter((r) => r.stage_key === st.key)
                .map((r) => ({ offset_days: r.offset_days, offset_hours: r.offset_hours, description: r.description }))}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
