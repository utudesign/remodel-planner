"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { centsToInput, parseDollarsToCents } from "@/lib/money";
import { savePaymentTemplate } from "@/server/actions/settings";

type Item = {
  label: string;
  kind: "percent" | "fixed";
  percent: string; // "50"
  amount: string; // "1000.00"
  due_trigger: string | null;
};

export function PaymentTemplateEditor({
  template,
  milestones,
}: {
  template?: {
    id: string;
    name: string;
    active: boolean;
    items: {
      label: string;
      kind: string;
      percent_bps: number | null;
      amount_cents: number | null;
      due_trigger: string | null;
      sort_order: number;
    }[];
  };
  milestones: { key: string; label: string }[];
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [active, setActive] = useState(template?.active ?? true);
  const [items, setItems] = useState<Item[]>(
    template
      ? [...template.items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({
            label: i.label,
            kind: i.kind as "percent" | "fixed",
            percent: i.percent_bps !== null ? String(i.percent_bps / 100) : "",
            amount: centsToInput(i.amount_cents),
            due_trigger: i.due_trigger,
          }))
      : [
          {
            label: "Deposit",
            kind: "percent",
            percent: "50",
            amount: "",
            due_trigger: "deposit_received",
          },
          {
            label: "Final",
            kind: "percent",
            percent: "50",
            amount: "",
            due_trigger: "final_inspection",
          },
        ],
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const totalPct = items
    .filter((i) => i.kind === "percent")
    .reduce((s, i) => s + (Number(i.percent) || 0), 0);
  const update = (i: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const triggers = milestones.filter((m) => m.key !== "deposit_received" && m.key !== "closed");

  function save() {
    setMsg(null);
    try {
      const payload = {
        id: template?.id ?? null,
        name,
        active,
        items: items.map((i) => ({
          label: i.label,
          kind: i.kind,
          percent_bps: i.kind === "percent" ? Math.round(Number(i.percent) * 100) : null,
          amount_cents: i.kind === "fixed" ? parseDollarsToCents(i.amount) : null,
          due_trigger: i.due_trigger,
        })),
      };
      start(async () => {
        const r = await savePaymentTemplate(payload);
        setMsg({ ok: !!r?.ok, text: r?.ok ? "Saved" : (r?.error ?? "Could not save") });
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="font-medium"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Show
        </label>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-2 sm:grid-cols-[1.5fr_0.8fr_0.8fr_1.4fr_auto]"
          >
            <Input
              value={it.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label"
              className="col-span-2 sm:col-span-1"
            />
            <NativeSelect
              value={it.kind}
              onChange={(e) => update(i, { kind: e.target.value as Item["kind"] })}
              aria-label="Kind"
            >
              <option value="percent">%</option>
              <option value="fixed">$ fixed</option>
            </NativeSelect>
            {it.kind === "percent" ? (
              <Input
                inputMode="decimal"
                value={it.percent}
                onChange={(e) => update(i, { percent: e.target.value })}
                placeholder="%"
                aria-label="Percent"
              />
            ) : (
              <Input
                inputMode="decimal"
                value={it.amount}
                onChange={(e) => update(i, { amount: e.target.value })}
                placeholder="$"
                aria-label="Amount"
              />
            )}
            {i === 0 ? (
              <p className="col-span-2 self-center text-xs text-muted-foreground sm:col-span-1">
                Paid at signing (deposit)
              </p>
            ) : (
              <NativeSelect
                aria-label="Due when"
                value={it.due_trigger ?? ""}
                onChange={(e) => update(i, { due_trigger: e.target.value || null })}
                className="col-span-2 sm:col-span-1"
              >
                <option value="">Due on a date</option>
                {triggers.map((m) => (
                  <option key={m.key} value={m.key}>
                    When {m.label} is done
                  </option>
                ))}
              </NativeSelect>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove installment"
              disabled={items.length === 1}
              onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <p
        className={
          totalPct === 100 || items.some((i) => i.kind === "fixed")
            ? "text-xs text-muted-foreground"
            : "text-xs text-destructive"
        }
      >
        Percent total: {totalPct}% (the last installment absorbs rounding)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setItems((xs) => [
              ...xs,
              { label: "", kind: "percent", percent: "", amount: "", due_trigger: null },
            ])
          }
        >
          <Plus /> Installment
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={save}>
          {template ? "Save" : "Create template"}
        </Button>
        {msg ? (
          <span className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
