"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, Trash2 } from "lucide-react";
import { deleteQuote, setQuoteArchived } from "@/server/actions/estimates";

/**
 * v3 item 6. Drafts: Delete (soft, with confirm). Sent / sold estimates: Archive or Restore.
 * The database decides which is allowed (0017); this only offers the right button.
 */
export function EstimateActions({
  quoteId,
  label,
  record,
  archived,
  redirectTo,
}: {
  quoteId: string;
  label: string;
  /** Sent to the client (has a number) or no longer a draft: archive only. */
  record: boolean;
  archived: boolean;
  /** Where to go after a delete (the deal's Estimate tab when used on the estimate page). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go(kind: "delete" | "archive" | "restore") {
    const ask =
      kind === "delete"
        ? `Delete ${label}? It disappears from the deal. This can't be undone.`
        : kind === "archive"
          ? `Archive ${label}? It moves to "Archived" and stops being the estimate the {link} text sends.`
          : null;
    if (ask && !window.confirm(ask)) return;
    setError(null);
    start(async () => {
      const res =
        kind === "delete"
          ? await deleteQuote({ quote_id: quoteId })
          : await setQuoteArchived({ quote_id: quoteId, archived: kind === "archive" });
      if (res && !res.ok) {
        setError(res.error ?? "Couldn't do that");
        return;
      }
      if (kind === "delete" && redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  const kind = !record ? "delete" : archived ? "restore" : "archive";
  const Icon = kind === "delete" ? Trash2 : kind === "archive" ? Archive : ArchiveRestore;
  const text = kind === "delete" ? "Delete" : kind === "archive" ? "Archive" : "Restore";
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => go(kind)}
        disabled={pending}
        aria-label={`${text} ${label}`}
        className={
          "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold " +
          (kind === "delete" ? "text-destructive" : "text-muted-foreground")
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        {text}
      </button>
      {error ? <span className="max-w-56 text-right text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
