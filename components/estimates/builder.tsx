"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Loader2, Minus, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  addCustomLine,
  duplicateQuote,
  newQuickEstimate,
  removeLine,
  setLineQty,
  shareQuote,
} from "@/server/actions/estimates";
import type { ActionState } from "@/server/action-utils";

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>(null);
  const router = useRouter();
  const go = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      router.refresh();
    });
  return { pending, msg, go };
}

/**
 * New estimate (change request v3 item 10): starts empty. Brand + color first, then cabinets from the bulk-add
 * sheet; labor, countertop and accessories are one-tap suggestions, never pre-filled lines.
 */
export function NewEstimateForm({ dealId }: { dealId: string }) {
  const [state, action] = useActionState(newQuickEstimate, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        New estimate
      </SubmitButton>
      <p className="text-xs text-muted-foreground">Starts empty: pick the brand and color, then add cabinets.</p>
    </form>
  );
}

export function LineRow({
  line,
  locked,
}: {
  line: { id: string; code: string; name: string; qty: number; unit: string; price_cents: number; note?: string | null };
  locked: boolean;
}) {
  const { pending, go } = useAct();
  const [qty, setQty] = useState(Number(line.qty));
  const step = 1;
  const change = (next: number) => {
    const v = Math.max(0, Math.round(next * 100) / 100);
    setQty(v);
    go(() => setLineQty({ line_id: line.id, qty: v }));
  };
  return (
    <li className={cn("flex items-center gap-2 border-b border-border/60 py-2 last:border-0", qty === 0 && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">
          {line.code ? <span className="mr-1 font-bold text-muted-foreground">{line.code}</span> : null}
          {line.name}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {qty} {line.unit}
          · {formatCents(line.price_cents)}
        </p>
      </div>
      {!locked ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label="Less" disabled={pending} onClick={() => change(qty - step)} className="flex size-10 items-center justify-center rounded-lg bg-secondary">
            <Minus className="size-4" />
          </button>
          <button type="button" aria-label="More" disabled={pending} onClick={() => change(qty + step)} className="flex size-10 items-center justify-center rounded-lg bg-secondary">
            <Plus className="size-4" />
          </button>
          <button type="button" aria-label="Remove" disabled={pending} onClick={() => go(() => removeLine({ line_id: line.id }))} className="flex size-10 items-center justify-center rounded-lg text-muted-foreground">
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function CustomLineForm({ quoteId }: { quoteId: string }) {
  const [state, action] = useActionState(addCustomLine, null);
  return (
    <form action={action} className="grid grid-cols-[1fr_6rem_4rem] items-end gap-2">
      <input type="hidden" name="quote_id" value={quoteId} />
      <Field label="Custom item" htmlFor="c_name">
        <Input id="c_name" name="name" placeholder="Tile backsplash" />
      </Field>
      <Field label="My cost $" htmlFor="c_cost">
        <Input id="c_cost" name="cost" inputMode="decimal" />
      </Field>
      <Field label="Qty" htmlFor="c_qty">
        <Input id="c_qty" name="qty" inputMode="decimal" defaultValue="1" />
      </Field>
      <div className="col-span-3 flex flex-col gap-2">
        <FormMessage state={state} />
        <SubmitButton variant="secondary">Add custom item</SubmitButton>
      </div>
    </form>
  );
}

export function ShareBar({
  quoteId,
  clientUrl,
  docNumber,
  locked,
}: {
  quoteId: string;
  clientUrl: string;
  docNumber: string | null;
  locked: boolean;
}) {
  const { pending, msg, go } = useAct();
  const [copied, setCopied] = useState(false);
  const shared = !!docNumber || (msg?.ok && !!msg.message);
  return (
    <div className="flex flex-col gap-2">
      {shared ? (
        <div className="grid grid-cols-2 gap-2">
          <a href={clientUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-zinc-900">
            <ExternalLink className="size-4" /> Client view
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(clientUrl);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/15 font-semibold"
          >
            <Copy className="size-4" /> {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => go(() => shareQuote({ quote_id: quoteId }))}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-zinc-900"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Show the client
        </button>
      )}
      {locked ? (
        <Button type="button" variant="ghost" className="text-white" onClick={() => go(() => duplicateQuote({ quote_id: quoteId }))}>
          Duplicate to change it
        </Button>
      ) : null}
      {msg && !msg.ok ? <p className="text-sm text-red-200">{msg.error}</p> : null}
    </div>
  );
}
