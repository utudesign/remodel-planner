"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveJobPhases, savePaymentSteps, saveTrades } from "@/server/actions/settings";

type Phase = { key: string | null; label: string; trade_key: string | null; start_offset_days: number; duration_days: number; active: boolean };
type Trade = { key: string | null; label: string; active: boolean };

function move<T>(list: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const n = [...list];
  [n[i], n[j]] = [n[j], n[i]];
  return n;
}

/** Settings → Jobs: the phase template every new job starts from, and the trades list (v3 item 13). */
export function JobPhasesEditor({ phases, trades }: { phases: Phase[]; trades: { key: string; label: string }[] }) {
  const [rows, setRows] = useState(phases);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, p: Partial<Phase>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key ?? `new-${i}`} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Phase name" />
              <Button type="button" variant="ghost" size="icon" aria-label="Up" onClick={() => setRows((x) => move(x, i, -1))}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Down" onClick={() => setRows((x) => move(x, i, 1))}>
                <ArrowDown />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Trade
                <NativeSelect value={r.trade_key ?? ""} onChange={(e) => set(i, { trade_key: e.target.value || null })}>
                  <option value="">—</option>
                  {trades.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Starts day
                <Input inputMode="numeric" value={r.start_offset_days} onChange={(e) => set(i, { start_offset_days: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Days
                <Input inputMode="numeric" value={r.duration_days} onChange={(e) => set(i, { duration_days: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-5" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /> Use on new jobs
            </label>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setRows((r) => [...r, { key: null, label: "New phase", trade_key: null, start_offset_days: 0, duration_days: 1, active: true }])}
      >
        <Plus /> Add phase
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveJobPhases(rows);
            setMsg(r?.ok ? "Saved. New jobs use these phases." : (r?.error ?? "Couldn't save"));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Save phases
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">&quot;Starts day&quot; counts from the job&apos;s start (day 0). Jobs already running keep their own tasks.</p>
    </div>
  );
}

export function TradesEditor({ trades }: { trades: Trade[] }) {
  const [rows, setRows] = useState(trades);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={r.key ?? `n${i}`} className="flex items-center gap-2">
          <Input value={r.label} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, label: e.target.value } : y)))} aria-label="Trade" />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={r.active}
              onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, active: e.target.checked } : y)))}
            />
            On
          </label>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, { key: null, label: "New trade", active: true }])}>
        <Plus /> Add trade
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveTrades(rows);
            setMsg(r?.ok ? "Saved" : (r?.error ?? "Couldn't save"));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Save trades
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}

type Step = { key: string | null; label: string; pct: number; active: boolean };

/** Settings → Jobs: the standard payment schedule (v3 G). Percentages of the contract; on-steps add up to 100. */
export function PaymentStepsEditor({ steps }: { steps: Step[] }) {
  const [rows, setRows] = useState(steps);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const total = rows.filter((r) => r.active).reduce((a, r) => a + r.pct, 0);
  const set = (i: number, p: Partial<Step>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={r.key ?? `n${i}`} className="flex items-center gap-2">
          <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Payment" />
          <Input
            inputMode="decimal"
            className="w-20"
            value={r.pct}
            onChange={(e) => set(i, { pct: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 })}
            aria-label={`${r.label} percent`}
          />
          <span className="text-sm">%</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Up" onClick={() => setRows((x) => move(x, i, -1))}>
            <ArrowUp />
          </Button>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" className="size-5" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} /> On
          </label>
        </div>
      ))}
      <p className={total === 100 ? "text-sm text-muted-foreground" : "text-sm font-semibold text-destructive"}>Total {total}% (must be 100%)</p>
      <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, { key: null, label: "New payment", pct: 10, active: true }])}>
        <Plus /> Add step
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await savePaymentSteps(rows);
            setMsg(r?.ok ? "Saved. New schedules use these steps." : (r?.error ?? "Couldn't save"));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Save schedule
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
