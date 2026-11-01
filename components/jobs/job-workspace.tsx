"use client";

import { useMemo, useState, useTransition } from "react";
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
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TaskEditor, type Comment, type Person } from "@/components/jobs/phase-tasks";
import { addDays, fmt12, hoursWarnings, isLate, progress, type SiteRules } from "@/lib/jobs/pm";
import { STATUS_STYLE, swatchFor } from "@/lib/jobs/colors";
import { cn } from "@/lib/utils";
import { addPmTask, updateTask } from "@/server/actions/jobs-pm";
import type { JobTask } from "@/server/queries/jobs-pm";
import { VIEWS, type WorkspaceView } from "@/lib/jobs/views";

/**
 * One job as an Asana-style project (v3 item 13, redesign 2026-11-01): Overview · List · Board · Timeline ·
 * Calendar · Dashboard. Sections = the job's phases. Tap any task to open it in the side panel.
 */

type Props = {
  view: WorkspaceView;
  projectId: string;
  tasks: JobTask[];
  phases: { key: string; label: string }[];
  trades: { key: string; label: string }[];
  people: Person[];
  comments: Comment[];
  rules: SiteRules | null;
  today: string;
  conflicts: Record<string, string[]>;
  overview: React.ReactNode;
};

const short = (d: string | null) =>
  d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const range = (t: { start_on: string | null; end_on: string | null }) =>
  t.start_on
    ? t.end_on && t.end_on !== t.start_on
      ? `${short(t.start_on)} – ${short(t.end_on)}`
      : short(t.start_on)
    : "";

