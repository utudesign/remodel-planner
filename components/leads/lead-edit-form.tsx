"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { centsToInput } from "@/lib/money";
import { LEAD_SOURCES, SCOPES } from "@/lib/validation/lead";
import { updateLead } from "@/server/actions/leads";

type Props = {
  lead: {
    id: string;
    source: string;
    scope: string | null;
    budget_min_cents: number | null;
    budget_max_cents: number | null;
    desired_timeline: string | null;
    notes: string | null;
    owner_id: string | null;
  };
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    zip: string | null;
  };
  team: { id: string; name: string }[];
};

export function LeadEditForm({ lead, contact, team }: Props) {
  const [state, action] = useActionState(updateLead, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="lead_id" value={lead.id} />
      <input type="hidden" name="contact_id" value={contact.id} />
      <Field label="Name" htmlFor="name" className="col-span-2">
        <Input id="name" name="name" defaultValue={contact.name} required />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
      </Field>
      <Field label="Address" htmlFor="address" className="col-span-2">
        <Input id="address" name="address" defaultValue={contact.address ?? ""} />
      </Field>
      <Field label="City" htmlFor="city">
        <Input id="city" name="city" defaultValue={contact.city ?? ""} />
      </Field>
      <Field label="ZIP" htmlFor="zip">
        <Input id="zip" name="zip" inputMode="numeric" defaultValue={contact.zip ?? ""} />
      </Field>
      <Field label="Source" htmlFor="source">
        <NativeSelect id="source" name="source" defaultValue={lead.source}>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Scope" htmlFor="scope">
        <NativeSelect id="scope" name="scope" defaultValue={lead.scope ?? ""}>
          <option value="">Not sure yet</option>
          {SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Budget from ($)" htmlFor="budget_min">
        <Input
          id="budget_min"
          name="budget_min"
          inputMode="decimal"
          defaultValue={centsToInput(lead.budget_min_cents)}
        />
      </Field>
      <Field label="Budget to ($)" htmlFor="budget_max">
        <Input
          id="budget_max"
          name="budget_max"
          inputMode="decimal"
          defaultValue={centsToInput(lead.budget_max_cents)}
        />
      </Field>
      <Field label="Timeline" htmlFor="desired_timeline">
        <Input
          id="desired_timeline"
          name="desired_timeline"
          defaultValue={lead.desired_timeline ?? ""}
        />
      </Field>
      <Field label="Owner" htmlFor="owner_id">
        <NativeSelect id="owner_id" name="owner_id" defaultValue={lead.owner_id ?? ""}>
          <option value="">Unassigned</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || "Unnamed"}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field
        label="Qualifying notes"
        htmlFor="notes"
        className="col-span-2"
        hint="Layout staying? Appliances new or kept? Who decides? Photos received?"
      >
        <Textarea id="notes" name="notes" rows={4} defaultValue={lead.notes ?? ""} />
      </Field>
      <div className="col-span-2 flex flex-col gap-2">
        <FormMessage state={state} />
        <SubmitButton variant="secondary">Save details</SubmitButton>
      </div>
    </form>
  );
}
