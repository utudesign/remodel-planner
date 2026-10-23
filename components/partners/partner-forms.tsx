"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { invitePartner, savePartner, savePlan } from "@/server/actions/handoff";

type Partner = {
  id?: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  license_class: string | null;
};

export function PartnerForm({ p }: { p: Partner }) {
  const [state, action] = useActionState(savePartner, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="partner_id" value={p.id ?? ""} />
      <Field label="Company" htmlFor={`pn-${p.id}`} className="col-span-2">
        <Input id={`pn-${p.id}`} name="name" defaultValue={p.name} required />
      </Field>
      <Field label="Contact" htmlFor={`pc-${p.id}`}>
        <Input id={`pc-${p.id}`} name="contact_name" defaultValue={p.contact_name ?? ""} />
      </Field>
      <Field label="Phone" htmlFor={`pp-${p.id}`}>
        <Input id={`pp-${p.id}`} name="phone" type="tel" defaultValue={p.phone ?? ""} />
      </Field>
      <Field label="Email" htmlFor={`pe-${p.id}`} className="col-span-2">
        <Input id={`pe-${p.id}`} name="email" type="email" defaultValue={p.email ?? ""} />
      </Field>
      <Field label="DPOR license #" htmlFor={`pl-${p.id}`} hint="Prints on your client estimates">
        <Input id={`pl-${p.id}`} name="license_number" defaultValue={p.license_number ?? ""} />
      </Field>
      <Field label="Class" htmlFor={`pk-${p.id}`}>
        <NativeSelect id={`pk-${p.id}`} name="license_class" defaultValue={p.license_class ?? ""}>
          <option value="">—</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
        </NativeSelect>
      </Field>
      <div className="col-span-2 flex flex-col gap-2">
        <FormMessage state={state} />
        <SubmitButton variant="secondary">{p.id ? "Save partner" : "Add partner"}</SubmitButton>
      </div>
    </form>
  );
}

type Plan = { id?: string; name: string; rate: number; first_payout_pct: number; min_cents: number; active: boolean };

const pct = (n: number) => String(Math.round(Number(n) * 10000) / 100);

export function PlanForm({ partnerId, plan }: { partnerId: string; plan?: Plan }) {
  const [state, action] = useActionState(savePlan, null);
  const k = plan?.id ?? "new";
  return (
    <form action={action} className="grid grid-cols-3 gap-2 rounded-xl bg-secondary/60 p-3">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="plan_id" value={plan?.id ?? ""} />
      <Field label="Plan name" htmlFor={`n-${k}`} className="col-span-3">
        <Input id={`n-${k}`} name="name" defaultValue={plan?.name ?? ""} placeholder="Kitchens 2027" required />
      </Field>
      <Field label="Rate %" htmlFor={`r-${k}`}>
        <Input id={`r-${k}`} name="rate_pct" inputMode="decimal" defaultValue={plan ? pct(plan.rate) : "5"} />
      </Field>
      <Field label="% at deposit" htmlFor={`f-${k}`}>
        <Input id={`f-${k}`} name="first_payout_pct" inputMode="decimal" defaultValue={plan ? pct(plan.first_payout_pct) : "50"} />
      </Field>
      <Field label="Floor $" htmlFor={`m-${k}`}>
        <Input id={`m-${k}`} name="min_dollars" inputMode="decimal" defaultValue={plan ? String(plan.min_cents / 100) : "0"} />
      </Field>
      <label className="col-span-3 flex h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={plan?.active ?? true} className="size-5" /> In use
      </label>
      <p className="col-span-3 text-xs text-muted-foreground">
        Basis: contract price (sold price + approved change orders). The rest is earned when the client has paid in full.
      </p>
      <div className="col-span-3 flex flex-col gap-2">
        <FormMessage state={state} />
        <SubmitButton variant="secondary">{plan?.id ? "Save plan" : "Add plan"}</SubmitButton>
      </div>
    </form>
  );
}

export function InviteForm({ partnerId, email, name }: { partnerId: string; email: string | null; name: string | null }) {
  const [state, action] = useActionState(invitePartner, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="grid grid-cols-2 gap-2">
        <Input name="name" defaultValue={name ?? ""} placeholder="Crystal" aria-label="Name" />
        <Input name="email" type="email" defaultValue={email ?? ""} placeholder="crystal@renodesigninc.com" aria-label="Email" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Invite to log in</SubmitButton>
    </form>
  );
}
