"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import type { CompanySettings } from "@/lib/auth/require-role";
import { saveCompany } from "@/server/actions/settings";

export function CompanyForm({ name, settings: st }: { name: string; settings: CompanySettings }) {
  const [state, action] = useActionState(saveCompany, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Company name" htmlFor="name" hint="Shown in the app header, texts ({brand}) and client estimates">
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
        <legend className="mb-2 text-sm font-semibold">Contractor license (printed on client estimates)</legend>
        <Field label="License number" htmlFor="lic">
          <Input id="lic" name="license_number" defaultValue={typeof st.raw.license_number === "string" ? st.raw.license_number : ""} />
        </Field>
        <Field label="Class" htmlFor="lic_class">
          <NativeSelect id="lic_class" name="license_class" defaultValue={typeof st.raw.license_class === "string" ? st.raw.license_class : ""}>
            <option value="">—</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
          </NativeSelect>
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
