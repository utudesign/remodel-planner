"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/states";
import { FollowUpBadge } from "@/components/shared/follow-up-badge";
import { MarkLostDialog } from "@/components/leads/mark-lost-dialog";
import { formatBudget } from "@/lib/money";
import { cn } from "@/lib/utils";
import { moveLeadStage } from "@/server/actions/leads";
import type { BoardLead } from "@/server/queries/leads";

type Stage = { id: string; key: string; label: string };
type Reason = { id: string; label: string };

const SCOPE_LABEL: Record<string, string> = {
  cabinets: "Cabinets",
  counters: "Counters",
  full: "Full remodel",
  other: "Other",
};

function daysSince(iso: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000));
}

export function LeadBoard({
  stages,
  leads: initial,
  reasons,
  tz,
  nowIso,
}: {
  stages: Stage[];
  leads: BoardLead[];
  reasons: Reason[];
  tz: string;
  nowIso: string;
}) {
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const [leads, setLeads] = useState(initial);
  const [dragging, setDragging] = useState<BoardLead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lostLead, setLostLead] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Keep in sync after server revalidation.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setLeads(initial);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const columns = stages.filter((s) => s.key !== "won");
  const lostCutoff = now.getTime() - 60 * 86_400_000;

  function onDragStart(e: DragStartEvent) {
    setDragging(leads.find((l) => l.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const leadId = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || !stageId || lead.stage_id === stageId) return;
    const target = stages.find((s) => s.id === stageId);
    if (!target) return;
    if (target.key === "lost") {
      setLostLead(leadId);
      return;
    }
    setError(null);
    const before = leads;
    setLeads((ls) =>
      ls.map((l) =>
        l.id === leadId
          ? { ...l, stage_id: stageId, stage_entered_at: new Date().toISOString() }
          : l,
      ),
    );
    startTransition(async () => {
      const res = await moveLeadStage({ lead_id: leadId, stage_id: stageId });
      if (!res?.ok) {
        setLeads(before);
        setError(res?.error ?? "Could not move the lead");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState message={error} /> : null}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {columns.map((stage) => {
            const items = leads.filter(
              (l) =>
                l.stage_id === stage.id &&
                (stage.key !== "lost" || new Date(l.stage_entered_at).getTime() >= lostCutoff),
            );
            return (
              <Column key={stage.id} stage={stage} count={items.length}>
                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    {stage.key === "lost" ? "Drop here to mark lost" : "No leads"}
                  </p>
                ) : (
                  items.map((l) => (
                    <DraggableCard key={l.id} id={l.id}>
                      <LeadCard lead={l} tz={tz} now={now} lost={stage.key === "lost"} />
                    </DraggableCard>
                  ))
                )}
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {dragging ? (
            <div className="w-72 rotate-2 shadow-lg">
              <LeadCard lead={dragging} tz={tz} now={now} lost={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <MarkLostDialog
        leadId={lostLead}
        reasons={reasons}
        open={!!lostLead}
        onOpenChange={(o) => !o && setLostLead(null)}
      />
    </div>
  );
}

function Column({
  stage,
  count,
  children,
}: {
  stage: Stage;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[85vw] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-xl bg-muted/60 p-2 transition-colors sm:w-72",
        isOver && "bg-accent ring-2 ring-ring/40",
        stage.key === "lost" && "bg-muted/30",
      )}
    >
      <header className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-sm font-semibold">{stage.label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("touch-manipulation", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
}

function LeadCard({
  lead,
  tz,
  now,
  lost,
}: {
  lead: BoardLead;
  tz: string;
  now: Date;
  lost: boolean;
}) {
  const days = daysSince(lead.stage_entered_at, now);
  return (
    <article className="rounded-lg border bg-card p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="font-medium leading-tight hover:underline">
          {lead.name}
        </Link>
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            aria-label={`Call ${lead.name}`}
            className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Phone className="size-4" />
          </a>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
        {lead.scope ? (
          <Badge variant="outline">{SCOPE_LABEL[lead.scope] ?? lead.scope}</Badge>
        ) : null}
        <Badge variant="outline">
          {formatBudget(lead.budget_min_cents, lead.budget_max_cents)}
        </Badge>
        <span className="text-muted-foreground">
          {days === 0 ? "new in stage" : `${days}d in stage`}
        </span>
      </div>
      {!lost ? (
        <div className="mt-2">
          <FollowUpBadge at={lead.next_follow_up_at} tz={tz} now={now} />
        </div>
      ) : null}
    </article>
  );
}
