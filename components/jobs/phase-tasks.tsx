"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, Camera, Check, ChevronDown, Loader2, MessageSquare, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { fmt12, hoursWarnings, isLate, progress, type SiteRules, type TaskStatus } from "@/lib/jobs/pm";
import { cn } from "@/lib/utils";
import { addPmTask, addTaskComment, deleteTask, moveTask, updateTask } from "@/server/actions/jobs-pm";
import type { JobTask } from "@/server/queries/jobs-pm";

/** A job's tasks grouped by phase, Asana-style (change request v3 item 13). Every change saves at once. */

export const STATUS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: "todo", label: "To do", tone: "bg-secondary text-muted-foreground" },
  { key: "doing", label: "Doing", tone: "bg-accent text-accent-foreground" },
  { key: "blocked", label: "Blocked", tone: "bg-destructive text-white" },
  { key: "done", label: "Done", tone: "bg-primary text-primary-foreground" },
];

export type Person = { id: string; name: string };
export type Comment = { id: string; task_id: string; body: string; author_id: string | null; created_at: string; photo_url: string | null };

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const shortDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

export function PhaseTasks({
  projectId,
  tasks,
  phases,
  trades,
  people,
  comments,
  rules,
  today,
  conflicts,
}: {
  projectId: string;
  tasks: JobTask[];
  phases: { key: string; label: string }[];
  trades: { key: string; label: string }[];
  people: Person[];
  comments: Comment[];
  rules: SiteRules | null;
  today: string;
  /** task id → "Bagi is also on #26-1004 Nov 4" */
  conflicts: Record<string, string[]>;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = [
    ...phases.map((p) => ({ key: p.key, label: p.label, items: tasks.filter((t) => t.phase_key === p.key) })),
    { key: "", label: "Other tasks", items: tasks.filter((t) => !t.phase_key || !phases.some((p) => p.key === t.phase_key)) },
  ];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const pct = progress(tasks);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-semibold tabular-nums">{pct}%</span>
      </div>
      {groups.map((g) =>
        g.items.length || g.key ? (
          <section key={g.key || "other"}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {g.label} <span className="tabular-nums">· {progress(g.items)}%</span>
              </h3>
              <AddTask projectId={projectId} phaseKey={g.key || null} />
            </div>
            {g.items.length === 0 ? (
              <p className="py-1 text-sm text-muted-foreground">No tasks.</p>
            ) : (
              <ul className="flex flex-col divide-y overflow-hidden rounded-xl ring-1 ring-border">
                {g.items.map((t) => (
                  <TaskRow
                    key={`${t.id}:${t.status}:${t.pct}:${t.start_on}:${t.end_on}:${t.assignee_id}:${t.title}:${t.start_time}:${t.end_time}:${t.trade_key}:${t.phase_key}`}
                    task={t}
                    open={open === t.id}
                    onToggle={() => setOpen(open === t.id ? null : t.id)}
                    assignee={t.assignee_id ? (nameOf.get(t.assignee_id) ?? null) : null}
                    late={isLate(t, today)}
                    warnings={[...hoursWarnings(t, rules), ...(conflicts[t.id] ?? [])]}
                    phases={phases}
                    trades={trades}
                    people={people}
                    comments={comments.filter((c) => c.task_id === t.id)}
                    nameOf={nameOf}
                  />
                ))}
              </ul>
            )}
          </section>
        ) : null,
      )}
    </div>
  );
}

function AddTask({ projectId, phaseKey }: { projectId: string; phaseKey: string | null }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  if (!adding) {
    return (
      <button type="button" onClick={() => setAdding(true)} className="inline-flex h-9 items-center gap-1 px-2 text-sm font-semibold text-primary">
        <Plus className="size-4" /> Task
      </button>
    );
  }
  return (
    <form
      className="flex flex-1 items-center gap-2 pl-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addPmTask({ project_id: projectId, title, phase_key: phaseKey });
          if (r && !r.ok) setErr(r.error ?? "Couldn't add");
          else {
            setTitle("");
            setAdding(false);
            router.refresh();
          }
        });
      }}
    >
      <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task" className="h-9" />
      <Button type="submit" size="sm" disabled={!title.trim() || pending}>
        {pending ? <Loader2 className="animate-spin" /> : "Add"}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
        Cancel
      </Button>
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
    </form>
  );
}

