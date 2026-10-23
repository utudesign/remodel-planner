"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveMutes } from "@/server/actions/push";

export function MuteForm({
  kinds,
  muted,
}: {
  kinds: readonly { key: string; label: string }[];
  muted: string[];
}) {
  const [m, setM] = useState(new Set(muted));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y">
        {kinds.map((k) => (
          <li key={k.key}>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
              {k.label}
              <input
                type="checkbox"
                className="size-5"
                checked={!m.has(k.key)}
                onChange={(e) =>
                  setM((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.delete(k.key);
                    else next.add(k.key);
                    return next;
                  })
                }
              />
            </label>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        className="h-11 w-fit"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await saveMutes([...m]);
            setMsg(r?.ok ? "Saved" : (r?.error ?? "Could not save"));
          })
        }
      >
        Save
      </Button>
      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}
    </div>
  );
}
