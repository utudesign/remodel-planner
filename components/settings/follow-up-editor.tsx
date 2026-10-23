"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveFollowUpRules } from "@/server/actions/settings";

type Rule = { offset_days: number; offset_hours: number; description: string };

/** Follow-up cadence for one stage, counted from when the lead entered the stage. */
export function FollowUpEditor({
  stageId,
  stageLabel,
  rules: initial,
}: {
  stageId: string;
  stageLabel: string;
  rules: Rule[];
}) {
  const [rules, setRules] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const update = (i: number, patch: Partial<Rule>) =>
    setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="rounded-lg border p-3">
      <p className="mb-2 text-sm font-medium">{stageLabel}</p>
      {rules.length === 0 ? (
        <p className="mb-2 text-xs text-muted-foreground">No rule: suggests +2 days.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rules.map((r, i) => (
          <li key={i} className="grid grid-cols-[4.5rem_4.5rem_1fr_auto] items-center gap-2">
            <label className="text-xs text-muted-foreground">
              +days
              <Input
                type="number"
                min={0}
                value={r.offset_days}
                onChange={(e) => update(i, { offset_days: Number(e.target.value) })}
                className="h-8"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              +hours
              <Input
                type="number"
                min={0}
                value={r.offset_hours}
                onChange={(e) => update(i, { offset_hours: Number(e.target.value) })}
                className="h-8"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              What to do
              <Input
                value={r.description}
                onChange={(e) => update(i, { description: e.target.value })}
                className="h-8"
              />
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remove rule"
              className="mt-4"
              onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRules((rs) => [
              ...rs,
              { offset_days: (rs.at(-1)?.offset_days ?? 0) + 2, offset_hours: 0, description: "" },
            ])
          }
        >
          <Plus /> Follow-up
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveFollowUpRules({ stage_id: stageId, rules });
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
