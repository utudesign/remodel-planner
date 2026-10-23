"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { MarkLostDialog } from "@/components/leads/mark-lost-dialog";
import { moveLeadStage, reopenLead } from "@/server/actions/leads";

export function StageControl({
  leadId,
  stageId,
  stageKey,
  stages,
  reasons,
}: {
  leadId: string;
  stageId: string;
  stageKey: string;
  stages: { id: string; key: string; label: string }[];
  reasons: { id: string; label: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lostOpen, setLostOpen] = useState(false);
  const open = stages.filter((s) => s.key !== "won" && s.key !== "lost");

  if (stageKey === "won") return null;

  if (stageKey === "lost") {
    return (
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reopenLead({ deal_id: leadId });
            if (!r?.ok) setError(r?.error ?? "Could not reopen");
          })
        }
      >
        Reopen lead
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <NativeSelect
          aria-label="Stage"
          value={stageId}
          disabled={pending}
          onChange={(e) => {
            const value = e.target.value;
            setError(null);
            start(async () => {
              const r = await moveLeadStage({ deal_id: leadId, stage_id: value });
              if (!r?.ok) setError(r?.error ?? "Could not change stage");
            });
          }}
        >
          {open.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <Button variant="outline" onClick={() => setLostOpen(true)}>
          Mark lost
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <MarkLostDialog
        leadId={leadId}
        reasons={reasons}
        open={lostOpen}
        onOpenChange={setLostOpen}
      />
    </div>
  );
}
