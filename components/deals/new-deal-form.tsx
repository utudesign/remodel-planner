"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AddressInput } from "@/components/shared/address-input";
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
  stage?: string;
};

export type StartStage = { key: string; label: string };

/** Friendlier names for where a new deal starts; unknown keys keep their Settings label. */
const START_LABELS: Record<string, string> = {
  new: "New lead (haven't replied yet)",
  qualified: "Talking (no visit yet)",
  visit_booked: "Visit booked",
  visit_done: "Visit done",
  estimate: "Estimate sent",
};

export function NewDealForm({ defaults = {}, stages }: { defaults?: NewDealDefaults; stages: StartStage[] }) {
  const [state, action] = useActionState(createDeal, null);
  const fallback = stages.some((s) => s.key === "visit_booked") ? "visit_booked" : (stages[0]?.key ?? "new");
  const [stage, setStage] = useState(defaults.stage && stages.some((s) => s.key === defaults.stage) ? defaults.stage : fallback);
  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Town read from a pasted message; used only when no address is picked. */}
      <input type="hidden" name="city" value={defaults.city ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" autoComplete="off" defaultValue={defaults.name} placeholder="Maria Gonzalez" />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} placeholder="(571) 555-0101" />
        </Field>
      </div>
      <Field label="Project address" htmlFor="address">
        <AddressInput id="address" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where it stands" htmlFor="stage">
          <NativeSelect id="stage" name="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {START_LABELS[s.key] ?? s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {stage === "visit_booked" ? (
          <Field label="Visit date + time" htmlFor="visit_at">
            <Input id="visit_at" name="visit_at" type="datetime-local" required />
          </Field>
        ) : null}
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
        <Field label="Where they found me" htmlFor="source">
          <NativeSelect id="source" name="source" defaultValue={defaults.source ?? "marketplace"}>
            {SOURCES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
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
