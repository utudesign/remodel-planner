"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { TRADES } from "@/lib/validation/project";
import { saveTask } from "@/server/actions/work";

export type TaskForEdit = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  kind: string;
  priority: string;
  due_date: string | null;
  trade: string | null;
  milestone_id: string | null;
  assignee: { id: string; name: string } | null;
};

export function TaskDialog({
  projectId,
  task,
  kind = "task",
  milestones,
  team,
  trigger,
}: {
  projectId: string;
  task?: TaskForEdit;
  kind?: "task" | "punch";
  milestones: { id: string; name: string }[];
  team: { id: string; name: string }[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(saveTask, () => setOpen(false));
  const k = task?.kind ?? kind;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant={k === "punch" ? "outline" : "default"}>
            <Plus /> {k === "punch" ? "Punch item" : "Task"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit" : "Add"} {k === "punch" ? "punch list item" : "task"}
          </DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="task_id" value={task?.id ?? ""} />
          <input type="hidden" name="kind" value={k} />
          <Field label="What" htmlFor="title" className="col-span-2">
            <Input id="title" name="title" defaultValue={task?.title} required autoFocus />
          </Field>
          <Field label="Who (trade)" htmlFor="trade">
            <Input
              id="trade"
              name="trade"
              list="trades"
              defaultValue={task?.trade ?? ""}
              placeholder="Install crew"
            />
            <datalist id="trades">
              {TRADES.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Team member" htmlFor="assignee_id">
            <NativeSelect
              id="assignee_id"
              name="assignee_id"
              defaultValue={task?.assignee?.id ?? ""}
            >
              <option value="">—</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Due" htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
          </Field>
          <Field label="Status" htmlFor="status">
            <NativeSelect id="status" name="status" defaultValue={task?.status ?? "todo"}>
              <option value="todo">To do</option>
              <option value="doing">Doing</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
            </NativeSelect>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <NativeSelect id="priority" name="priority" defaultValue={task?.priority ?? "normal"}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </NativeSelect>
          </Field>
          <Field label="Milestone" htmlFor="milestone_id">
            <NativeSelect
              id="milestone_id"
              name="milestone_id"
              defaultValue={task?.milestone_id ?? ""}
            >
              <option value="">—</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notes" htmlFor="description" className="col-span-2">
            <Textarea
              id="description"
              name="description"
              defaultValue={task?.description ?? ""}
              placeholder="Why is it blocked? What's needed?"
            />
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>{task ? "Save" : "Add"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
