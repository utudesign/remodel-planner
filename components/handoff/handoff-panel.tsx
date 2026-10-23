"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Handshake, Loader2, MessageSquare, Printer } from "lucide-react";
import { zipSync } from "fflate";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { JOB_STATUSES } from "@/lib/deals/display";
import { smsHref } from "@/lib/leads/auto-reply";
import { centsToInput, formatCents } from "@/lib/money";
import { handOff, updateJob, type HandoffResult } from "@/server/actions/handoff";

type Plan = { id: string; name: string; preview: number | null };
type Partner = { id: string; name: string; phone: string | null; plans: Plan[] };

/** Pick partner + plan → Hand off. If the database refuses, show what's missing (Add buttons sit just above). */
export function HandoffForm({ dealId, partners, defaultPlanId }: { dealId: string; partners: Partner[]; defaultPlanId: string | null }) {
  const first = partners.find((p) => p.plans.some((pl) => pl.id === defaultPlanId)) ?? partners[0];
  const [partnerId, setPartnerId] = useState(first?.id ?? "");
  const partner = partners.find((p) => p.id === partnerId);
  const [planId, setPlanId] = useState(
    partner?.plans.find((p) => p.id === defaultPlanId)?.id ?? partner?.plans[0]?.id ?? "",
  );
  const plan = partner?.plans.find((p) => p.id === planId);
  const [res, setRes] = useState<HandoffResult>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!partners.length) return <p className="text-sm text-muted-foreground">Add a partner under More → Partners first.</p>;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Partner" htmlFor="h_partner">
        <NativeSelect
          id="h_partner"
          value={partnerId}
          onChange={(e) => {
            setPartnerId(e.target.value);
            setPlanId(partners.find((p) => p.id === e.target.value)?.plans[0]?.id ?? "");
          }}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Commission plan" htmlFor="h_plan">
        <NativeSelect id="h_plan" value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {(partner?.plans ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {plan?.preview ? (
        <p className="rounded-xl bg-accent p-3 text-sm font-semibold text-accent-foreground">
          At the estimated price this pays you {formatCents(plan.preview)}.
        </p>
      ) : null}
      {res && !res.ok ? (
        <div role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm">
          <p className="font-semibold text-destructive">{res.error}</p>
          {res.missing ? (
            <ul className="mt-1 list-disc pl-5">
              {res.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
          {res.missing ? <p className="mt-1 text-muted-foreground">Use the Add buttons in the checklist above.</p> : null}
        </div>
      ) : null}
      <button
        type="button"
        disabled={pending || !planId}
        onClick={() =>
          start(async () => {
            const r = await handOff({ deal_id: dealId, partner_id: partnerId, plan_id: planId });
            setRes(r);
            if (r?.ok) router.refresh();
          })
        }
        className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Handshake className="size-5" />} Hand off to {partner?.name ?? "partner"}
      </button>
    </div>
  );
}

/** The hand-off packet: a text for Crystal, the photos as one ZIP, and a printable summary (PDF). */
export function PacketButtons({
  number,
  phone,
  summary,
  photos,
  zipName,
}: {
  number: string;
  phone: string | null;
  summary: string;
  photos: { url: string; name: string }[];
  zipName: string;
}) {
  const [zipping, setZipping] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function shareZip() {
    setZipping(true);
    setMsg(null);
    try {
      const files: Record<string, Uint8Array> = {};
      let i = 0;
      for (const p of photos) {
        const r = await fetch(p.url);
        if (!r.ok) continue;
        files[`${String(++i).padStart(2, "0")}-${p.name.replace(/[^\w.-]+/g, "-")}`] = new Uint8Array(await r.arrayBuffer());
      }
      const zip = zipSync(files, { level: 0 }); // JPEGs are already compressed
      const file = new File([zip.buffer as ArrayBuffer], `${zipName}.zip`, { type: "application/zip" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: zipName });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
      setMsg(`${i} photos zipped`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("Could not build the ZIP. Try again on Wi-Fi.");
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <a href={smsHref(phone, summary)} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary text-xs font-semibold">
          <MessageSquare className="size-5" /> Text summary
        </a>
        <button type="button" onClick={shareZip} disabled={zipping || !photos.length} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary text-xs font-semibold disabled:opacity-50">
          {zipping ? <Loader2 className="size-5 animate-spin" /> : <Archive className="size-5" />} Photos ZIP
        </button>
        <a href={`/deals/${number}/packet`} target="_blank" rel="noreferrer" className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary text-xs font-semibold">
          <Printer className="size-5" /> Packet PDF
        </a>
      </div>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}

export type JobValues = {
  job_status: string;
  sold_price_cents: number | null;
  change_orders_cents: number;
  deposit_received_at: string | null;
  paid_in_full_at: string | null;
  job_completed_at: string | null;
  partner_note: string | null;
};

/** Job progress: Crystal fills it in with her login, or I type what she texted me. */
export function JobForm({ dealId, v, tz }: { dealId: string; v: JobValues; tz: string }) {
  const [state, action] = useActionState(updateJob, null);
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
      <SubmitButton className="w-full sm:w-auto">Save job update</SubmitButton>
    </form>
  );
}
