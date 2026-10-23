"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { saveTaskTemplate } from "@/server/actions/settings";

type Item = { title: string; milestone_key: string | null; kind: "task" | "punch" };

export function TaskTemplateEditor({
  template,
  milestones,
}: {
  template?: {
    id: string;
    name: string;
    is_default: boolean;
    active: boolean;
    items: { title: string; milestone_key: string | null; kind: string; sort_order: number }[];
  };
  milestones: { key: string; label: string }[];
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [isDefault, setDefault] = useState(template?.is_default ?? false);
  const [active, setActive] = useState(template?.active ?? true);
  const [items, setItems] = useState<Item[]>(
    template
      ? [...template.items]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({
            title: i.title,
            milestone_key: i.milestone_key,
            kind: i.kind as Item["kind"],
          }))
      : [],
  );
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const update = (i: number, patch: Partial<Item>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const out = [...xs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="flex-1 font-medium"
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={isDefault}
            onChange={(e) => setDefault(e.target.checked)}
          />
          Default
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-4"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Show
        </label>
      </div>
      <ol className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[auto_1fr_12rem_auto]"
          >
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
              value={it.title}
              onChange={(e) => update(i, { title: e.target.value })}
              className="h-9"
            />
            <NativeSelect
              aria-label="Milestone"
              value={it.milestone_key ?? ""}
              onChange={(e) => update(i, { milestone_key: e.target.value || null })}
              className="col-span-3 col-start-2 row-start-2 h-9 sm:col-span-1 sm:col-start-auto sm:row-start-auto"
            >
              <option value="">No milestone</option>
              {milestones.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </NativeSelect>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove task"
              onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setItems((xs) => [
              ...xs,
              { title: "", milestone_key: xs.at(-1)?.milestone_key ?? null, kind: "task" },
            ])
          }
        >
          <Plus /> Task
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTaskTemplate({
                id: template?.id ?? null,
                name,
                is_default: isDefault,
                active,
                items,
              });
              setMsg({ ok: !!r?.ok, text: r?.ok ? "Saved" : (r?.error ?? "Could not save") });
            })
          }
        >
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
