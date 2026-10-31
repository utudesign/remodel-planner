"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { SINK_TYPES, sinkTypeFromNote } from "@/lib/estimating/builder-steps";
import { formatCents, formatCentsWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  addCatalogItems,
  addSpecialWork,
  listGroupItems,
  pickColor,
  setCountertop,
  setItemQty,
} from "@/server/actions/estimates";
import type { ActionState } from "@/server/action-utils";

/** Estimate builder steps (change request v3 items 9 + 10). Every change saves at once; prices come from the database. */

function useSave() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>(null);
  const router = useRouter();
  const save = (fn: () => Promise<ActionState | void>) =>
    start(async () => {
      const r = await fn();
      setMsg(r ?? null);
      router.refresh();
    });
  return { pending, msg, save };
}

function Msg({ msg }: { msg: ActionState }) {
  if (!msg) return null;
  return <p className={cn("text-sm", msg.ok ? "text-muted-foreground" : "text-destructive")}>{msg.ok ? msg.message : msg.error}</p>;
}

/** − qty + for one price-list item; the number can be typed (feet, sq ft); 0 removes it. */
export function Stepper({
  quoteId,
  itemId,
  qty,
  unit,
  step = 1,
  locked,
}: {
  quoteId: string;
  itemId: string;
  qty: number;
  unit?: string;
  step?: number;
  locked: boolean;
}) {
  const [n, setN] = useState(qty);
  const [text, setText] = useState(String(qty));
  const { pending, save } = useSave();
  const set = (v: number) => {
    const next = Math.max(0, Math.round(v * 100) / 100);
    setN(next);
    setText(String(next));
    if (next !== n) save(() => setItemQty({ quote_id: quoteId, catalog_item_id: itemId, qty: next }));
  };
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && v >= 0 && v <= 10000) set(v);
    else setText(String(n));
  };
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label="Less"
        disabled={locked || pending || n <= 0}
        onClick={() => set(n - step)}
        className="flex size-11 items-center justify-center rounded-xl bg-secondary disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <label className="flex w-14 flex-col items-center">
        <input
          value={text}
          inputMode="decimal"
          disabled={locked}
          onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label={`Quantity${unit && unit !== "ea" ? ` (${unit})` : ""}`}
          className="h-9 w-full rounded-lg bg-transparent text-center text-[16px] font-semibold tabular-nums focus:bg-secondary focus:outline-none"
        />
        {unit && unit !== "ea" ? <span className="text-[10px] font-medium text-muted-foreground">{unit}</span> : null}
      </label>
      <button
        type="button"
        aria-label="More"
        disabled={locked || pending}
        onClick={() => set(n + step)}
        className="flex size-11 items-center justify-center rounded-xl bg-secondary disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 1 + 2. Brand → Color
// ---------------------------------------------------------------------------------------------
export type ColorOption = {
  id: string;
  vendor: string;
  code: string;
  name: string;
  line: string | null;
  swatch_url: string | null;
  collection_id: string;
};

