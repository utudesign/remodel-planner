"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { closeProject } from "@/server/actions/projects";

/** Close gate (spec §3B). The DB re-checks everything; this shows the same reasons up front. */
export function ClosePanel({
  projectId,
  blockers,
  isAdmin,
  closed,
}: {
  projectId: string;
  blockers: string[];
  isAdmin: boolean;
  closed: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (closed) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" /> Closed. Margin is locked; admin edits are logged.
      </p>
    );
  }
  const checks = [
    { label: "Balance due is $0", ok: !blockers.some((b) => b.startsWith("Balance")) },
    { label: "Punch list clear", ok: !blockers.some((b) => b.includes("punch")) },
    { label: "Actual costs entered", ok: !blockers.some((b) => b.includes("cost")) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.ok ? (
              <CheckCircle2 className="size-4 text-success" />
            ) : (
              <XCircle className="size-4 text-destructive" />
            )}
            {c.label}
          </li>
        ))}
      </ul>
      {blockers.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {isAdmin ? (
        <Button
          disabled={blockers.length > 0 || pending}
          onClick={() =>
            start(async () => {
              const r = await closeProject({ project_id: projectId });
              setMsg({
                ok: !!r?.ok,
                text: r?.ok ? (r.message ?? "Closed") : (r?.error ?? "Could not close"),
              });
            })
          }
        >
          <Lock /> Close project &amp; lock margin
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">An admin closes the project.</p>
      )}
      {msg ? (
        <p className={msg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{msg.text}</p>
      ) : null}
    </div>
  );
}
