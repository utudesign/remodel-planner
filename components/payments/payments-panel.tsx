"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, Undo2 } from "lucide-react";
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
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Field, FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { PaymentStatus } from "@/components/payments/payment-status";
import { ReceiveDialog } from "@/components/payments/receive-dialog";
import { centsToInput, formatCents } from "@/lib/money";
import { deletePayment, savePayment, undoPayment } from "@/server/actions/work";

type Payment = {
  id: string;
  label: string;
  amount_cents: number;
  due_trigger: string | null;
  due_date: string | null;
  received_on: string | null;
  method: string | null;
  check_number: string | null;
  status: string;
};

export function PaymentsPanel({
  projectId,
  payments,
  milestones,
  revenueCents,
  today,
  canEdit,
}: {
  projectId: string;
  payments: Payment[];
  milestones: { key: string; name: string }[];
  revenueCents: number;
  today: string;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const scheduled = payments.reduce((s, p) => s + p.amount_cents, 0);
  const mismatch = scheduled !== revenueCents;
  const milestoneName = (k: string | null) => milestones.find((m) => m.key === k)?.name ?? k;

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState message={error} /> : null}
      {mismatch ? (
        <p className="rounded-md border border-warning bg-warning/10 p-3 text-sm">
          Installments add up to <b>{formatCents(scheduled)}</b> but revenue is{" "}
          <b>{formatCents(revenueCents)}</b>. Adjust an installment so the balance can reach $0.
        </p>
      ) : null}
      {payments.length === 0 ? (
        <EmptyState title="No installments" />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {p.label} <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <PaymentStatus p={p} today={today} />
                  {p.status === "pending" && p.due_trigger ? (
                    <span>when {milestoneName(p.due_trigger)} is done</span>
                  ) : null}
                  {p.status === "received" ? (
                    <span>
                      {p.method}
                      {p.check_number ? ` #${p.check_number}` : ""}
                    </span>
                  ) : null}
                </div>
              </div>
              {canEdit ? (
                <div className="flex items-center gap-1">
                  {p.status !== "received" ? (
                    <>
                      <ReceiveDialog payment={p} today={today} />
                      <PaymentDialog projectId={projectId} payment={p} milestones={milestones} />
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Delete installment"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm(`Delete "${p.label}"?`)) return;
                          start(async () => {
                            const r = await deletePayment({ payment_id: p.id });
                            if (!r?.ok) setError(r?.error ?? "Could not delete");
                          });
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await undoPayment({ payment_id: p.id });
                          if (!r?.ok) setError(r?.error ?? "Could not undo");
                        })
                      }
                    >
                      <Undo2 /> Undo
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div>
          <PaymentDialog projectId={projectId} milestones={milestones} />
        </div>
      ) : null}
    </div>
  );
}

function PaymentDialog({
  projectId,
  payment,
  milestones,
}: {
  projectId: string;
  payment?: Payment;
  milestones: { key: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionWithSuccess(savePayment, () => setOpen(false));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {payment ? (
          <Button size="icon" variant="ghost" aria-label="Edit installment">
            <Pencil />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <Plus /> Installment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{payment ? "Edit installment" : "Add installment"}</DialogTitle>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="payment_id" value={payment?.id ?? ""} />
          <Field label="Label" htmlFor="label" className="col-span-2">
            <Input
              id="label"
              name="label"
              defaultValue={payment?.label}
              required
              placeholder="Change order #1"
            />
          </Field>
          <Field label="Amount ($)" htmlFor="amount">
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              defaultValue={centsToInput(payment?.amount_cents)}
              required
            />
          </Field>
          <Field label="Due when" htmlFor="due_trigger">
            <NativeSelect
              id="due_trigger"
              name="due_trigger"
              defaultValue={payment?.due_trigger ?? ""}
            >
              <option value="">On a date</option>
              {milestones
                .filter((m) => m.key !== "deposit_received" && m.key !== "closed")
                .map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name} done
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field
            label="Due date"
            htmlFor="due_date"
            hint="Used when 'On a date'"
            className="col-span-2"
          >
            <Input
              id="due_date"
              name="due_date"
              type="date"
              defaultValue={payment?.due_date ?? ""}
            />
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
