import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FollowUpEditor } from "@/components/settings/follow-up-editor";
import { LookupEditor } from "@/components/settings/lookup-editor";
import { requirePageRole } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";
import { getStages } from "@/server/queries/settings";

export const metadata = { title: "Pipeline" };

export default async function PipelineSettingsPage() {
  const s = await requirePageRole("admin");
  const [stages, rules] = await Promise.all([
    getStages(s),
    s.db
      .from("follow_up_rules")
      .select("stage_id, sequence, offset_days, offset_hours, description")
      .order("sequence"),
  ]);
  const allRules = must(rules);
  const open = stages.filter((x) => x.active && x.key !== "won" && x.key !== "lost");
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Sales stages</CardTitle>
          <CardDescription>
            Rename or reorder. New, Contacted, Meeting Booked, Won and Lost can&apos;t be hidden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LookupEditor
            table="pipeline_stages"
            rows={stages}
            lockedKeys={["new", "contacted", "meeting_booked", "won", "lost"]}
            addLabel="Stage"
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Follow-up rules</CardTitle>
          <CardDescription>
            Counted from when a lead enters the stage. Day rules land at 9:00 AM ET. These pre-fill
            “Next follow-up” when you log a touch.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {open.map((st) => (
            <FollowUpEditor
              key={st.id}
              stageId={st.id}
              stageLabel={st.label}
              rules={allRules
                .filter((r) => r.stage_id === st.id)
                .map((r) => ({
                  offset_days: r.offset_days,
                  offset_hours: r.offset_hours,
                  description: r.description,
                }))}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
