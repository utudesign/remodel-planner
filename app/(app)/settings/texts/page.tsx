import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextTemplateEditor, type TemplateRow } from "@/components/settings/text-template-editor";
import { EmptyState } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { TEXT_VARS } from "@/lib/texts";
import { getStages, getTextTemplates } from "@/server/queries/deals";

export const metadata = { title: "My texts" };

export default async function TextsSettingsPage() {
  const s = await requireOwner();
  const [templates, stages] = await Promise.all([getTextTemplates(s), getStages(s)]);
  const stageOptions = stages.filter((x) => x.active && x.kind !== "lost").map((x) => ({ key: x.key, label: x.label }));
  const order = new Map(stages.map((x, i) => [x.key, i]));
  const rows = [...(templates as TemplateRow[])].sort(
    (a, b) =>
      (order.get(a.stage_key ?? "") ?? 99) - (order.get(b.stage_key ?? "") ?? 99) ||
      (a.after_days ?? 999) - (b.after_days ?? 999) ||
      a.sort_order - b.sort_order,
  );
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>My texts</CardTitle>
          <CardDescription>
            Each deal shows these under &ldquo;Text&rdquo;. The ★ one is the next text for the deal&apos;s stage: day 0 is
            when the deal enters the stage, day 2 is two days later at 9 AM. Sending one moves the follow-up to the next
            one&apos;s day. Blank day = only when you pick it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Fill-ins:</p>
          <ul className="mt-1 grid gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
            {TEXT_VARS.map((v) => (
              <li key={v.key}>
                <code className="rounded bg-secondary px-1 font-mono text-[13px]">{`{${v.key}}`}</code>{" "}
                <span className="text-muted-foreground">{v.hint}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {rows.length ? null : <EmptyState title="No texts yet" description="Add your first one below." />}
      {rows.map((r) => (
        <TextTemplateEditor key={r.key} row={r} stages={stageOptions} />
      ))}
      <h2 className="mt-2 font-semibold">Add a text</h2>
      <TextTemplateEditor row={null} stages={stageOptions} />
    </div>
  );
}
