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
} from "@dnd-kit/core";
import { AlertTriangle, CalendarClock, OctagonX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/shared/states";
import { Avatar } from "@/components/shared/avatar";
import { formatDate, relativeDays } from "@/lib/dates";
import { formatCentsWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import { moveProject } from "@/server/actions/projects";
import type { BoardProject } from "@/server/queries/projects";

type Column = { key: string; label: string };

export function ProjectBoard({
  columns,
  projects: initial,
  today,
  canDrag,
  unread = [],
}: {
  columns: Column[];
  projects: BoardProject[];
  today: string;
  canDrag: boolean;
  unread?: string[];
}) {
  const unreadSet = useMemo(() => new Set(unread), [unread]);
  const [projects, setProjects] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setProjects(initial);
  }
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, BoardProject[]>();
    for (const c of columns) map.set(c.key, []);
    for (const p of projects) {
      const key = p.current?.key ?? "final_payment";
      (map.get(key) ?? map.get(columns.at(-1)!.key))!.push(p);
    }
    return map;
  }, [projects, columns]);

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const target = e.over ? String(e.over.id) : null;
    const project = projects.find((p) => p.id === id);
    if (!project || !target || project.current?.key === target) return;
    setError(null);
    const before = projects;
    const targetOrder = project.milestones.find((m) => m.key === target)?.sort_order ?? 0;
    setProjects((ps) =>
      ps.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              current: p.milestones.find((m) => m.key === target) ?? p.current,
              milestones: p.milestones.map((m) => ({
                ...m,
                actual_date:
                  m.sort_order < targetOrder
                    ? (m.actual_date ?? today)
                    : m.key === "deposit_received"
                      ? m.actual_date
                      : null,
              })),
            },
      ),
    );
    start(async () => {
      const r = await moveProject({ project_id: id, milestone_key: target });
      if (!r?.ok) {
        setProjects(before);
        setError(r?.error ?? "Could not move the project");
      }
    });
  }

  const dragging = projects.find((p) => p.id === dragId);

  return (
    <div className="flex flex-col gap-3">
      {error ? <ErrorState message={error} /> : null}
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
      >
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
          {columns.map((c) => (
            <BoardColumn key={c.key} column={c} count={byColumn.get(c.key)?.length ?? 0}>
              {(byColumn.get(c.key) ?? []).map((p) =>
                canDrag ? (
                  <Draggable key={p.id} id={p.id}>
                    <ProjectCard project={p} today={today} unread={unreadSet.has(p.id)} />
                  </Draggable>
                ) : (
                  <ProjectCard key={p.id} project={p} today={today} />
                ),
              )}
            </BoardColumn>
          ))}
        </div>
        <DragOverlay>
          {dragging ? (
            <div className="w-72 rotate-2 shadow-lg">
              <ProjectCard project={dragging} today={today} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumn({
  column,
  count,
  children,
}: {
  column: Column;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-[85vw] max-w-72 shrink-0 snap-start flex-col gap-2 rounded-xl bg-muted/60 p-2 sm:w-72",
        isOver && "bg-accent ring-2 ring-ring/40",
      )}
    >
      <header className="flex items-center justify-between px-1 pt-1">
        <h2 className="text-sm font-semibold">{column.label}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {count === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Empty
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Draggable({ id, children }: { id: string; children: React.ReactNode }) {
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

export function ProjectCard({
  project: p,
  today,
  unread = false,
}: {
  project: BoardProject;
  today: string;
  unread?: boolean;
}) {
  const planned = p.current?.planned_date ?? null;
  const late = planned !== null && planned < today;
  const delivery = p.milestones.find((m) => m.key === "materials_delivered");
  const deliveryOverdue =
    !!delivery?.planned_date && !delivery.actual_date && delivery.planned_date < today;
  return (
    <article className="relative rounded-lg border bg-card p-3 shadow-xs">
      {unread ? (
        <span
          aria-label="Updated"
          className="absolute top-2 -left-1 size-2.5 rounded-full bg-primary"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/projects/${p.id}`}
          className="min-w-0 font-medium leading-tight hover:underline"
        >
          {p.name}
        </Link>
        <Avatar id={p.manager?.id} name={p.manager?.name ?? "No PM"} />
      </div>
      <p className="text-xs text-muted-foreground">
        {p.client}
        {p.city ? ` · ${p.city}` : ""}
        {p.balanceDueCents !== null ? ` · balance ${formatCentsWhole(p.balanceDueCents)}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {planned ? (
          <Badge variant={late ? "destructive" : "secondary"} className="font-normal">
            <CalendarClock />
            {p.current?.name}: {formatDate(planned)} ({relativeDays(planned, today)})
          </Badge>
        ) : (
          <Badge variant="outline" className="font-normal">
            No date for {p.current?.name ?? "next step"}
          </Badge>
        )}
        {deliveryOverdue ? (
          <Badge variant="destructive">
            <AlertTriangle /> Delivery overdue
          </Badge>
        ) : null}
        {p.blocked > 0 ? (
          <Badge variant="destructive">
            <OctagonX /> {p.blocked} blocked
          </Badge>
        ) : null}
        {p.openPunch > 0 ? <Badge variant="warning">{p.openPunch} punch</Badge> : null}
      </div>
    </article>
  );
}