function TaskRow({
  task: t,
  open,
  onToggle,
  assignee,
  late,
  warnings,
  phases,
  trades,
  people,
  comments,
  nameOf,
}: {
  task: JobTask;
  open: boolean;
  onToggle: () => void;
  assignee: string | null;
  late: boolean;
  warnings: string[];
  phases: { key: string; label: string }[];
  trades: { key: string; label: string }[];
  people: Person[];
  comments: Comment[];
  nameOf: Map<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const save = (patch: Parameters<typeof updateTask>[0]) =>
    start(async () => {
      await updateTask(patch);
      router.refresh();
    });
  const st = STATUS.find((x) => x.key === t.status)!;
  const done = t.status === "done";
  return (
    <li className={cn("bg-card", open && "bg-secondary/40")}>
      <div className="flex min-h-14 items-center gap-2 px-2 py-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen ${t.title}` : `Mark ${t.title} done`}
          disabled={pending}
          onClick={() => save({ id: t.id, status: done ? "doing" : "done" })}
          className="flex size-11 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full",
              done ? "bg-primary text-primary-foreground" : "ring-2 ring-input",
            )}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : done ? <Check className="size-3.5" /> : null}
          </span>
        </button>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 py-1 text-left" aria-expanded={open}>
          <span className={cn("block truncate text-[15px] font-medium", done && "text-muted-foreground line-through")}>{t.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", st.tone)}>{st.label}</span>
            {t.start_on ? (
              <span className={cn(late && "font-semibold text-destructive")}>
                {shortDate(t.start_on)}
                {t.end_on && t.end_on !== t.start_on ? `–${shortDate(t.end_on)}` : ""}
                {t.start_time ? ` ${fmt12(t.start_time)}` : ""}
                {late ? " · late" : ""}
              </span>
            ) : (
              <span>no date</span>
            )}
            {!done && t.pct > 0 ? <span className="tabular-nums">{t.pct}%</span> : null}
            {comments.length ? (
              <span className="inline-flex items-center gap-0.5">
                <MessageSquare className="size-3" /> {comments.length}
              </span>
            ) : null}
            {warnings.length ? (
              <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                <AlertTriangle className="size-3" /> {warnings.length}
              </span>
            ) : null}
          </span>
        </button>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            assignee ? "bg-accent text-accent-foreground" : "text-muted-foreground ring-1 ring-dashed ring-border",
          )}
          title={assignee ?? "Unassigned"}
        >
          {assignee ? initials(assignee) : <Users className="size-3.5" />}
        </span>
        <button type="button" onClick={onToggle} aria-label="Details" className="flex size-9 items-center justify-center text-muted-foreground">
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <div className="border-t px-3 py-3">
          <TaskEditor task={t} warnings={warnings} phases={phases} trades={trades} people={people} comments={comments} nameOf={nameOf} />
        </div>
      ) : null}
    </li>
  );
}

