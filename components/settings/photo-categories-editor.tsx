"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { savePhotoCategories } from "@/server/actions/settings";

type Row = { key: string | null; label: string; hint: string | null; min_required: number; active: boolean };

/** Settings → Photos (v3 D): the categories photos are filed under and the site-visit minimums. */
export function PhotoCategoriesEditor({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const set = (i: number, p: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={r.key ?? `new-${i}`} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border">
            <div className="flex items-center gap-2">
              <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} aria-label="Category name" />
              <Button type="button" variant="ghost" size="icon" aria-label="Up" onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Down" onClick={() => move(i, 1)}>
                <ArrowDown />
              </Button>
            </div>
            <Input value={r.hint ?? ""} placeholder="What to shoot (shown on the site visit)" onChange={(e) => set(i, { hint: e.target.value || null })} />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                Site visit needs
                <Input
                  inputMode="numeric"
                  className="w-16"
                  value={r.min_required}
                  onChange={(e) => set(i, { min_required: Math.min(50, Number(e.target.value.replace(/\D/g, "")) || 0) })}
                />
              </label>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={r.active}
                  disabled={r.key === "other"}
                  onChange={(e) => set(i, { active: e.target.checked })}
                />
                On
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" onClick={() => setRows((r) => [...r, { key: null, label: "New category", hint: null, min_required: 0, active: true }])}>
        <Plus /> Add category
      </Button>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await savePhotoCategories(rows);
            setMsg(r?.ok ? "Saved" : (r?.error ?? "Couldn't save"));
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null} Save categories
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
      <p className="text-xs text-muted-foreground">
        &quot;Other&quot; is the catch-all and stays on. Turning a category off hides it for new photos; photos already in it keep it.
      </p>
    </div>
  );
}
