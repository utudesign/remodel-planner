"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { saveRules } from "@/server/actions/settings";

export function RulesForm({ values }: { values: Record<string, string | number> }) {
  const [state, action] = useActionState(saveRules, null);
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="Quiet hours start (ET)" htmlFor="quiet_hours_start">
        <Input
          id="quiet_hours_start"
          name="quiet_hours_start"
          type="time"
          defaultValue={values.quiet_hours_start}
        />
      </Field>
      <Field label="Quiet hours end (ET)" htmlFor="quiet_hours_end">
        <Input
          id="quiet_hours_end"
          name="quiet_hours_end"
          type="time"
          defaultValue={values.quiet_hours_end}
        />
      </Field>
      <Field label="Reply to new leads within (min)" htmlFor="lead_response_minutes">
        <Input
          id="lead_response_minutes"
          name="lead_response_minutes"
          inputMode="numeric"
          defaultValue={values.lead_response_minutes}
        />
      </Field>
      <Field label="Design due after visit (days)" htmlFor="design_due_days">
        <Input
          id="design_due_days"
          name="design_due_days"
          inputMode="numeric"
          defaultValue={values.design_due_days}
        />
      </Field>
      <Field label="Travel buffer between visits (min)" htmlFor="visit_buffer_minutes">
        <Input
          id="visit_buffer_minutes"
          name="visit_buffer_minutes"
          inputMode="numeric"
          defaultValue={values.visit_buffer_minutes}
        />
      </Field>
      <div className="col-span-2 flex flex-col gap-2 sm:col-span-3">
        <FormMessage state={state} />
        <SubmitButton className="w-fit">Save</SubmitButton>
      </div>
    </form>
  );
}
