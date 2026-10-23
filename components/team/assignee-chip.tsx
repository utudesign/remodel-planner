"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/shared/avatar";
import type { ActionState } from "@/server/action-utils";

/** "Who's on it" chip; tap to reassign (CONTEXT §4). */
export function AssigneeChip({
  current,
  people,
  label = "Owner",
  onAssign,
  disabled,
}: {
  current: { id: string; name: string } | null;
  people: { id: string; name: string }[];
  label?: string;
  onAssign: (userId: string) => Promise<ActionState>;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(current);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="relative inline-flex">
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm">
        <Avatar id={shown?.id} name={shown?.name} />
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{shown?.name ?? "Unassigned"}</span>
      </span>
      {!disabled ? (
        <select
          aria-label={`Change ${label.toLowerCase()}`}
          className="absolute inset-0 cursor-pointer opacity-0"
          value={shown?.id ?? ""}
          disabled={pending}
          onChange={(e) => {
            const p = people.find((x) => x.id === e.target.value);
            if (!p) return;
            const before = shown;
            setShown(p);
            setError(null);
            start(async () => {
              const r = await onAssign(p.id);
              if (!r?.ok) {
                setShown(before);
                setError(r?.error ?? "Could not reassign");
              }
            });
          }}
        >
          <option value="" disabled>
            Pick someone…
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : null}
      {error ? (
        <span className="absolute top-full left-0 mt-1 text-xs text-destructive">{error}</span>
      ) : null}
    </span>
  );
}