export function JobWorkspace(p: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = useMemo(() => new Map(p.people.map((x) => [x.id, x.name])), [p.people]);
  const sections = useMemo(
    () => [
      ...p.phases.map((ph) => ({
        key: ph.key,
        label: ph.label,
        items: p.tasks.filter((t) => t.phase_key === ph.key),
      })),
      {
        key: "",
        label: "Other tasks",
        items: p.tasks.filter(
          (t) => !t.phase_key || !p.phases.some((ph) => ph.key === t.phase_key),
        ),
      },
    ],
    [p.phases, p.tasks],
  );
  const open = p.tasks.find((t) => t.id === openId) ?? null;
  const ctx: Ctx = { ...p, nameOf, sections, open: (id) => setOpenId(id) };

  return (
    <>
      {p.view === "overview" ? p.overview : null}
      {p.view === "list" ? <ListView {...ctx} /> : null}
      {p.view === "board" ? <BoardView {...ctx} /> : null}
      {p.view === "timeline" ? <TimelineView {...ctx} /> : null}
      {p.view === "calendar" ? <CalendarView {...ctx} /> : null}
      {p.view === "dashboard" ? <DashboardView {...ctx} /> : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30"
          onClick={() => setOpenId(null)}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={open.title}
            className="flex h-full w-full flex-col overflow-y-auto bg-card shadow-2xl sm:w-[460px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card px-4 py-3">
              <p className="truncate text-lg font-bold">{open.title}</p>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                aria-label="Close"
                className="flex size-11 items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="p-4">
              <TaskEditor
                key={`${open.id}:${open.status}:${open.pct}:${open.start_on}:${open.end_on}:${open.assignee_id}:${open.title}:${open.trade_key}:${open.phase_key}`}
                task={open}
                warnings={[...hoursWarnings(open, p.rules), ...(p.conflicts[open.id] ?? [])]}
                phases={p.phases}
                trades={p.trades}
                people={p.people}
                comments={p.comments.filter((c) => c.task_id === open.id)}
                nameOf={nameOf}
                onDeleted={() => setOpenId(null)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

type Ctx = Props & {
  nameOf: Map<string, string>;
  sections: { key: string; label: string; items: JobTask[] }[];
  open: (id: string) => void;
};

// ---------------------------------------------------------------- shared bits

function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded px-1.5 text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

function Avatar({ name }: { name: string | null }) {
  return name ? (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-300 text-[11px] font-bold text-violet-950"
      title={name}
    >
      {initials(name)}
    </span>
  ) : (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border ring-dashed"
      title="Unassigned"
    >
      <UserRound className="size-3.5" />
    </span>
  );
}

function DoneCircle({ t }: { t: JobTask }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = t.status === "done";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen ${t.title}` : `Mark ${t.title} done`}
      disabled={pending}
      onClick={(e) => {
        e.stopPropagation();
        start(async () => {
          await updateTask({ id: t.id, status: done ? "doing" : "done" });
          router.refresh();
        });
      }}
      className="flex size-9 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "flex size-[18px] items-center justify-center rounded-full",
          done ? "bg-emerald-500 text-white" : "ring-1 ring-muted-foreground/60",
        )}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Check className={cn("size-3", !done && "text-muted-foreground/60")} />
        )}
      </span>
    </button>
  );
}

function AddTaskInline({
  projectId,
  phaseKey,
  className,
}: {
  projectId: string;
  phaseKey: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  if (!adding)
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className={cn(
          "flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <Plus className="size-4" /> Add task
      </button>
    );
  const submit = () =>
    title.trim()
      ? start(async () => {
          await addPmTask({ project_id: projectId, title: title.trim(), phase_key: phaseKey });
          setTitle("");
          setAdding(false);
          router.refresh();
        })
      : setAdding(false);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") setAdding(false);
        }}
        onBlur={submit}
        placeholder="Task name"
        className="h-10 flex-1 rounded-md bg-background px-2 text-sm ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
      />
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- List

function ListView(c: Ctx) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
      <table className="w-full border-collapse text-sm md:min-w-[860px]">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2.5 pl-3 font-medium">Name</th>
            <th className="w-44 hidden border-l px-3 font-medium md:table-cell">Assignee</th>
            <th className="w-36 hidden border-l px-3 font-medium md:table-cell">Dates</th>
            <th className="w-36 hidden border-l px-3 font-medium md:table-cell">Trade</th>
            <th className="w-32 hidden border-l px-3 font-medium md:table-cell">Status</th>
            <th className="w-28 hidden border-l px-3 font-medium md:table-cell">% done</th>
          </tr>
        </thead>
        {c.sections.map((s) =>
          s.items.length || s.key ? (
            <tbody key={s.key || "other"}>
              <tr>
                <td colSpan={6} className="pt-3 pb-0.5 pl-1">
                  <button
                    type="button"
                    onClick={() => setClosed((x) => ({ ...x, [s.key]: !x[s.key] }))}
                    className="flex min-h-9 items-center gap-1.5 text-base font-bold"
                    aria-expanded={!closed[s.key]}
                  >
                    <ChevronDown
                      className={cn("size-4 transition-transform", closed[s.key] && "-rotate-90")}
                    />
                    {s.label}
                    <span className="ml-1 text-xs font-medium text-muted-foreground tabular-nums">
                      {progress(s.items)}%
                    </span>
                  </button>
                </td>
              </tr>
              {closed[s.key]
                ? null
                : s.items.map((t) => {
                    const late = isLate(t, c.today);
                    const sw = swatchFor(t.trade_key, c.trades);
                    const st = STATUS_STYLE[t.status];
                    const warn =
                      hoursWarnings(t, c.rules).length + (c.conflicts[t.id]?.length ?? 0);
                    const nComments = c.comments.filter((x) => x.task_id === t.id).length;
                    return (
                      <tr
                        key={t.id}
                        onClick={() => c.open(t.id)}
                        className="cursor-pointer border-t hover:bg-secondary/50"
                      >
                        <td className="py-0.5 pl-3">
                          <div className="flex items-center gap-1">
                            <DoneCircle t={t} />
                            <span
                              className={cn(
                                "truncate font-medium",
                                t.status === "done" && "text-muted-foreground line-through",
                              )}
                            >
                              {t.title}
                            </span>
                            {nComments ? (
                              <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                {nComments} <MessageSquare className="size-3" />
                              </span>
                            ) : null}
                            {warn ? (
                              <AlertTriangle
                                className="ml-1 size-3.5 text-amber-500"
                                aria-label={`${warn} warnings`}
                              />
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 pb-1.5 pl-10 text-xs text-muted-foreground md:hidden">
                            <Chip className={st.chip}>{st.label}</Chip>
                            {sw ? <Chip className={sw.chip}>{c.trades.find((x) => x.key === t.trade_key)?.label}</Chip> : null}
                            <span className={cn(late && "font-semibold text-destructive")}>{range(t)}</span>
                            {t.assignee_id ? <span>· {c.nameOf.get(t.assignee_id)}</span> : null}
                            {t.pct > 0 && t.status !== "done" ? <span>· {t.pct}%</span> : null}
                          </div>
                        </td>
                        <td className="hidden border-l px-3 md:table-cell">
                          <div className="flex items-center gap-2">
                            <Avatar
                              name={t.assignee_id ? (c.nameOf.get(t.assignee_id) ?? null) : null}
                            />
                            <span className="truncate">
                              {t.assignee_id ? c.nameOf.get(t.assignee_id) : ""}
                            </span>
                          </div>
                        </td>
                        <td
                          className={cn(
                            "hidden border-l px-3 whitespace-nowrap md:table-cell",
                            late && "font-semibold text-destructive",
                            t.end_on === c.today && "text-emerald-600",
                          )}
                        >
                          {t.end_on === c.today && t.start_on === c.today ? "Today" : range(t)}
                          {t.start_time ? (
                            <span className="text-muted-foreground"> · {fmt12(t.start_time)}</span>
                          ) : null}
                        </td>
                        <td className="hidden border-l px-3 md:table-cell">
                          {sw ? (
                            <Chip className={sw.chip}>
                              {c.trades.find((x) => x.key === t.trade_key)?.label}
                            </Chip>
                          ) : null}
                        </td>
                        <td className="hidden border-l px-3 md:table-cell">
                          <Chip className={st.chip}>{st.label}</Chip>
                        </td>
                        <td className="hidden border-l px-3 md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${t.pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs tabular-nums">{t.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              {closed[s.key] ? null : (
                <tr className="border-t">
                  <td colSpan={6} className="pl-12">
                    <AddTaskInline projectId={c.projectId} phaseKey={s.key || null} />
                  </td>
                </tr>
              )}
            </tbody>
          ) : null,
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------- Board

function BoardView(c: Ctx) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, string | null>>({});
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );
  const phaseOf = (t: JobTask) => (t.id in local ? local[t.id] : t.phase_key) ?? "";
  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id;
    const t = c.tasks.find((x) => x.id === e.active.id);
    if (typeof to !== "string" || !t || phaseOf(t) === to) return;
    setLocal((m) => ({ ...m, [t.id]: to || null }));
    start(async () => {
      await updateTask({ id: t.id, phase_key: to || null });
      router.refresh();
    });
  };
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
        {c.sections.map((s) => {
          const items = c.tasks.filter((t) => phaseOf(t) === s.key);
          if (!s.key && !items.length) return null;
          return (
            <BoardColumn key={s.key || "other"} id={s.key} label={s.label} count={items.length}>
              {items.map((t) => (
                <BoardCard key={t.id} t={t} c={c} />
              ))}
              <AddTaskInline projectId={c.projectId} phaseKey={s.key || null} className="px-2" />
            </BoardColumn>
          );
        })}
      </div>
    </DndContext>
  );
}

function BoardColumn({
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
        "flex w-[85vw] max-w-[300px] shrink-0 snap-start flex-col gap-2 rounded-xl bg-secondary/50 p-2 sm:w-[280px]",
        isOver && "ring-2 ring-primary",
      )}
    >
      <h3 className="flex items-center gap-2 px-1 pt-1 pb-1 text-[15px] font-bold">
        {label}{" "}
        <span className="text-sm font-medium text-muted-foreground tabular-nums">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function BoardCard({ t, c }: { t: JobTask; c: Ctx }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const sw = swatchFor(t.trade_key, c.trades);
  const st = STATUS_STYLE[t.status];
  const late = isLate(t, c.today);
  const name = t.assignee_id ? (c.nameOf.get(t.assignee_id) ?? null) : null;
  return (
    <article
      ref={setNodeRef}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      {...attributes}
      {...listeners}
      onClick={() => c.open(t.id)}
      className={cn(
        "cursor-pointer touch-manipulation rounded-lg bg-card p-3 shadow-xs ring-1 ring-border hover:ring-foreground/30",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1">
        <DoneCircle t={t} />
        <p
          className={cn(
            "pt-2 text-[15px] leading-snug font-medium",
            t.status === "done" && "text-muted-foreground line-through",
          )}
        >
          {t.title}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {sw ? (
          <Chip className={sw.chip}>{c.trades.find((x) => x.key === t.trade_key)?.label}</Chip>
        ) : null}
        <Chip className={st.chip}>{st.label}</Chip>
        {t.pct > 0 && t.status !== "done" ? <Chip className="bg-secondary">{t.pct}%</Chip> : null}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-sm">
        <Avatar name={name} />
        <span className={cn(late ? "font-semibold text-destructive" : "text-muted-foreground")}>
          {range(t) || "No date"}
        </span>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------- Timeline

const DAY_W = 40;

function TimelineView(c: Ctx) {
  const dated = c.tasks.filter((t) => t.start_on);
  const starts = dated.map((t) => t.start_on!);
  const ends = dated.map((t) => t.end_on ?? t.start_on!);
  const from = addDays([c.today, ...starts].sort()[0], -3);
  const to = addDays([addDays(c.today, 21), ...ends].sort().reverse()[0], 7);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const idx = (d: string) => days.indexOf(d);
  const todayIdx = idx(c.today);
  const months: { label: string; span: number }[] = [];
  for (const d of days) {
    const label = new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long" });
    if (months.at(-1)?.label === label) months.at(-1)!.span++;
    else months.push({ label, span: 1 });
  }
  const width = days.length * DAY_W;
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <div className="flex">
        <div className="w-44 shrink-0 border-r sm:w-56">
          <div className="h-[52px] border-b" />
          {c.sections.map((s) =>
            s.items.length ? (
              <div
                key={s.key || "o"}
                className="border-b px-3 py-2"
                style={{ height: 32 + s.items.length * 40 }}
              >
                <p className="flex items-center gap-1 text-sm font-bold">
                  <ChevronDown className="size-4" />
                  {s.label}
                </p>
              </div>
            ) : null,
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <div className="flex h-[26px] border-b text-xs font-semibold">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="truncate border-r px-2 pt-1"
                  style={{ width: m.span * DAY_W }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            <div className="flex h-[26px] border-b text-[11px] text-muted-foreground">
              {days.map((d) => {
                const wd = new Date(`${d}T12:00:00`).getDay();
                return (
                  <div
                    key={d}
                    className={cn(
                      "flex items-center justify-center border-r",
                      (wd === 0 || wd === 6) && "bg-secondary/60",
                      d === c.today && "font-bold text-primary",
                    )}
                    style={{ width: DAY_W }}
                  >
                    {Number(d.slice(8))}
                  </div>
                );
              })}
            </div>
            {/* weekend shading + today line */}
            <div className="pointer-events-none absolute top-[52px] bottom-0 left-0 flex">
              {days.map((d) => {
                const wd = new Date(`${d}T12:00:00`).getDay();
                return (
                  <div
                    key={d}
                    className={cn(
                      "h-full border-r border-border/40",
                      (wd === 0 || wd === 6) && "bg-secondary/40",
                    )}
                    style={{ width: DAY_W }}
                  />
                );
              })}
            </div>
            {todayIdx >= 0 ? (
              <div
                className="pointer-events-none absolute top-[44px] bottom-0 w-0.5 bg-primary"
                style={{ left: todayIdx * DAY_W + DAY_W / 2 }}
              />
            ) : null}
            {c.sections.map((s) =>
              s.items.length ? (
                <div
                  key={s.key || "o"}
                  className="relative border-b"
                  style={{ height: 32 + s.items.length * 40 }}
                >
                  {s.items.map((t, i) => {
                    if (!t.start_on) return null;
                    const a = idx(t.start_on);
                    const b = idx(t.end_on ?? t.start_on);
                    const sw = swatchFor(t.trade_key, c.trades);
                    const late = isLate(t, c.today);
                    const warn =
                      hoursWarnings(t, c.rules).length + (c.conflicts[t.id]?.length ?? 0);
                    const name = t.assignee_id ? c.nameOf.get(t.assignee_id) : null;
                    const w = Math.max(1, b - a + 1) * DAY_W - 4;
                    const outside = w < 150; // short bars: name to the right, like Asana
                    return (
                      <div
                        key={t.id}
                        className="absolute flex items-center gap-2"
                        style={{ top: 26 + i * 40, left: a * DAY_W + 2 }}
                      >
                        <button
                          type="button"
                          onClick={() => c.open(t.id)}
                          title={`${t.title} · ${range(t)}`}
                          className={cn(
                            "flex h-8 shrink-0 items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-left text-xs font-semibold shadow-xs",
                            t.status === "done"
                              ? "bg-zinc-300 text-zinc-700 line-through"
                              : (sw?.bar ?? "bg-sky-300 text-sky-950"),
                            late && "ring-2 ring-destructive",
                            warn && !late && "ring-2 ring-amber-500",
                          )}
                          style={{ width: w }}
                        >
                          {name ? (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-[9px]">
                              {initials(name)}
                            </span>
                          ) : null}
                          {outside ? null : <span className="truncate">{t.title}</span>}
                        </button>
                        {outside ? (
                          <button
                            type="button"
                            onClick={() => c.open(t.id)}
                            className={cn(
                              "text-xs font-semibold whitespace-nowrap",
                              t.status === "done" && "text-muted-foreground line-through",
                            )}
                          >
                            {t.title}
                            <span className="ml-1 font-normal text-muted-foreground">
                              {range(t)}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null,
            )}
          </div>
        </div>
      </div>
      {c.tasks.some((t) => !t.start_on) ? (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          {c.tasks.filter((t) => !t.start_on).length} task(s) without dates aren&apos;t on the
          timeline. Open one from the List to set dates.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- Calendar

function CalendarView(c: Ctx) {
  const [month, setMonth] = useState(c.today.slice(0, 7));
  const first = `${month}-01`;
  const startWd = new Date(`${first}T12:00:00`).getDay();
  const gridStart = addDays(first, -startWd);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(gridStart, w * 7 + i));
    if (w > 3 && week[0].slice(0, 7) !== month) break;
    weeks.push(week);
  }
  const shift = (n: number) => {
    const d = new Date(`${first}T12:00:00`);
    d.setMonth(d.getMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const label = new Date(`${first}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="flex size-10 items-center justify-center rounded-md hover:bg-secondary"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setMonth(c.today.slice(0, 7))}
          className="h-9 rounded-md px-3 text-sm font-semibold ring-1 ring-border"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="flex size-10 items-center justify-center rounded-md hover:bg-secondary"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="ml-2 font-semibold">{label}</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b text-xs font-semibold text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2 py-1.5">
                {d}
              </div>
            ))}
          </div>
          {weeks.map((week) => {
            const ws = week[0];
            const we = week[6];
            const bars = c.tasks
              .filter((t) => t.start_on && t.start_on <= we && (t.end_on ?? t.start_on) >= ws)
              .sort((a, b) => (a.start_on! < b.start_on! ? -1 : 1));
            return (
              <div key={ws} className="relative grid min-h-44 grid-cols-7 border-b">
                {week.map((d) => (
                  <div
                    key={d}
                    className={cn(
                      "border-r px-2 pt-1.5",
                      d.slice(0, 7) !== month && "bg-secondary/40 text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-sm font-semibold",
                        d === c.today && "bg-primary text-primary-foreground",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                  </div>
                ))}
                <div className="absolute inset-x-0 top-9 grid grid-cols-7 gap-y-1 px-0.5">
                  {bars.slice(0, 5).map((t) => {
                    const a = Math.max(0, week.indexOf(t.start_on! < ws ? ws : t.start_on!));
                    const end = (t.end_on ?? t.start_on)!;
                    const b = end > we ? 6 : week.indexOf(end);
                    const sw = swatchFor(t.trade_key, c.trades);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => c.open(t.id)}
                        className={cn(
                          "mx-0.5 truncate rounded px-2 py-1 text-left text-xs font-semibold",
                          t.status === "done"
                            ? "bg-zinc-300 text-zinc-700 line-through"
                            : (sw?.bar ?? "bg-sky-300 text-sky-950"),
                        )}
                        style={{ gridColumn: `${a + 1} / ${b + 2}` }}
                        title={`${t.title} · ${range(t)}`}
                      >
                        {t.title}
                      </button>
                    );
                  })}
                  {bars.length > 5 ? (
                    <span className="col-span-7 px-2 text-xs text-muted-foreground">
                      +{bars.length - 5} more
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Dashboard

const CHART = "#a78bfa";

function DashboardView(c: Ctx) {
  const done = c.tasks.filter((t) => t.status === "done").length;
  const overdue = c.tasks.filter((t) => isLate(t, c.today)).length;
  const bySection = c.sections
    .filter((s) => s.items.length)
    .map((s) => ({ name: s.label, open: s.items.filter((t) => t.status !== "done").length }));
  const byPerson = new Map<string, number>();
  for (const t of c.tasks)
    if (t.status !== "done")
      byPerson.set(
        t.assignee_id ? (c.nameOf.get(t.assignee_id) ?? "?") : "Unassigned",
        (byPerson.get(t.assignee_id ? (c.nameOf.get(t.assignee_id) ?? "?") : "Unassigned") ?? 0) +
          1,
      );
  const status = (["todo", "doing", "blocked", "done"] as const)
    .map((k) => ({
      name: STATUS_STYLE[k].label,
      value: c.tasks.filter((t) => t.status === k).length,
      color: { todo: "#a1a1aa", doing: "#38bdf8", blocked: "#fb7185", done: "#34d399" }[k],
    }))
    .filter((x) => x.value);
  const tiles = [
    { label: "Completed tasks", value: done },
    { label: "Incomplete tasks", value: c.tasks.length - done },
    { label: "Overdue tasks", value: overdue, red: overdue > 0 },
    { label: "Total tasks", value: c.tasks.length },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-card p-4 text-center ring-1 ring-border">
            <p className="text-sm font-semibold">{t.label}</p>
            <p className={cn("mt-2 text-5xl font-light tabular-nums", t.red && "text-destructive")}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Incomplete tasks by phase">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bySection} margin={{ left: -20, right: 8, top: 16, bottom: 40 }}>
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 11 }}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar
                dataKey="open"
                name="Open"
                fill={CHART}
                radius={[4, 4, 0, 0]}
                label={{ position: "top", fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Tasks by status">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={status}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                label={{ fontSize: 12 }}
              >
                {status.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 text-xs">
            {status.map((s) => (
              <span key={s.name} className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Open tasks by person">
          <ResponsiveContainer width="100%" height={Math.max(160, byPerson.size * 40)}>
            <BarChart
              data={[...byPerson].map(([name, n]) => ({ name, n }))}
              layout="vertical"
              margin={{ left: 20, right: 24 }}
            >
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar
                dataKey="n"
                name="Open"
                fill={CHART}
                radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 11 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Progress by phase">
          <ul className="flex flex-col gap-2.5 py-1">
            {c.sections
              .filter((s) => s.items.length)
              .map((s) => (
                <li key={s.key || "o"} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${progress(s.items)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums">{progress(s.items)}%</span>
                </li>
              ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-4 ring-1 ring-border">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- tabs

export function WorkspaceTabs({ base, view }: { base: string; view: WorkspaceView }) {
  return (
    <nav
      className="-mx-4 flex gap-1 overflow-x-auto border-b px-4 [scrollbar-width:none] lg:mx-0 lg:px-0"
      aria-label="Views"
    >
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`${base}?view=${v.key}`}
          aria-current={view === v.key ? "page" : undefined}
          className={cn(
            "relative flex h-11 shrink-0 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground",
            view === v.key &&
              "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
          )}
        >
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
