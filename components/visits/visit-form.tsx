"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage } from "@/components/shared/form";
import { formatCentsWhole } from "@/lib/money";
import { saveSiteVisit } from "@/server/actions/visits";
import type { ActionState } from "@/server/action-utils";

type Wall = { name: string; ft: number };
type Appliance = { kind: string; model: string; reuse: boolean };

const KINDS = ["Fridge", "Range", "Dishwasher", "Microwave", "Hood", "Wall oven", "Cooktop"];

export function VisitForm({
  dealId,
  initial,
}: {
  dealId: string;
  initial: {
    walls: Wall[];
    ceiling_in: number | null;
    appliances: Appliance[];
    year_built: number | null;
    notes: string;
    low: number | null;
    high: number | null;
    done: boolean;
  };
}) {
  const [walls, setWalls] = useState<Wall[]>(initial.walls.length ? initial.walls : [{ name: "A", ft: 0 }, { name: "B", ft: 0 }]);
  const [apps, setApps] = useState<Appliance[]>(
    initial.appliances.length ? initial.appliances : KINDS.slice(0, 4).map((k) => ({ kind: k, model: "", reuse: true })),
  );
  const [ceiling, setCeiling] = useState(initial.ceiling_in ? String(initial.ceiling_in) : "");
  const [year, setYear] = useState(initial.year_built ? String(initial.year_built) : "");
  const [notes, setNotes] = useState(initial.notes);
  const [range, setRange] = useState<{ low: number | null; high: number | null }>({ low: initial.low, high: initial.high });
  const [msg, setMsg] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const save = (done: boolean) =>
    start(async () => {
      const r = await saveSiteVisit({
        deal_id: dealId,
        walls: walls.map((w) => ({ name: w.name, ft: Number(w.ft) || 0 })),
        ceiling_in: ceiling ? Number(ceiling) : null,
        appliances: apps,
        year_built: year ? Number(year) : null,
        notes,
        done,
      });
      setMsg(r);
      if (r?.ok) setRange({ low: r.low ?? null, high: r.high ?? null });
      router.refresh();
    });

  const yb = Number(year);
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Walls with cabinets (feet)</h2>
        <div className="grid grid-cols-2 gap-2">
          {walls.map((w, i) => (
            <label key={i} className="flex items-center gap-2 rounded-xl bg-card px-3 ring-1 ring-border">
              <span className="w-14 text-sm font-semibold text-muted-foreground">Wall {w.name}</span>
              <input
                inputMode="decimal"
                value={w.ft || ""}
                placeholder="0"
                onChange={(e) => setWalls((ws) => ws.map((x, j) => (j === i ? { ...x, ft: Number(e.target.value.replace(/[^\d.]/g, "")) } : x)))}
                className="h-12 w-full bg-transparent text-right text-lg font-bold outline-none"
                aria-label={`Wall ${w.name} feet`}
              />
              <span className="text-sm text-muted-foreground">ft</span>
            </label>
          ))}
        </div>
        {walls.length < 6 ? (
          <button
            type="button"
            onClick={() => setWalls((ws) => [...ws, { name: String.fromCharCode(65 + ws.length), ft: 0 }])}
            className="flex h-11 items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <Plus className="size-4" /> Add a wall / island
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ceiling (inches)
            <Input inputMode="numeric" value={ceiling} onChange={(e) => setCeiling(e.target.value)} placeholder="96" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Year built
            <Input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="1994" />
          </label>
        </div>
        {yb && yb < 1978 ? (
          <p className="rounded-xl bg-warning/15 p-3 text-sm font-medium">Built before 1978: tell the partner (lead-safe work rules).</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Appliances</h2>
        {apps.map((a, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <input
                value={a.kind}
                onChange={(e) => setApps((xs) => xs.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}
                className="h-10 min-w-0 flex-1 bg-transparent font-semibold outline-none"
                aria-label="Appliance"
              />
              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={a.reuse}
                  onChange={(e) => setApps((xs) => xs.map((x, j) => (j === i ? { ...x, reuse: e.target.checked } : x)))}
                />
                Reuse
              </label>
              <button type="button" aria-label="Remove appliance" onClick={() => setApps((xs) => xs.filter((_, j) => j !== i))} className="flex size-10 items-center justify-center text-muted-foreground">
                <Trash2 className="size-4" />
              </button>
            </div>
            {!a.reuse ? (
              <Input
                value={a.model}
                onChange={(e) => setApps((xs) => xs.map((x, j) => (j === i ? { ...x, model: e.target.value } : x)))}
                placeholder="Model number (or photo the label)"
              />
            ) : null}
          </div>
        ))}
        <button type="button" onClick={() => setApps((xs) => [...xs, { kind: "", model: "", reuse: false }])} className="flex h-11 items-center gap-1.5 text-sm font-semibold text-primary">
          <Plus className="size-4" /> Add appliance
        </button>
      </section>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Notes (what they want, problems, access)
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <FormMessage state={msg} />

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 rounded-t-3xl bg-foreground px-5 pt-4 pb-4 text-background lg:bottom-0 lg:left-[232px]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-background/70">Ballpark (say “final price after design”)</p>
              <p className="text-2xl font-bold tabular-nums">
                {range.low && range.high ? `${formatCentsWhole(range.low)} – ${formatCentsWhole(range.high)}` : "Enter walls, then Save"}
              </p>
            </div>
            {pending ? <Loader2 className="size-5 animate-spin" /> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={pending} onClick={() => save(false)} className="h-12 rounded-xl bg-white/15 font-semibold">
              Save
            </button>
            <button type="button" disabled={pending} onClick={() => save(true)} className="h-12 rounded-xl bg-white font-semibold text-foreground">
              {initial.done ? "Save as done" : "Visit done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