/** The task's full editor (assignee, trade, status, %, dates, times, phase, notes, comments). Used inline and in the drawer. */
export function TaskEditor({
  task: t,
  warnings,
  phases,
  trades,
  people,
  comments,
  nameOf,
  onDeleted,
}: {
  task: JobTask;
  warnings: string[];
  phases: { key: string; label: string }[];
  trades: { key: string; label: string }[];
  people: Person[];
  comments: Comment[];
  nameOf: Map<string, string>;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [pct, setPct] = useState(t.pct);
  const save = (patch: Parameters<typeof updateTask>[0]) =>
    start(async () => {
      setErr(null);
      const r = await updateTask(patch);
      if (r && !r.ok) setErr(r.error ?? "Couldn't save");
      router.refresh();
    });
  return (
        <div className="flex flex-col gap-3">
          {warnings.length ? (
            <ul className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
              {warnings.map((w) => (
                <li key={w} className="flex gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          ) : null}
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Task
            <Input
              defaultValue={t.title}
              onBlur={(e) => e.target.value.trim() && e.target.value !== t.title && save({ id: t.id, title: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Assignee
              <NativeSelect defaultValue={t.assignee_id ?? ""} onChange={(e) => save({ id: t.id, assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Trade
              <NativeSelect defaultValue={t.trade_key ?? ""} onChange={(e) => save({ id: t.id, trade_key: e.target.value || null })}>
                <option value="">—</option>
                {trades.map((x) => (
                  <option key={x.key} value={x.key}>
                    {x.label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Status</span>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  disabled={pending}
                  aria-pressed={t.status === x.key}
                  onClick={() => save({ id: t.id, status: x.key })}
                  className={cn(
                    "h-10 rounded-lg text-sm font-semibold ring-1",
                    t.status === x.key ? cn(x.tone, "ring-transparent") : "bg-card ring-border",
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            <span className="flex justify-between">
              % complete <span className="font-semibold text-foreground tabular-nums">{pct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              onPointerUp={() => pct !== t.pct && save({ id: t.id, pct })}
              onKeyUp={() => pct !== t.pct && save({ id: t.id, pct })}
              className="h-11 w-full accent-[var(--color-primary)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Start
              <Input type="date" defaultValue={t.start_on ?? ""} onChange={(e) => save({ id: t.id, start_on: e.target.value || null })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Finish
              <Input type="date" defaultValue={t.end_on ?? ""} onChange={(e) => save({ id: t.id, end_on: e.target.value || null })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              From (optional)
              <Input
                type="time"
                defaultValue={t.start_time?.slice(0, 5) ?? ""}
                onChange={(e) => save({ id: t.id, start_time: e.target.value || null })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Until (optional)
              <Input
                type="time"
                defaultValue={t.end_time?.slice(0, 5) ?? ""}
                onChange={(e) => save({ id: t.id, end_time: e.target.value || null })}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Phase
            <NativeSelect defaultValue={t.phase_key ?? ""} onChange={(e) => save({ id: t.id, phase_key: e.target.value || null })}>
              <option value="">Other tasks</option>
              {phases.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Notes
            <Textarea
              defaultValue={t.notes ?? ""}
              rows={2}
              onBlur={(e) => (e.target.value || null) !== (t.notes || null) && save({ id: t.id, notes: e.target.value || null })}
            />
          </label>

          <Comments taskId={t.id} comments={comments} nameOf={nameOf} />

          <div className="flex items-center justify-between gap-2 border-t pt-2">
            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move up"
                disabled={pending}
                onClick={() => start(async () => void (await moveTask({ id: t.id, dir: "up" }), router.refresh()))}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move down"
                disabled={pending}
                onClick={() => start(async () => void (await moveTask({ id: t.id, dir: "down" }), router.refresh()))}
              >
                <ArrowDown />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete "${t.title}"?`)) return;
                start(async () => {
                  await deleteTask({ id: t.id });
                  onDeleted?.();
                  router.refresh();
                });
              }}
            >
              <Trash2 /> Delete task
            </Button>
          </div>
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </div>
  );
}

function Comments({ taskId, comments, nameOf }: { taskId: string; comments: Comment[]; nameOf: Map<string, string> }) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof addTaskComment>>, fd: FormData) => {
    const r = await addTaskComment(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Comments + photos</span>
      {comments.length ? (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-card p-2 ring-1 ring-border">
              <p className="text-xs text-muted-foreground">
                {(c.author_id && nameOf.get(c.author_id)) || "Someone"} ·{" "}
                {new Date(c.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "America/New_York",
                })}
              </p>
              {c.body ? <p className="text-sm whitespace-pre-wrap">{c.body}</p> : null}
              {c.photo_url ? (
                <a href={c.photo_url} target="_blank" rel="noreferrer" className="mt-1 block w-32 overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.photo_url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <form action={action} key={state?.ok ? `${state.message}-${comments.length}` : "c"} className="flex flex-col gap-2">
        <input type="hidden" name="task_id" value={taskId} />
        <Textarea name="body" rows={2} placeholder="Comment…" />
        <div className="flex items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold">
            <Camera className="size-4" /> {fileName ? "Photo ✓" : "Photo"}
            <input
              type="file"
              name="photo"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </label>
          <NativeSelect name="tag" defaultValue="progress" className="h-10 w-auto" aria-label="Photo type">
            <option value="progress">Progress</option>
            <option value="issue">Issue</option>
          </NativeSelect>
          <SubmitButton size="sm" className="ml-auto">
            Post
          </SubmitButton>
        </div>
        <FormMessage state={state} />
      </form>
    </div>
  );
}
