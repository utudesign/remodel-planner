"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LookupTable } from "@/lib/validation/settings";
import { saveLookupRows } from "@/server/actions/settings";

type Row = { id: string | null; key?: string; label: string; sort_order: number; active: boolean };

/** Edit labels, order and visibility of a simple list (stages, lost reasons, cost buckets). */
export function LookupEditor({
  table,
  rows: initial,
  lockedKeys = [],
  addLabel,
}: {
  table: LookupTable;
  rows: Row[];
  lockedKeys?: string[];
  addLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>([...initial].sort((a, b) => a.sort_order - b.sort_order));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const out = [...rs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="flex items-center gap-2">
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(i, -1)}
                className="text-muted-foreground"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(i, 1)}
                className="text-muted-foreground"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            <Input
              value={r.label}
              onChange={(e) => update(i, { label: e.target.value })}
              className={r.active ? "" : "opacity-50"}
            />
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-4"
                checked={r.active}
                disabled={!!r.key && lockedKeys.includes(r.key)}
                onChange={(e) => update(i, { active: e.target.checked })}
              />
              Show
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { id: null, label: "", sort_order: rs.length + 1, active: true },
            ])
          }
        >
          <Plus /> {addLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveLookupRows({
                table,
                rows: rows.map((x, idx) => ({
                  id: x.id,
                  label: x.label,
                  sort_order: idx + 1,
                  active: x.active,
                })),
              });
              setMsg({ ok: !!r?.ok, text: r?.ok ? "Saved" : (r?.error ?? "Could not save") });
            })
          }
        >
          Save
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