export function BrandColorPicker({
  quoteId,
  brands,
  brand,
  colors,
  colorCode,
  collectionId,
  locked,
}: {
  quoteId: string;
  brands: string[];
  brand: string | null;
  colors: ColorOption[];
  colorCode: string | null;
  collectionId: string | null;
  locked: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(brand ?? (brands.length === 1 ? brands[0] : null));
  const { pending, msg, save } = useSave();
  const [busy, setBusy] = useState<string | null>(null);
  const shown = colors.filter((c) => c.vendor === picked);
  const lines = [...new Set(shown.map((c) => c.line ?? ""))];
  const current = colors.find((c) => c.code === colorCode && c.collection_id === collectionId);
  if (!brands.length) {
    return <p className="text-sm text-muted-foreground">No price list loaded yet. The owner loads one in Settings → Price lists.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold">1. Brand</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Brand">
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={picked === b}
              disabled={locked}
              onClick={() => setPicked(b)}
              className={cn(
                "h-11 rounded-xl px-4 text-sm font-semibold ring-1",
                picked === b ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      {picked ? (
        <div>
          <p className="mb-1.5 text-sm font-semibold">
            2. Color{current ? <span className="font-normal text-muted-foreground"> · {current.name} ({current.code})</span> : null}
          </p>
          <div className="flex flex-col gap-3">
            {lines.map((line) => (
              <section key={line}>
                {line ? <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{line}</h4> : null}
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {shown
                    .filter((c) => (c.line ?? "") === line)
                    .map((c) => {
                      const on = current?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={locked || pending}
                          aria-pressed={on}
                          aria-label={`${c.name} (${c.code})`}
                          onClick={() => {
                            setBusy(c.id);
                            save(async () => {
                              const r = await pickColor({ quote_id: quoteId, color_id: c.id });
                              setBusy(null);
                              return r;
                            });
                          }}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-xl p-1.5 text-center ring-1",
                            on ? "bg-accent ring-2 ring-primary" : "bg-card ring-border",
                          )}
                        >
                          <span className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {c.swatch_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={c.swatch_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-muted-foreground">{c.code}</span>
                            )}
                            {busy === c.id ? (
                              <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <Loader2 className="size-5 animate-spin" />
                              </span>
                            ) : on ? (
                              <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="size-3.5" />
                              </span>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-[11px] leading-tight font-medium">{c.name}</span>
                        </button>
                      );
                    })}
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : null}
      <Msg msg={msg} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 3. Cabinets: bulk add by group
// ---------------------------------------------------------------------------------------------
type GroupItem = { id: string; code: string; name: string; list_price_cents: number };

export function BulkAdd({
  quoteId,
  groups,
  disabled,
}: {
  quoteId: string;
  groups: { key: string; label: string }[];
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(groups[0]?.key ?? "wall");
  const [items, setItems] = useState<Record<string, GroupItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, { item: GroupItem; qty: number }>>({});
  const { pending, msg, save } = useSave();

  // Load a group's items when its tab opens (once per group).
  function load(g: string) {
    if (items[g]) return;
    setLoading(true);
    setLoadError(null);
    listGroupItems({ quote_id: quoteId, group: g })
      .then((rows) => setItems((m) => ({ ...m, [g]: rows })))
      .catch(() => setLoadError("Couldn't load the list. Check the signal and try again."))
      .finally(() => setLoading(false));
  }
  function show(g: string) {
    setGroup(g);
    setQ("");
    load(g);
  }

  const list = useMemo(() => {
    const t = q.trim().toUpperCase();
    const all = items[group] ?? [];
    if (!t) return all;
    return all.filter((i) => i.code.toUpperCase().startsWith(t) || i.name.toUpperCase().includes(t));
  }, [items, group, q]);
  const count = Object.values(picked).reduce((n, p) => n + p.qty, 0);
  const bump = (item: GroupItem, d: number) =>
    setPicked((m) => {
      const qty = Math.max(0, (m[item.id]?.qty ?? 0) + d);
      const next = { ...m };
      if (qty) next[item.id] = { item, qty };
      else delete next[item.id];
      return next;
    });

  if (!open) {
    return (
      <Button
        size="lg"
        className="w-full"
        disabled={disabled}
        onClick={() => {
          setOpen(true);
          load(group);
        }}
      >
        <Plus /> Add cabinets
      </Button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label="Add cabinets">
      <div className="flex items-center justify-between gap-2 border-b px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-2">
        <h2 className="text-lg font-bold">Add cabinets</h2>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex size-11 items-center justify-center">
          <X className="size-5" />
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none]" role="tablist">
        {groups.map((g) => (
          <button
            key={g.key}
            type="button"
            role="tab"
            aria-selected={group === g.key}
            onClick={() => show(g.key)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-semibold",
              group === g.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {g.label}
            {Object.values(picked).some((p) => (items[g.key] ?? []).some((i) => i.id === p.item.id)) ? " •" : ""}
          </button>
        ))}
      </div>
      <div className="relative px-4 pb-2">
        <Search className="pointer-events-none absolute top-1/2 left-7 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or name (W3030, sink…)" className="pl-9" autoCapitalize="characters" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : loadError ? (
          <p className="py-6 text-sm text-destructive">{loadError}</p>
        ) : list.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{q ? "Nothing matches." : "Nothing in this group for this color."}</p>
        ) : (
          <ul className="flex flex-col">
            {list.map((i) => {
              const n = picked[i.id]?.qty ?? 0;
              return (
                <li key={i.id} className={cn("flex items-center gap-2 border-b border-border/60 py-1.5", n > 0 && "bg-accent/40")}>
                  <button type="button" onClick={() => bump(i, 1)} className="min-w-0 flex-1 py-1 text-left">
                    <span className="block text-[15px] font-bold">{i.code}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {i.name.replace(/^.*? - /, "")} · list {formatCentsWhole(i.list_price_cents)}
                    </span>
                  </button>
                  {n > 0 ? (
                    <button type="button" aria-label={`One less ${i.code}`} onClick={() => bump(i, -1)} className="flex size-11 items-center justify-center rounded-xl bg-secondary">
                      <Minus className="size-4" />
                    </button>
                  ) : null}
                  <span className="w-6 text-center font-semibold tabular-nums">{n || ""}</span>
                  <button type="button" aria-label={`One more ${i.code}`} onClick={() => bump(i, 1)} className="flex size-11 items-center justify-center rounded-xl bg-secondary">
                    <Plus className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <Msg msg={msg} />
        <Button
          size="lg"
          className="w-full"
          disabled={!count || pending}
          onClick={() =>
            save(async () => {
              const r = await addCatalogItems({
                quote_id: quoteId,
                items: Object.values(picked).map((p) => ({ id: p.item.id, qty: p.qty })),
              });
              if (r?.ok) {
                setPicked({});
                setOpen(false);
              }
              return r;
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {count ? `Add ${count} item${count === 1 ? "" : "s"}` : "Tap items to add them"}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Accessories (item 9): fillers, toe kick, lights, scribe, crown, panels, DW end panel
// ---------------------------------------------------------------------------------------------
export function AccessoryList({
  quoteId,
  rows,
  locked,
}: {
  quoteId: string;
  rows: { id: string; label: string; item: { id: string; code: string; name: string; unit: string } | null; qty: number }[];
  locked: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex min-h-14 items-center gap-2 border-b border-border/60 py-1.5 last:border-0">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">{r.label}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {r.item ? `${r.item.code ? `${r.item.code} · ` : ""}${r.item.name.replace(/^.*? - /, "")}` : "Not in this price list. Pick a color, or add it below"}
            </span>
          </span>
          {r.item ? <Stepper key={`${r.item.id}:${r.qty}`} quoteId={quoteId} itemId={r.item.id} qty={r.qty} unit={r.item.unit} locked={locked} /> : null}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------------------------
// Suggestion chips (new estimates): one tap adds the item with qty 1
// ---------------------------------------------------------------------------------------------
export function SuggestionChips({
  quoteId,
  items,
  locked,
}: {
  quoteId: string;
  items: { id: string; label: string }[];
  locked: boolean;
}) {
  const { pending, msg, save } = useSave();
  const [busy, setBusy] = useState<string | null>(null);
  if (!items.length || locked) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-muted-foreground">Suggested</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <button
            key={i.id}
            type="button"
            disabled={pending}
            onClick={() => {
              setBusy(i.id);
              save(async () => {
                const r = await setItemQty({ quote_id: quoteId, catalog_item_id: i.id, qty: 1 });
                setBusy(null);
                return r;
              });
            }}
            className="inline-flex h-10 items-center gap-1 rounded-full bg-accent px-3.5 text-sm font-semibold text-accent-foreground"
          >
            {busy === i.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {i.label}
          </button>
        ))}
      </div>
      <Msg msg={msg} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 5. Countertop: level, sq ft, sink type, cutouts / extras
// ---------------------------------------------------------------------------------------------
export function CountertopStep({
  quoteId,
  levels,
  extras,
  sinkItems,
  line,
  locked,
}: {
  quoteId: string;
  levels: { id: string; code: string; name: string; price_cents: number | null }[];
  extras: { id: string; name: string; unit: string; qty: number }[];
  sinkItems: { id: string; name: string; qty: number }[];
  line: { id: string; item_id: string | null; sqft: number; note: string | null } | null;
  locked: boolean;
}) {
  const [level, setLevel] = useState(line?.item_id ?? levels[0]?.id ?? "");
  const [sqft, setSqft] = useState(line ? String(line.sqft) : "");
  const [sink, setSink] = useState<string>(sinkTypeFromNote(line?.note) ?? "");
  const { pending, msg, save } = useSave();
  const dirty =
    !line ||
    level !== line.item_id ||
    Number(sqft || 0) !== line.sqft ||
    (sink || null) !== (sinkTypeFromNote(line.note) ?? null);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-sm font-semibold">Material / level</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={locked}
              aria-pressed={level === l.id}
              onClick={() => setLevel(l.id)}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-xl px-3 py-2 text-left ring-1",
                level === l.id ? "bg-foreground text-background ring-foreground" : "bg-card ring-border",
              )}
            >
              <span className="text-sm font-bold">{l.code || l.name.split(" ")[0]}</span>
              <span className="line-clamp-2 text-[11px] opacity-80">
                {l.name.replace(/\s*\(.*$/, "")}
                {l.price_cents ? ` · ${formatCentsWhole(l.price_cents)}/sf` : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Square feet" htmlFor="ct_sqft">
          <Input id="ct_sqft" inputMode="decimal" value={sqft} onChange={(e) => setSqft(e.target.value.replace(/[^\d.]/g, ""))} disabled={locked} />
        </Field>
        <Field label="Sink" htmlFor="ct_sink">
          <NativeSelect id="ct_sink" value={sink} onChange={(e) => setSink(e.target.value)} disabled={locked}>
            <option value="">Not set</option>
            {SINK_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      {!locked ? (
        <Button
          variant={dirty ? "default" : "secondary"}
          disabled={pending || !level || !dirty}
          onClick={() =>
            save(() =>
              setCountertop({
                quote_id: quoteId,
                level_id: level,
                sqft: Number(sqft || 0),
                sink_type: (sink || null) as (typeof SINK_TYPES)[number] | null,
              }),
            )
          }
        >
          {pending ? <Loader2 className="animate-spin" /> : null}
          {line ? (dirty ? "Save countertop" : "Saved") : "Add countertop"}
        </Button>
      ) : null}
      <Msg msg={msg} />
      {extras.length || sinkItems.length ? (
        <ul className="flex flex-col">
          {[...extras, ...sinkItems.map((x) => ({ ...x, unit: "ea" }))].map((x) => (
            <li key={x.id} className="flex min-h-14 items-center gap-2 border-b border-border/60 py-1.5 last:border-0">
              <span className="min-w-0 flex-1 text-[14px]">{x.name.replace(/\s*\(.*$/, "")}</span>
              <Stepper key={`${x.id}:${x.qty}`} quoteId={quoteId} itemId={x.id} qty={x.qty} unit={x.unit} locked={locked} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// 6. Special work: electrical, gas, plumbing, flooring, other (a priced line each)
// ---------------------------------------------------------------------------------------------
export function SpecialWorkForm({ quoteId, types }: { quoteId: string; types: { key: string; label: string }[] }) {
  const [state, action] = useActionState(addSpecialWork, null);
  return (
    <form action={action} key={state?.ok ? state.message : "form"} className="grid grid-cols-2 gap-3">
      <input type="hidden" name="quote_id" value={quoteId} />
      <Field label="Work" htmlFor="sw_type">
        <NativeSelect id="sw_type" name="type" defaultValue={types[0]?.key}>
          {types.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Client price $" htmlFor="sw_price">
        <Input id="sw_price" name="price" inputMode="decimal" placeholder="1200" required />
      </Field>
      <Field label="What" htmlFor="sw_desc" className="col-span-2">
        <Input id="sw_desc" name="description" placeholder="Move range outlet, new 20 A circuit" />
      </Field>
      <Field label="Your cost $ (optional)" htmlFor="sw_cost" hint="blank = at your target margin" className="col-span-2">
        <Input id="sw_cost" name="cost" inputMode="decimal" />
      </Field>
      <div className="col-span-2 flex flex-col gap-2">
        <FormMessage state={state} />
        <SubmitButton variant="secondary">Add special work</SubmitButton>
      </div>
    </form>
  );
}

export function StepTotal({ cents }: { cents: number }) {
  return cents ? <span className="text-sm font-semibold text-muted-foreground tabular-nums">{formatCents(cents)}</span> : null;
}
