"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Loader2, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { centsToInput, formatCents, formatCentsWhole, parseDollarsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { paymentText, smsHref } from "@/lib/jobs/payments";
import {
  addPaymentSchedule,
  deleteInstallment,
  markInstallmentPaid,
  markLinkSent,
  saveInstallment,
  setPaymentLink,
} from "@/server/actions/payments";

export type Installment = {
  id: string;
  label: string;
  amount_cents: number;
  due_date: string | null;
  received_at: string | null;
  link_url: string | null;
  link_sent_at: string | null;
  provider: string | null;
  provider_ref: string | null;
  receipt_number: string | null;
  status: string;
};

/** Job tab → Installments (v3 G): plan, link, text, mark paid. No money ever reaches a worker login. */
export function Installments({
  projectId,
  number,
  rows,
  revenueCents,
  clientName,
  clientPhone,
  company,
  today,
}: {
  projectId: string;
  number: string;
  rows: Installment[];
  revenueCents: number;
  clientName: string | null;
  clientPhone: string | null;
  company: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const act = (fn: () => Promise<{ ok: boolean; error?: string } | null | undefined>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r && !r.ok) setError(r.error ?? "Couldn't save");
      router.refresh();
    });
  const planned = rows.reduce((a, r) => a + r.amount_cents, 0);
  const paid = rows.filter((r) => r.received_at).reduce((a, r) => a + r.amount_cents, 0);

  return (
    <div className="flex flex-col gap-3">
      {rows.length ? (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span>
              Paid <b>{formatCentsWhole(paid)}</b> of {formatCentsWhole(revenueCents || planned)}
            </span>
            {revenueCents && planned !== revenueCents ? (
              <span className="font-semibold text-amber-700">Plan {planned > revenueCents ? "over" : "short"} by {formatCentsWhole(Math.abs(planned - revenueCents))}</span>
            ) : null}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.round((paid / Math.max(1, revenueCents || planned)) * 100))}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-secondary p-3 text-sm">
          <p>No installments yet.</p>
          <Button type="button" disabled={pending || !revenueCents} onClick={() => act(() => addPaymentSchedule({ project_id: projectId, number }))}>
            {pending ? <Loader2 className="animate-spin" /> : null} Use the standard schedule
          </Button>
          {!revenueCents ? <p className="text-xs text-muted-foreground">Set the sold price first (Sale + payments).</p> : null}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <Row key={r.id} r={r} pending={pending} act={act} projectId={projectId} number={number} clientName={clientName} clientPhone={clientPhone} company={company} today={today} />
        ))}
      </ul>
      {adding ? (
        <EditForm
          projectId={projectId}
          number={number}
          onDone={() => setAdding(false)}
          act={act}
          pending={pending}
          initial={{ label: "", amount_cents: Math.max(0, (revenueCents || 0) - planned), due_date: null }}
        />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
          <Plus /> Add installment
        </Button>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function Row({
  r,
  pending,
  act,
  projectId,
  number,
  clientName,
  clientPhone,
  company,
  today,
}: {
  r: Installment;
  pending: boolean;
  act: (fn: () => Promise<{ ok: boolean; error?: string } | null | undefined>) => void;
  projectId: string;
  number: string;
  clientName: string | null;
  clientPhone: string | null;
  company: string;
  today: string;
}) {
  const [mode, setMode] = useState<null | "edit" | "link" | "paid">(null);
  const [link, setLink] = useState(r.link_url ?? "");
  const [on, setOn] = useState(today);
  const [provider, setProvider] = useState<"melio" | "check" | "cash" | "zelle" | "other">("melio");
  const [ref, setRef] = useState("");
  const paid = !!r.received_at;
  const overdue = !paid && !!r.due_date && r.due_date < today;
  return (
    <li className={cn("flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border", overdue && "ring-destructive/60", paid && "bg-secondary/60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.label}</p>
          <p className={cn("text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {paid
              ? `Paid ${new Date(r.received_at!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${r.provider ? ` · ${r.provider}` : ""}${r.provider_ref ? ` · ref ${r.provider_ref}` : ""}${r.receipt_number ? ` · ${r.receipt_number}` : ""}`
              : `${r.due_date ? `Due ${new Date(`${r.due_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "No due date"}${overdue ? " · overdue" : ""}${r.link_sent_at ? " · link sent" : r.link_url ? " · link ready" : ""}`}
          </p>
        </div>
        <span className="shrink-0 font-bold tabular-nums">{formatCents(r.amount_cents)}</span>
      </div>
      {!paid ? (
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setMode(mode === "link" ? null : "link")}>
            <Link2 /> {r.link_url ? "Link" : "Add link"}
          </Button>
          {r.link_url ? (
            <a
              href={smsHref(clientPhone, paymentText({ label: r.label, amount_cents: r.amount_cents, link_url: r.link_url }, clientName, company))}
              onClick={() => act(() => markLinkSent({ id: r.id }))}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 text-sm font-semibold text-primary-foreground"
            >
              <MessageSquareText className="size-4" /> Text it
            </a>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" variant="secondary" onClick={() => setMode(mode === "paid" ? null : "paid")}>
            <Check /> Paid
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="self-start" disabled={pending} onClick={() => act(() => markInstallmentPaid({ id: r.id, paid: false }))}>
          Mark unpaid
        </Button>
      )}
      {mode === "link" ? (
        <div className="flex gap-2">
          <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://… (from Melio → Get paid → Share link)" inputMode="url" />
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              act(() => setPaymentLink({ id: r.id, url: link.trim() || null }));
              setMode(null);
            }}
          >
            Save
          </Button>
        </div>
      ) : null}
      {mode === "paid" ? (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={on} onChange={(e) => setOn(e.target.value)} aria-label="Paid on" />
          <NativeSelect value={provider} onChange={(e) => setProvider(e.target.value as typeof provider)} aria-label="How">
            <option value="melio">Melio</option>
            <option value="check">Check</option>
            <option value="zelle">Zelle</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </NativeSelect>
          <Input
            className="col-span-2"
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder={provider === "check" ? "Check number" : provider === "melio" ? "Melio payment reference" : "Reference (optional)"}
          />
          <Button
            type="button"
            className="col-span-2"
            disabled={pending}
            onClick={() => {
              act(() => markInstallmentPaid({ id: r.id, paid: true, on, provider, ref }));
              setMode(null);
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null} Mark {formatCents(r.amount_cents)} paid
          </Button>
        </div>
      ) : null}
      {!paid ? (
        mode === "edit" ? (
          <EditForm projectId={projectId} number={number} id={r.id} initial={r} onDone={() => setMode(null)} act={act} pending={pending} />
        ) : (
          <button type="button" onClick={() => setMode("edit")} className="self-start text-xs font-semibold text-primary">
            Edit
          </button>
        )
      ) : null}
    </li>
  );
}

function EditForm({
  projectId,
  number,
  id,
  initial,
  onDone,
  act,
  pending,
}: {
  projectId: string;
  number: string;
  id?: string;
  initial: { label: string; amount_cents: number; due_date: string | null };
  onDone: () => void;
  act: (fn: () => Promise<{ ok: boolean; error?: string } | null | undefined>) => void;
  pending: boolean;
}) {
  const [label, setLabel] = useState(initial.label);
  const [amount, setAmount] = useState(initial.amount_cents ? centsToInput(initial.amount_cents) : "");
  const [due, setDue] = useState(initial.due_date ?? "");
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/60 p-2">
      <Input className="col-span-2" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Deposit, Cabinet delivery…" aria-label="What for" />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" aria-label="Amount" />
      <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due" />
      <div className="col-span-2 flex gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            act(() =>
              saveInstallment({ id, project_id: projectId, number, label, amount_cents: parseDollarsToCents(amount) ?? 0, due_date: due || null }),
            );
            onDone();
          }}
        >
          Save
        </Button>
        {id ? (
          <Button type="button" variant="ghost" size="icon" aria-label="Delete installment" onClick={() => (act(() => deleteInstallment({ id })), onDone())}>
            <Trash2 />
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
