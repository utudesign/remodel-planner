"use client";

import { useMemo, useState, useTransition } from "react";
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
import { LayoutGrid, List, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { TaskDialog, type TaskForEdit } from "@/components/projects/task-dialog";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/server/actions/work";

const STATUSES = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "Doing" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
] as const;

type Task = TaskForEdit & { sort_order: number };

export function TaskPanel({
  projectId,
  tasks: initial,
  milestones,
  team,
  today,
  canEdit,
}: {
  projectId: string;
  tasks: Task[];
  milestones: { id: string; name: string; sort_order: number }[];
  team: { id: string; name: string }[];
  today: string;
  canEdit: boolean;
}) {
  const [view, setView] = useState<"list" | "board">("list");
  const [tasks, setTasks] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setTasks(initial);
  }
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function changeStatus(taskId: string, status: string) {
    const before = tasks;
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, status } : t)));
    setError(null);
    start(async () => {
      const r = await setTaskStatus({ task_id: taskId, status });
      if (!r?.ok) {
        setTasks(before);
        setError(r?.error ?? "Could not update the task");
      }
    });
  }

  const punch = tasks.filter((t) => t.kind === "punch");
  const work = tasks.filter((t) => t.kind !== "punch");
  const openPunch = punch.filter((t) => t.status !== "done").length;

  return (
    <div className="flex flex-col gap-5">
      {error ? <ErrorState message={error} /> : null}

      <section className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Punch list</h3>
            <p className="text-xs text-muted-foreground">
              {openPunch === 0
                ? "Clear — nothing blocks closing."
                : `${openPunch} open · must be 0 to close the project`}
            </p>
          </div>
          {canEdit ? (
            <TaskDialog projectId={projectId} kind="punch" milestones={milestones} team={team} />
          ) : null}
        </div>
        {punch.length === 0 ? (
          <p className="text-sm text-muted-foreground">Written at the final walkthrough.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {punch.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                today={today}
                onStatus={changeStatus}
                editor={
                  canEdit ? (
                    <EditButton
                      projectId={projectId}
                      task={t}
                      milestones={milestones}
                      team={team}
                    />
                  ) : null
                }
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Tasks</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border p-0.5">
              <Button
                size="sm"
                variant={view === "list" ? "secondary" : "ghost"}
                className="h-7"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
              >
                <List /> List
              </Button>
              <Button
                size="sm"
                variant={view === "board" ? "secondary" : "ghost"}
                className="h-7"
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
              >
                <LayoutGrid /> Board
              </Button>
            </div>
            {canEdit ? (
              <TaskDialog projectId={projectId} milestones={milestones} team={team} />
            ) : null}
          </div>
        </div>
        {work.length === 0 ? (
          <EmptyState
            title="No tasks"
            description="Add tasks or set a default task template in Settings."
          />
        ) : view === "list" ? (
          <TaskList
            tasks={work}
            milestones={milestones}
            today={today}
            onStatus={changeStatus}
            projectId={projectId}
            team={team}
            canEdit={canEdit}
          />
        ) : (
          <TaskBoard tasks={work} today={today} onStatus={changeStatus} />
        )}
      </section>
    </div>
  );
}

function EditButton(props: {
  projectId: string;
  task: TaskForEdit;
  milestones: { id: string; name: string }[];
  team: { id: string; name: string }[];
}) {
  return (
    <TaskDialog
      {...props}
      trigger={
        <Button size="icon" variant="ghost" aria-label="Edit task" className="size-8">
          <Pencil className="size-4" />
        </Button>
      }
    />
  );
}

function TaskList({
  tasks,
  milestones,
  today,
  onStatus,
  projectId,
  team,
  canEdit,
}: {
  tasks: Task[];
  milestones: { id: string; name: string; sort_order: number }[];
  today: string;
  onStatus: (id: string, s: string) => void;
  projectId: string;
  team: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const groups = useMemo(() => {
    const order = [...milestones].sort((a, b) => a.sort_order - b.sort_order);
    const out = order
      .map((m) => ({ id: m.id, name: m.name, items: tasks.filter((t) => t.milestone_id === m.id) }))
      .filter((g) => g.items.length);
    const loose = tasks.filter(
      (t) => !t.milestone_id || !milestones.some((m) => m.id === t.milestone_id),
    );
    if (loose.length) out.push({ id: "none", name: "Other", items: loose });
    return out;
  }, [tasks, milestones]);

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.id} className="rounded-xl border bg-card p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g.name}
          </p>
          <ul className="flex flex-col divide-y">
            {g.items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                today={today}
                onStatus={onStatus}
                editor={
                  canEdit ? (
                    <EditButton
                      projectId={projectId}
                      task={t}
                      milestones={milestones}
                      team={team}
                    />
                  ) : null
                }
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TaskRow({
  task: t,
  today,
  onStatus,
  editor,
}: {
  task: Task;
  today: string;
  onStatus: (id: string, s: string) => void;
  editor: React.ReactNode;
}) {
  const overdue = t.status !== "done" && !!t.due_date && t.due_date < today;
  return (
    <li className="flex items-center gap-2 py-2">
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-primary"
        checked={t.status === "done"}
        onChange={(e) => onStatus(t.id, e.target.checked ? "done" : "todo")}
        aria-label={`Mark ${t.title} done`}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", t.status === "done" && "text-muted-foreground line-through")}>
          {t.title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {t.trade ? <span>{t.trade}</span> : null}
          {t.assignee ? <span>· {t.assignee.name}</span> : null}
          {t.due_date ? (
            <span className={cn(overdue && "font-medium text-destructive")}>
              · due {formatDate(t.due_date)}
            </span>
          ) : null}
          {t.status === "blocked" ? <Badge variant="destructive">Blocked</Badge> : null}
          {t.priority === "high" ? <Badge variant="warning">High</Badge> : null}
        </div>
        {t.status === "blocked" && t.description ? (
          <p className="text-xs text-destructive">{t.description}</p>
        ) : null}
      </div>
      <NativeSelect
        aria-label="Status"
        value={t.status}
        onChange={(e) => onStatus(t.id, e.target.value)}
        className="h-8 w-28 text-xs md:h-8"
      >
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </NativeSelect>
      {editor}
    </li>
  );
}

function TaskBoard({
  tasks,
  today,
  onStatus,
}: {
  tasks: Task[];
  today: string;
  onStatus: (id: string, s: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  function onDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const status = e.over ? String(e.over.id) : null;
    const t = tasks.find((x) => x.id === id);
    if (t && status && t.status !== status) onStatus(id, status);
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {STATUSES.map((s) => (
          <StatusColumn
            key={s.key}
            id={s.key}
            label={s.label}
            count={tasks.filter((t) => t.status === s.key).length}
          >
            {tasks
              .filter((t) => t.status === s.key)
              .map((t) => (
                <DraggableTask key={t.id} id={t.id}>
                  <div className="rounded-md border bg-card p-2 text-sm shadow-xs">
                    <p>{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.trade ?? ""}
                      {t.due_date ? (
                        <span
                          className={cn(
                            t.status !== "done" && t.due_date < today && "text-destructive",
                          )}
                        >
                          {" "}
                          · {formatDate(t.due_date)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </DraggableTask>
              ))}
          </StatusColumn>
        ))}
      </div>
    </DndContext>
  );
}

function StatusColumn({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-64 shrink-0 snap-start flex-col gap-2 rounded-xl bg-muted/60 p-2 md:w-auto",
        isOver && "bg-accent ring-2 ring-ring/40",
        id === "blocked" && count > 0 && "bg-destructive/10",
      )}
    >
      <header className="flex justify-between px-1 text-sm font-semibold">
        {label}
        <span className="text-xs font-normal text-muted-foreground">{count}</span>
      </header>
      <div className="flex min-h-16 flex-col gap-2">{children}</div>
    </section>
  );
}

function DraggableTask({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn("touch-manipulation", isDragging && "relative z-10 opacity-80")}
    >
      {children}
    </div>
  );
}
