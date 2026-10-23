"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { bookMeeting } from "@/server/actions/leads";

export function BookMeetingDialog({
  leadId,
  canMoveStage,
}: {
  leadId: string;
  canMoveStage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(bookMeeting, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlus /> Book meeting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Book a meeting</DialogTitle>
          <DialogDescription>Shows on Today for the day of the meeting.</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="lead_id" value={leadId} />
          <Field label="Type" htmlFor="type">
            <NativeSelect id="type" name="type" defaultValue="initial">
              <option value="initial">In-home measure</option>
              <option value="design_review">Design presentation</option>
              <option value="mid_check">Mid-project check</option>
              <option value="final">Final walkthrough</option>
            </NativeSelect>
          </Field>
          <Field label="When (Eastern Time)" htmlFor="scheduled_at">
            <Input id="scheduled_at" name="scheduled_at" type="datetime-local" required />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              placeholder="Parking, gate code, both decision makers?"
            />
          </Field>
          {canMoveStage ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="move_to_booked" defaultChecked className="size-4" />
              Move lead to “Meeting Booked” and remind me 24h before
            </label>
          ) : null}
          <FormMessage state={state} />
          <SubmitButton>Book</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
