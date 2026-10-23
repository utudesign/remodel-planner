"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
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
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { LEAD_SOURCES, SCOPES } from "@/lib/validation/lead";
import { createLead } from "@/server/actions/leads";

export function NewLeadDialog() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createLead, null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>Follow-up is set to 1 hour from now automatically.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="name" className="col-span-2">
            <Input id="name" name="name" required autoFocus autoComplete="off" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" inputMode="tel" />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Source" htmlFor="source">
            <NativeSelect id="source" name="source" defaultValue="call">
              {LEAD_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Scope" htmlFor="scope">
            <NativeSelect id="scope" name="scope" defaultValue="">
              <option value="">Not sure yet</option>
              {SCOPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Budget from ($)" htmlFor="budget_min">
            <Input id="budget_min" name="budget_min" inputMode="decimal" placeholder="8,000" />
          </Field>
          <Field label="Budget to ($)" htmlFor="budget_max">
            <Input id="budget_max" name="budget_max" inputMode="decimal" placeholder="12,000" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" />
          </Field>
          <Field label="Timeline" htmlFor="desired_timeline">
            <Input
              id="desired_timeline"
              name="desired_timeline"
              placeholder="Before Thanksgiving"
            />
          </Field>
          <Field label="Notes" htmlFor="notes" className="col-span-2">
            <Textarea
              id="notes"
              name="notes"
              placeholder="What they want, photos texted, who decides…"
            />
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Create lead</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
