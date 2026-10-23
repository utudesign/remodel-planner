"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { saveCompany } from "@/server/actions/settings";

export function CompanyForm({ name, targetMarginBps }: { name: string; targetMarginBps: number }) {
  const [state, action] = useActionState(saveCompany, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
      <Field label="Company name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>
      <Field label="Target margin %" htmlFor="target_margin_pct">
        <Input
          id="target_margin_pct"
          name="target_margin_pct"
          inputMode="decimal"
          defaultValue={targetMarginBps / 100}
        />
      </Field>
      <SubmitButton>Save</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
