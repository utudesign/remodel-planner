"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { submitLeadForm } from "@/server/actions/public";

const WHAT = [
  { key: "kitchen", label: "Full kitchen" },
  { key: "cabinets_only", label: "Cabinets only" },
  { key: "countertops", label: "Countertops" },
  { key: "bath", label: "Bathroom" },
];

export function LeadForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(submitLeadForm, null);
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
        <CheckCircle2 className="size-10 text-primary" />
        <p className="text-lg font-semibold">{state.message}</p>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
      <input type="hidden" name="slug" value={slug} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Phone (I'll text you)" htmlFor="phone">
        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required />
      </Field>
      <Field label="Town" htmlFor="city">
        <Input id="city" name="city" autoComplete="address-level2" placeholder="Fairfax" />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">What are you thinking about?</legend>
        <div className="grid grid-cols-2 gap-2">
          {WHAT.map((w) => (
            <label key={w.key} className="flex h-12 items-center gap-2 rounded-xl px-3 text-[15px] font-medium ring-1 ring-border has-checked:bg-accent has-checked:ring-primary">
              <input type="radio" name="scope" value={w.key} className="size-4 accent-[var(--primary)]" />
              {w.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Anything else? (size, timing, budget)" htmlFor="message">
        <Textarea id="message" name="message" rows={3} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        Get my free estimate
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">No spam. Your number is only used to set up the visit.</p>
    </form>
  );
}
