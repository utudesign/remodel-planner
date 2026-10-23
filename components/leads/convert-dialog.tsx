"use client";

import { useActionState, useMemo, useState } from "react";
import { BadgeDollarSign } from "lucide-react";
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
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { buildPaymentSchedule, type TemplateItem } from "@/lib/payment-schedule";
import { PAYMENT_METHODS } from "@/lib/validation/project";
import { convertLead } from "@/server/actions/projects";

type Template = { id: string; name: string; items: TemplateItem[] };

/** The one link between sales and delivery (sitemap, yellow). */
export function ConvertDialog({
  leadId,
  defaultName,
  paymentTemplates,
  taskTemplates,
  today,
  highlight,
}: {
  leadId: string;
  defaultName: string;
  paymentTemplates: Template[];
  taskTemplates: { id: string; name: string; is_default: boolean }[];
  today: string;
  highlight: boolean;
}) {
  const [state, action] = useActionState(convertLead, null);
  const [contract, setContract] = useState("");
  const [templateId, setTemplateId] = useState(paymentTemplates[0]?.id ?? "");

  const preview = useMemo(() => {
    try {
      const cents = parseDollarsToCents(contract);
      if (!cents) return null;
      const t = paymentTemplates.find((p) => p.id === templateId);
      return buildPaymentSchedule(cents, t?.items ?? []);
    } catch {
      return null;
    }
  }, [contract, templateId, paymentTemplates]);

  const defaultTask = taskTemplates.find((t) => t.is_default)?.id ?? taskTemplates[0]?.id ?? "";

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className={highlight ? "bg-warning text-foreground hover:bg-warning/90" : undefined}
        >
          <BadgeDollarSign /> Deposit received
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Deposit received → create project</DialogTitle>
          <DialogDescription>
            Records the first check, marks the lead Won, and builds milestones, tasks and the
            payment schedule.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="deal_id" value={leadId} />
          <Field label="Project name" htmlFor="name" className="col-span-2">
            <Input id="name" name="name" defaultValue={defaultName} required />
          </Field>
          <Field label="Contract value ($)" htmlFor="contract_value">
            <Input
              id="contract_value"
              name="contract_value"
              inputMode="decimal"
              required
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              placeholder="36,000"
            />
          </Field>
          <Field label="Payment schedule" htmlFor="payment_template_id">
            <NativeSelect
              id="payment_template_id"
              name="payment_template_id"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              {paymentTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="">Single payment</option>
            </NativeSelect>
          </Field>
          {preview ? (
            <ul className="col-span-2 divide-y rounded-md border text-sm">
              {preview.map((p, i) => (
                <li key={i} className="flex justify-between px-3 py-1.5">
                  <span>
                    {p.label}
                    {i === 0 ? (
                      <span className="text-muted-foreground"> (received now)</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums">{formatCents(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <Field label="Received on" htmlFor="received_on">
            <Input id="received_on" name="received_on" type="date" defaultValue={today} required />
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
          <Field label="Planned start" htmlFor="planned_start_date">
            <Input id="planned_start_date" name="planned_start_date" type="date" />
          </Field>
          <Field label="Task template" htmlFor="task_template_id" className="col-span-2">
            <NativeSelect id="task_template_id" name="task_template_id" defaultValue={defaultTask}>
              {taskTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value="">No tasks</option>
            </NativeSelect>
          </Field>
          <div className="col-span-2 flex flex-col gap-2">
            <FormMessage state={state} />
            <SubmitButton>Create project</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
