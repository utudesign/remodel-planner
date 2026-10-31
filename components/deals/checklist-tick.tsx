"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setChecklistTick } from "@/server/actions/jacket";

/**
 * Job-ready checklist circle (v3 item 1). Tap to tick an item done by hand (who + when are recorded,
 * and the gate accepts it), tap again to untick. An item with a file attached is done by the file;
 * the circle then just shows ✓ (remove the file to reopen it).
 */
export function ChecklistTick({
  dealId,
  requirementId,
  label,
  satisfied,
  hasFiles,
  checkedByHand,
}: {
  dealId: string;
  requirementId: string;
  label: string;
  satisfied: boolean;
  hasFiles: boolean;
  checkedByHand: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useOptimistic(satisfied);
  const locked = hasFiles; // done by its file(s)

  function toggle() {
    if (locked) return;
    const next = !shown;
    if (!next && checkedByHand && !window.confirm(`Untick "${label}"?`)) return;
    setError(null);
    start(async () => {
      setShown(next);
      const res = await setChecklistTick({ deal_id: dealId, requirement_id: requirementId, checked: next });
      if (res && !res.ok) setError(res.error ?? "Couldn't save");
    });
  }

  return (
    <span className="flex flex-col items-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={shown}
        aria-label={locked ? `${label}: done (file attached)` : shown ? `Untick ${label}` : `Tick ${label} done`}
        onClick={toggle}
        disabled={pending || locked}
        className="-m-2.5 flex size-11 shrink-0 items-center justify-center"
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs font-bold",
            shown ? "bg-primary text-primary-foreground" : "ring-2 ring-input",
          )}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : shown ? <Check className="size-3.5" /> : null}
        </span>
      </button>
      {error ? <span className="sr-only" role="alert">{error}</span> : null}
    </span>
  );
}
