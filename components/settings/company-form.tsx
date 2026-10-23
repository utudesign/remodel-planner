"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import type { CompanySettings } from "@/lib/auth/require-role";
import { saveCompany } from "@/server/actions/settings";

export function CompanyForm({ name, settings: st }: { name: string; settings: CompanySettings }) {
  const [state, action] = useActionState(saveCompany, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Business name" htmlFor="name">
        <Input id="name" name="name" defaultValue={name} required />
      </Field>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-semibold">Day job (quiet hours, weekdays)</legend>
        <Field label="Starts" htmlFor="workday_start">
          <Input id="workday_start" name="workday_start" type="time" defaultValue={st.workday.start} />
        </Field>
        <Field label="Ends (daily digest)" htmlFor="workday_end">
          <Input id="workday_end" name="workday_end" type="time" defaultValue={st.workday.end} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-semibold">Visit slots clients can book</legend>
        <Field label="Weekday from" htmlFor="bws">
          <Input id="bws" name="booking_weekday_start" type="time" defaultValue={st.booking.weekday.start} />
        </Field>
        <Field label="Weekday to" htmlFor="bwe">
          <Input id="bwe" name="booking_weekday_end" type="time" defaultValue={st.booking.weekday.end} />
        </Field>
        <Field label="Saturday from" htmlFor="bss">
          <Input id="bss" name="booking_saturday_start" type="time" defaultValue={st.booking.saturday.start} />
        </Field>
        <Field label="Saturday to" htmlFor="bse">
          <Input id="bse" name="booking_saturday_end" type="time" defaultValue={st.booking.saturday.end} />
        </Field>
        <Field label="Visit length (minutes)" htmlFor="bmin">
          <Input id="bmin" name="booking_minutes" inputMode="numeric" defaultValue={st.booking.minutes} />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-semibold">My money</legend>
        <Field label="Tax set-aside %" htmlFor="tax" hint="Income tax + ~15.3% self-employment">
          <Input id="tax" name="tax_set_aside_pct" inputMode="decimal" defaultValue={st.taxSetAsidePct} />
        </Field>
        <Field label="Mileage rate (¢/mile)" htmlFor="mile" hint="IRS 2026: 72.5¢. Check each January.">
          <Input id="mile" name="mileage_rate_cents" inputMode="decimal" defaultValue={st.mileageRateCents} />
        </Field>
      </fieldset>

      <Field
        label="Auto-reply to new leads"
        htmlFor="auto_reply"
        hint="{first} = their first name, {link} = your booking link. Empty = the built-in message."
      >
        <Textarea id="auto_reply" name="auto_reply" rows={6} defaultValue={st.autoReply ?? ""} />
      </Field>

      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Save</SubmitButton>
    </form>
  );
}
