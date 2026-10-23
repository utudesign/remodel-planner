"use client";

import { useActionState } from "react";
import { Camera } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { EXPENSE_CATEGORIES } from "@/lib/money-categories";
import { addExpense, addTrip, recordCommissionPayment } from "@/server/actions/money";

type DealOption = { id: string; label: string };

function PhotoField({ label }: { label: string }) {
  return (
    <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary font-semibold">
      <Camera className="size-5" /> {label}
      <input type="file" name="photo" accept="image/*,application/pdf" capture="environment" className="sr-only" />
    </label>
  );
}

function DealSelect({ deals, value }: { deals: DealOption[]; value?: string }) {
  return (
    <NativeSelect name="deal_id" defaultValue={value ?? ""} aria-label="Deal">
      <option value="">No deal</option>
      {deals.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label}
        </option>
      ))}
    </NativeSelect>
  );
}

export function PaymentForm({ dealId, owedDollars, today }: { dealId: string; owedDollars: string; today: string }) {
  const [state, action] = useActionState(recordCommissionPayment, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)" htmlFor="amount" hint="Negative for a clawback">
          <Input id="amount" name="amount" inputMode="decimal" defaultValue={owedDollars} required />
        </Field>
        <Field label="Received on" htmlFor="paid_on">
          <Input id="paid_on" name="paid_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="How" htmlFor="method">
          <NativeSelect id="method" name="method" defaultValue="zelle">
            <option value="zelle">Zelle</option>
            <option value="check">Check</option>
            <option value="ach">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </NativeSelect>
        </Field>
        <Field label="Reference" htmlFor="reference" hint="Check # or Zelle id">
          <Input id="reference" name="reference" />
        </Field>
      </div>
      <PhotoField label="Photo of the check (optional)" />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        Record payment
      </SubmitButton>
    </form>
  );
}

export function ExpenseForm({ deals, today }: { deals: DealOption[]; today: string }) {
  const [state, action] = useActionState(addExpense, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <PhotoField label="Receipt photo" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount ($)" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="decimal" required />
        </Field>
        <Field label="Date" htmlFor="spent_on">
          <Input id="spent_on" name="spent_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="Category" htmlFor="category">
          <NativeSelect id="category" name="category" defaultValue="marketing">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Where" htmlFor="vendor">
          <Input id="vendor" name="vendor" placeholder="Home Depot" />
        </Field>
      </div>
      <Field label="For a deal?" htmlFor="deal_id">
        <DealSelect deals={deals} />
      </Field>
      <Field label="Note" htmlFor="note">
        <Input id="note" name="note" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        Save expense
      </SubmitButton>
    </form>
  );
}

export function TripForm({ deals, today, dealId, purpose }: { deals: DealOption[]; today: string; dealId?: string; purpose?: string }) {
  const [state, action] = useActionState(addTrip, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Deal" htmlFor="deal_id">
        <DealSelect deals={deals} value={dealId} />
      </Field>
      <Field label="What for" htmlFor="purpose">
        <Input id="purpose" name="purpose" defaultValue={purpose ?? "Site visit"} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" htmlFor="trip_on">
          <Input id="trip_on" name="trip_on" type="date" defaultValue={today} required />
        </Field>
        <Field label="Miles (round trip)" htmlFor="miles">
          <Input id="miles" name="miles" inputMode="decimal" />
        </Field>
        <Field label="Odometer start" htmlFor="odo_start" hint="or use the odometer">
          <Input id="odo_start" name="odo_start" inputMode="numeric" />
        </Field>
        <Field label="Odometer end" htmlFor="odo_end">
          <Input id="odo_end" name="odo_end" inputMode="numeric" />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        Save trip
      </SubmitButton>
    </form>
  );
}
