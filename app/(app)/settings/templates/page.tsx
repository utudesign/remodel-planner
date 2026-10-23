import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentTemplateEditor } from "@/components/settings/payment-template-editor";
import { TaskTemplateEditor } from "@/components/settings/task-template-editor";
import { requirePageRole } from "@/lib/auth/require-role";
import {
  getMilestoneDefinitions,
  getPaymentTemplates,
  getTaskTemplates,
} from "@/server/queries/settings";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const s = await requirePageRole("admin");
  const [pay, tasks, milestones] = await Promise.all([
    getPaymentTemplates(s),
    getTaskTemplates(s),
    getMilestoneDefinitions(s),
  ]);
  const ms = milestones.map((m) => ({ key: m.key, label: m.label }));
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Payment schedules</CardTitle>
          <CardDescription>
            Picked when a deposit comes in. Changing a template doesn&apos;t change existing
            projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pay.map((t) => (
            <PaymentTemplateEditor key={t.id} template={t} milestones={ms} />
          ))}
          <details>
            <summary className="cursor-pointer text-sm font-medium">+ New payment schedule</summary>
            <div className="mt-2">
              <PaymentTemplateEditor milestones={ms} />
            </div>
          </details>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Task templates</CardTitle>
          <CardDescription>
            Copied into a new project. Each task is tied to the milestone it belongs to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tasks.map((t) => (
            <TaskTemplateEditor key={t.id} template={t} milestones={ms} />
          ))}
          <details>
            <summary className="cursor-pointer text-sm font-medium">+ New task template</summary>
            <div className="mt-2">
              <TaskTemplateEditor milestones={ms} />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
