"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Loader2 } from "lucide-react";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { moveJobToPhase } from "@/server/actions/jobs-pm";

/**
 * Jobs board (change request v3 item 13): one column per phase, a card per job. Drag a card to another column
 * (or use "Move to" on a phone) and the job is in that phase: earlier phases are done, this one is "doing".
 */

export type BoardCard = {
  projectId: string;
  number: string;
  name: string;
  phase: string; // phase key or "done"
  pct: number;
  next: string | null;
  nextDate: string | null;
  late: number;
  warnings: number;
  people: string[]; // initials
};

export function PmBoard({ columns, cards }: { columns: { key: string; label: string }[]; cards: BoardCard[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const phaseOf = (c: BoardCard) => local[c.projectId] ?? c.phase;

  const move = (projectId: string, phase: string) => {
    if (phase === "done") return; // finishing happens on the job's tasks
    setLocal((m) => ({ ...m, [projectId]: phase }));
    setMoving(projectId);
    setError(null);
    start(async () => {
      const r = await moveJobToPhase({ project_id: projectId, phase_key: phase });
      if (r && !r.ok) {
        setError(r.error ?? "Couldn't move it");
        setLocal((m) => {
          const n = { ...m };
          delete n[projectId];
          return n;
        });
      }
      setMoving(null);
      router.refresh();
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id;
    if (typeof to !== "string") return;
    const card = cards.find((c) => c.projectId === e.active.id);
    if (card && phaseOf(card) !== to) move(card.projectId, to);
  };

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:px-0">
          {columns.map((col) => {
            const list = cards.filter((c) => phaseOf(c) === col.key);
            return (
              <Column key={col.key} id={col.key} label={col.label} count={list.length}>
                {list.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-muted-foreground">No jobs</p>
                ) : (
                  list.map((c) => (
                    <Card
                      key={c.projectId}
                      card={c}
                      columns={columns}
                      busy={pending && moving === c.projectId}
                      onMove={(p) => move(c.projectId, p)}
                      phase={phaseOf(c)}
                    />
                  ))
                )}
              </Column>
            );
          })}
        </div>
      </DndContext>
      <p className="text-xs text-muted-foreground">Drag a job to another phase, or use Move to. Swipe sideways for more phases.</p>
    </div>
  );
}

function Column({ id, label, count, children }: { id: string; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[80vw] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-2xl bg-secondary/60 p-2 sm:w-64 lg:min-h-[50vh] lg:max-w-none lg:min-w-60 lg:flex-1",
        isOver && "ring-2 ring-primary",
      )}
    >
      <h3 className="flex items-center justify-between px-1 pt-1 text-sm font-bold">
        {label} <span className="text-xs font-semibold text-muted-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function Card({
  card: c,
  columns,
  busy,
  onMove,
  phase,
}: {
  card: BoardCard;
  columns: { key: string; label: string }[];
  busy: boolean;
  onMove: (phase: string) => void;
  phase: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.projectId });
  return (
    <article
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined}
      className={cn(
        "rounded-xl bg-card p-2.5 shadow-xs ring-1 ring-border",
        isDragging && "z-10 opacity-80 shadow-lg",
        c.late > 0 && "ring-destructive/60",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          aria-label={`Drag #${c.number}`}
          className="-ml-1 flex h-9 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Link href={`/jobs/${c.number}`} className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-muted-foreground tabular-nums">#{c.number}</p>
          <p className="truncate text-[15px] font-semibold">{c.name}</p>
          <p className={cn("truncate text-xs", c.late ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {c.next ? `Next: ${c.next}${c.nextDate ? ` · ${c.nextDate}` : ""}` : "All tasks done"}
            {c.late ? ` · ${c.late} late` : ""}
          </p>
        </Link>
        {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${c.pct}%` }} />
        </div>
        <span className="text-[11px] font-semibold tabular-nums">{c.pct}%</span>
      </div>
      <div className="mt-2 flex items-center gap-1">
        {c.people.slice(0, 4).map((p) => (
          <span key={p} className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
            {p}
          </span>
        ))}
        {c.warnings ? (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-600">
            <AlertTriangle className="size-3" /> {c.warnings}
          </span>
        ) : null}
        <NativeSelect
          aria-label={`Move #${c.number} to`}
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
          className="ml-auto h-8 w-auto py-0 text-xs"
        >
          <option value="">Move to…</option>
          {columns
            .filter((x) => x.key !== "done" && x.key !== phase)
            .map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
        </NativeSelect>
      </div>
    </article>
  );
}
