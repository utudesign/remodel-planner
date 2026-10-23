"use client";

import { useActionState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { updateMilestoneDates } from "@/server/actions/projects";
import type { MilestoneRow } from "@/server/queries/projects";

export function MilestoneDates({
  milestones,
  today,
  canEdit,
}: {
  milestones: MilestoneRow[];
  today: string;
  canEdit: boolean;
}) {
  return (
    <ol className="flex flex-col divide-y">
      {milestones.map((m) => (
        <MilestoneRowForm key={m.id} m={m} today={today} canEdit={canEdit && m.key !== "closed"} />
      ))}
    </ol>
  );
}

function MilestoneRowForm({
  m,
  today,
  canEdit,
}: {
  m: MilestoneRow;
  today: string;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(updateMilestoneDates, null);
  const late = !m.actual_date && !!m.planned_date && m.planned_date < today;
  return (
    <li className="py-2.5">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input type="hidden" name="milestone_id" value={m.id} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {m.actual_date ? (
            <CheckCircle2 className="size-5 shrink-0 text-success" />
          ) : (
            <Circle
              className={cn("size-5 shrink-0 text-muted-foreground", late && "text-destructive")}
            />
          )}
          <span className={cn("text-sm font-medium", late && "text-destructive")}>
            {m.name}
            {late ? " · late" : ""}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Planned
            <Input
              type="date"
              name="planned_date"
              defaultValue={m.planned_date ?? ""}
              disabled={!canEdit}
              className="h-9"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            Done on
            <Input
              type="date"
              name="actual_date"
              defaultValue={m.actual_date ?? ""}
              disabled={!canEdit}
              className="h-9"
            />
          </label>
          {canEdit ? (
            <SubmitButton size="sm" variant="secondary">
              Save
            </SubmitButton>
          ) : (
            <span />
          )}
        </div>
      </form>
      {state && !state.ok ? <FormMessage state={state} /> : null}
    </li>
  );
}
