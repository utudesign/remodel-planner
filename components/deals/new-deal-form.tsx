"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { SCOPES, SOURCES } from "@/lib/deals/display";
import { createDeal } from "@/server/actions/deals";

export type NewDealDefaults = {
  name?: string;
  phone?: string;
  city?: string;
  source?: string;
  scope?: string;
  notes?: string;
};

export function NewDealForm({ defaults = {} }: { defaults?: NewDealDefaults }) {
  const [state, action] = useActionState(createDeal, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" autoComplete="off" defaultValue={defaults.name} placeholder="Maria Gonzalez" />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} placeholder="(571) 555-0101" />
        </Field>
        <Field label="Where they found me" htmlFor="source">
          <NativeSelect id="source" name="source" defaultValue={defaults.source ?? "marketplace"}>
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="What they want" htmlFor="scope">
          <NativeSelect id="scope" name="scope" defaultValue={defaults.scope ?? ""}>
            <option value="">Not sure yet</option>
            {SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Town" htmlFor="city">
          <Input id="city" name="city" defaultValue={defaults.city} placeholder="Fairfax" />
        </Field>
        <Field label="Address (optional)" htmlFor="address">
          <Input id="address" name="address" autoComplete="off" />
        </Field>
      </div>
      <Field label="Their message / notes" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={4} defaultValue={defaults.notes} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full sm:w-auto">
        Save deal
      </SubmitButton>
    </form>
  );
}
