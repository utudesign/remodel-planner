"use client";

import { useState, useTransition } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { centsToInput } from "@/lib/money";
import { setProjectMembers, updateProjectHeader } from "@/server/actions/projects";

export function ProjectSettings({
  project,
  team,
  memberIds,
}: {
  project: {
    id: string;
    name: string;
    contract_value_cents: number;
    project_manager_id: string | null;
  };
  team: { id: string; name: string; role: string }[];
  memberIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(updateProjectHeader, () => setOpen(false));
  const [members, setMembers] = useState(memberIds);
  const [pending, start] = useTransition();
  const field = team.filter((u) => u.role === "field");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project details</DialogTitle>
          <DialogDescription>
            Contract value changes the balance due; add change orders as extra installments.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="project_id" value={project.id} />
          <Field label="Name" htmlFor="name" className="col-span-2">
            <Input id="name" name="name" defaultValue={project.name} required />
          </Field>
          <Field label="Contract value ($)" htmlFor="contract_value">
            <Input
              id="contract_value"
              name="contract_value"
              inputMode="decimal"
              defaultValue={centsToInput(project.contract_value_cents)}
              required
            />
          </Field>
          <Field label="Project manager" htmlFor="project_manager_id">
            <NativeSelect
              id="project_manager_id"
              name="project_manager_id"
              defaultValue={project.project_manager_id ?? ""}
            >
              <option value="">—</option>
              {team
                .filter((u) => u.role !== "field")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
        {field.length > 0 ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <p className="text-sm font-medium">Field logins on this job</p>
            {field.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={members.includes(u.id)}
                  onChange={(e) =>
                    setMembers((m) =>
                      e.target.checked ? [...m, u.id] : m.filter((x) => x !== u.id),
                    )
                  }
                />
                {u.name}
              </label>
            ))}
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              disabled={pending}
              onClick={() =>
                start(
                  async () =>
                    void (await setProjectMembers({ project_id: project.id, user_ids: members })),
                )
              }
            >
              Save crew access
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
