"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { EmptyState } from "@/components/shared/states";
import { HISTORY_FILTERS, type HistoryEntry, type HistoryKind } from "@/lib/deals/history";
import { cn } from "@/lib/utils";
import { LogForm } from "@/components/deals/jacket-forms";

/**
 * Deal History (change request v3 item 3): every change, newest first, who · what · when (ET).
 * Filter chips by type; "+ Note" logs a call, text or note (the old Log form, now inside History).
 */
export function HistoryList({
  dealId,
  entries,
  times,
}: {
  dealId: string;
  entries: HistoryEntry[];
  /** entry id → "Sat Oct 31, 5:42 PM" (formatted on the server in the company time zone) */
  times: Record<string, string>;
}) {
  const [filter, setFilter] = useState<HistoryKind | "all">("all");
  const [adding, setAdding] = useState(false);
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">History</h2>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-foreground"
          aria-expanded={adding}
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />} {adding ? "Close" : "Note"}
        </button>
      </div>
      {adding ? (
        <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
          <LogForm dealId={dealId} />
        </div>
      ) : null}

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Show">
        {HISTORY_FILTERS.filter((f) => f.key === "all" || counts.get(f.key)).map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-9 shrink-0 rounded-full px-3 text-sm font-semibold whitespace-nowrap",
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {f.label}
            {f.key !== "all" ? <span className="ml-1 tabular-nums opacity-70">{counts.get(f.key)}</span> : null}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={entries.length ? "Nothing of this kind yet" : "No history yet"}
          description={entries.length ? undefined : "Every change on this deal shows up here, newest first."}
        />
      ) : (
        <ol className="flex flex-col">
          {shown.map((e) => (
            <li key={e.id} className="relative border-l-2 border-border py-2 pl-4">
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.5 -left-[5px] size-2 rounded-full",
                  e.kind === "stage" ? "bg-primary" : e.kind === "checklist" ? "bg-emerald-600" : "bg-muted-foreground/50",
                )}
              />
              <p className="text-[15px] leading-snug font-medium">{e.title}</p>
              {e.lines.length ? (
                <ul className="mt-0.5 text-sm text-muted-foreground">
                  {e.lines.map((l, i) => (
                    <li key={i} className="break-words whitespace-pre-wrap">
                      {l}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.who} · {times[e.id]}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
