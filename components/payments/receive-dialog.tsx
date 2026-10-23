"use client";

import { useState } from "react";
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
import { centsToInput, formatCents } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/validation/project";
import { receivePayment } from "@/server/actions/work";

export function ReceiveDialog({
  payment,
  today,
  projectName,
}: {
  payment: { id: string; label: string; amount_cents: number };
  today: string;
  projectName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(receivePayment, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Record</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {projectName ? `${projectName} · ` : ""}
            {payment.label} · {formatCents(payment.amount_cents)}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="payment_id" value={payment.id} />
          <Field label="Received on" htmlFor="received_on">
            <Input id="received_on" name="received_on" type="date" defaultValue={today} required />
          </Field>
          <Field label="Amount ($)" htmlFor="amount" hint="Change only if the check differs">
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              defaultValue={centsToInput(payment.amount_cents)}
            />
          </Field>
          <Field label="Method" htmlFor="method">
            <NativeSelect id="method" name="method" defaultValue="check">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Check #" htmlFor="check_number">
            <Input id="check_number" name="check_number" inputMode="numeric" />
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Mark received</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
