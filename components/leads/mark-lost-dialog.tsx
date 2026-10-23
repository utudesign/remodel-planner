"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { markLost } from "@/server/actions/leads";

export function MarkLostDialog({
  leadId,
  reasons,
  open,
  onOpenChange,
}: {
  leadId: string | null;
  reasons: { id: string; label: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action] = useActionWithSuccess(markLost, () => onOpenChange(false));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark lead as lost</DialogTitle>
          <DialogDescription>
            A reason is required. It feeds the lost-reasons report.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="lead_id" value={leadId ?? ""} />
          <Field label="Reason" htmlFor="lost_reason_id">
            <NativeSelect id="lost_reason_id" name="lost_reason_id" required defaultValue="">
              <option value="" disabled>
                Pick a reason…
              </option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Note (optional)" htmlFor="lost_note">
            <Textarea
              id="lost_note"
              name="lost_note"
              placeholder="e.g. Went with Home Depot install"
            />
          </Field>
          <FormMessage state={state} />
          <SubmitButton variant="destructive">Mark lost</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
