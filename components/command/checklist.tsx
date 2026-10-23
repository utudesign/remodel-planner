"use client";

import { useState, useTransition } from "react";
import { toggleChecklist } from "@/server/actions/command";

export function ShiftChecklist({
  kind,
  date,
  items,
  done: initial,
}: {
  kind: "live" | "back_office";
  date: string;
  items: { key: string; label: string }[];
  done: Record<string, boolean>;
}) {
  const [done, setDone] = useState(initial);
  const [, start] = useTransition();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => (
        <li key={i.key}>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 shrink-0 accent-primary"
              checked={!!done[i.key]}
              onChange={(e) => {
                const v = e.target.checked;
                setDone((d) => ({ ...d, [i.key]: v }));
                start(
                  async () => void (await toggleChecklist({ kind, date, key: i.key, done: v })),
                );
              }}
            />
            <span className={done[i.key] ? "text-muted-foreground line-through" : ""}>
              {i.label}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
