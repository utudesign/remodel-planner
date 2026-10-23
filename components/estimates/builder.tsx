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
  addCatalogItem,
  addCustomLine,
  duplicateQuote,
  newQuickEstimate,
  removeLine,
  saveMeasurements,
  setColorGroup,
  setLineQty,
  setQuartzLevel,
  shareQuote,
} from "@/server/actions/estimates";
import type { MeasureForm } from "@/lib/quick-estimate";
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

export function NewEstimateForm({ dealId, templates }: { dealId: string; templates: { id: string; name: string; description: string | null }[] }) {
  const [state, action] = useActionState(newQuickEstimate, null);
  if (!templates.length) return <p className="text-sm text-muted-foreground">No templates yet.</p>;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Start from a layout</legend>
        {templates.map((t, i) => (
          <label key={t.id} className="flex items-start gap-3 rounded-xl p-3 ring-1 ring-border has-checked:bg-accent has-checked:ring-primary">
            <input type="radio" name="template_id" value={t.id} defaultChecked={i === 0} className="mt-1 size-4" />
            <span>
              <span className="block font-semibold">{t.name}</span>
              {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full">
        New quick estimate
      </SubmitButton>
      <p className="text-xs text-muted-foreground">Walls from the site visit fill in the measurements automatically.</p>
    </form>
  );
}

export function MeasureCard({ quoteId, m, locked }: { quoteId: string; m: MeasureForm; locked: boolean }) {
  const [state, action] = useActionState(saveMeasurements, null);
  const n = (v: number) => (v ? String(v) : "0");
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <fieldset disabled={locked} className="grid grid-cols-2 gap-3">
        <Field label="Walls with cabinets (ft)" htmlFor="walls" hint="e.g. 10, 12 6" className="col-span-2">
          <Input id="walls" name="walls" defaultValue={m.walls_ft.join(", ")} inputMode="text" />
        </Field>
        <Field label="Corners" htmlFor="corners">
          <Input id="corners" name="corners" inputMode="numeric" defaultValue={n(m.corners)} />
        </Field>
        <Field label="Openings (in)" htmlFor="openings" hint="range, fridge…">
          <Input id="openings" name="openings" defaultValue={m.openings_in.join(", ")} />
        </Field>
        <Field label="Cabinet run (ft)" htmlFor="cabinet_lf" hint="base + wall">
          <Input id="cabinet_lf" name="cabinet_lf" inputMode="decimal" defaultValue={n(m.cabinet_lf)} />
        </Field>
        <Field label="Doors" htmlFor="doors">
          <Input id="doors" name="doors" inputMode="numeric" defaultValue={n(m.doors)} />
        </Field>
        <Field label="Drawers" htmlFor="drawers">
          <Input id="drawers" name="drawers" inputMode="numeric" defaultValue={n(m.drawers)} />
        </Field>
        <Field label="Crown (ft)" htmlFor="crown_lf">
          <Input id="crown_lf" name="crown_lf" inputMode="decimal" defaultValue={n(m.crown_lf)} />
        </Field>
        <Field label="Light rail (ft)" htmlFor="light_rail_lf">
          <Input id="light_rail_lf" name="light_rail_lf" inputMode="decimal" defaultValue={n(m.light_rail_lf)} />
        </Field>
        <Field label="Toe kick (ft)" htmlFor="toe_kick_lf">
          <Input id="toe_kick_lf" name="toe_kick_lf" inputMode="decimal" defaultValue={n(m.toe_kick_lf)} />
        </Field>
        <Field label="Scribe (ft)" htmlFor="scribe_lf">
          <Input id="scribe_lf" name="scribe_lf" inputMode="decimal" defaultValue={n(m.scribe_lf)} />
        </Field>
        <Field label="Under-cabinet LED (ft)" htmlFor="led_ft">
          <Input id="led_ft" name="led_ft" inputMode="decimal" defaultValue={n(m.led_ft)} />
        </Field>
        <Field label="Counter outlets" htmlFor="countertop_outlets">
          <Input id="countertop_outlets" name="countertop_outlets" inputMode="numeric" defaultValue={n(m.countertop_outlets)} />
        </Field>
      </fieldset>
      <FormMessage state={state} />
      {!locked ? <SubmitButton className="w-full">Update quantities</SubmitButton> : null}
    </form>
  );
}

export function ChoiceRow({
  quoteId,
  kind,
  options,
  current,
  locked,
}: {
  quoteId: string;
  kind: "color" | "quartz";
  options: { id: string; label: string; hint?: string }[];
  current: string | null;
  locked: boolean;
}) {
  const { pending, msg, go } = useAct();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={pending || locked}
            aria-pressed={current === o.id}
            onClick={() =>
              go(() =>
                kind === "color"
                  ? setColorGroup({ quote_id: quoteId, collection_id: o.id })
                  : setQuartzLevel({ quote_id: quoteId, catalog_item_id: o.id }),
              )
            }
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-xl text-sm font-bold ring-1 ring-border disabled:opacity-60",
              current === o.id ? "bg-foreground text-background ring-foreground" : "bg-card",
            )}
          >
            {o.label}
            {o.hint ? <span className="text-[10px] font-medium opacity-70">{o.hint}</span> : null}
          </button>
        ))}
      </div>
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      <FormMessage state={msg} />
    </div>
  );
}

export function LineRow({
  line,
  locked,
}: {
  line: { id: string; code: string; name: string; qty: number; unit: string; price_cents: number; qty_source: string | null };
  locked: boolean;
}) {
  const { pending, go } = useAct();
  const [qty, setQty] = useState(Number(line.qty));
  const step = line.unit === "sq ft" || line.unit === "ft" ? 1 : 1;
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
          {line.qty_source ? " · from measurements" : ""} · {formatCents(line.price_cents)}
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

export function AddItemButton({ quoteId, itemId, label }: { quoteId: string; itemId: string; label: string }) {
  const { pending, msg, go } = useAct();
  return (
    <button
      type="button"
      aria-label={`Add ${label}`}
      disabled={pending}
      onClick={() => go(() => addCatalogItem({ quote_id: quoteId, catalog_item_id: itemId }))}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-semibold",
        msg?.ok ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : msg?.ok ? "✓" : <Plus className="size-5" />}
    </button>
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
          <a href={clientUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-foreground">
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
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white font-semibold text-foreground"
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
