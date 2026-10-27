"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { JOB_STATUSES } from "@/lib/deals/display";
import { centsToInput } from "@/lib/money";
import { markSold, updateSale, type SaleResult } from "@/server/actions/sale";

/** Mark sold: price + contract date (+ deposit). If the database refuses, list what's missing (Add buttons sit above). */
export function MarkSoldForm({
  dealId,
  defaultPriceCents,
  today,
  ready,
}: {
  dealId: string;
  defaultPriceCents: number | null;
  today: string;
  ready: boolean;
}) {
  const [price, setPrice] = useState(centsToInput(defaultPriceCents));
  const [signed, setSigned] = useState(today);
  const [deposit, setDeposit] = useState("");
  const [res, setRes] = useState<SaleResult>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3">
      <Field label="Sold price ($)" htmlFor="ms_price" hint="The contract total the client signed">
        <Input id="ms_price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="18,500" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contract signed" htmlFor="ms_signed">
          <Input id="ms_signed" type="date" value={signed} onChange={(e) => setSigned(e.target.value)} />
        </Field>
        <Field label="Deposit received" htmlFor="ms_dep" hint="Leave empty if not yet">
          <Input id="ms_dep" type="date" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
        </Field>
      </div>
      {res && !res.ok ? (
        <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">
          <p className="font-semibold text-destructive">{res.error}</p>
          {res.missing ? (
            <>
              <ul className="mt-1 list-disc pl-5">
                {res.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">Use the Add buttons in the checklist above.</p>
            </>
          ) : null}
        </div>
      ) : null}
      {res?.ok ? <p className="text-sm font-semibold text-primary">{res.message}</p> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markSold({ deal_id: dealId, price, signed_on: signed, deposit_on: deposit });
            setRes(r);
            if (r?.ok) router.refresh();
          })
        }
        className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <BadgeCheck className="size-5" />} Mark sold + start the job
      </button>
      {!ready ? (
        <p className="text-xs text-muted-foreground">The checklist above has to be complete first.</p>
      ) : null}
    </div>
  );
}

export type SaleValues = {
  job_status: string;
  sold_price_cents: number | null;
  change_orders_cents: number;
  deposit_received_at: string | null;
  paid_in_full_at: string | null;
  job_completed_at: string | null;
  partner_note: string | null;
};

/** Sale + payments: what the client signed, change orders, and when the money came in. */
export function SaleForm({ dealId, v, tz }: { dealId: string; v: SaleValues; tz: string }) {
  const [state, action] = useActionState(updateSale, null);
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: tz }) : "");
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="deal_id" value={dealId} />
      <Field label="Job status" htmlFor="j_status">
        <NativeSelect id="j_status" name="job_status" defaultValue={v.job_status}>
          {JOB_STATUSES.map((j) => (
            <option key={j.key} value={j.key}>
              {j.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sold price ($)" htmlFor="j_sold">
          <Input id="j_sold" name="sold_price" inputMode="decimal" defaultValue={centsToInput(v.sold_price_cents)} />
        </Field>
        <Field label="Change orders ($)" htmlFor="j_co">
          <Input id="j_co" name="change_orders" inputMode="decimal" defaultValue={centsToInput(v.change_orders_cents)} />
        </Field>
        <Field label="Deposit received" htmlFor="j_dep">
          <Input id="j_dep" name="deposit_received_on" type="date" defaultValue={day(v.deposit_received_at)} />
        </Field>
        <Field label="Paid in full" htmlFor="j_paid">
          <Input id="j_paid" name="paid_in_full_on" type="date" defaultValue={day(v.paid_in_full_at)} />
        </Field>
        <Field label="Job completed" htmlFor="j_done">
          <Input id="j_done" name="completed_on" type="date" defaultValue={day(v.job_completed_at)} />
        </Field>
      </div>
      <Field label="Note" htmlFor="j_note">
        <Textarea id="j_note" name="partner_note" rows={2} defaultValue={v.partner_note ?? ""} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Save</SubmitButton>
    </form>
  );
}
