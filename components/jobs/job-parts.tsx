"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addCost, addTask, removeCost, setMilestone, setTask, shiftMilestones, startJob } from "@/server/actions/jobs";
import type { ActionState } from "@/server/action-utils";

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionState>(null);
  const router = useRouter();
  const go = (fn: () => Promise<ActionState>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      router.refresh();
    });
  return { pending, msg, go };
}

export function StartJobButton({ dealId }: { dealId: string }) {
  const { pending, msg, go } = useAct();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => go(() => startJob({ deal_id: dealId }))}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null} Start the job
      </button>
      {msg && !msg.ok ? <p className="text-sm text-destructive">{msg.error}</p> : null}
    </div>
  );
}

export type MilestoneView = { id: string; label: string; planned_on: string | null; done_on: string | null };

/** The job timeline: tick a step when it happens, change its planned date, or push the rest later. */
export function MilestoneList({ items, today }: { items: MilestoneView[]; today: string }) {
  const { pending, msg, go } = useAct();
  const [shiftFrom, setShiftFrom] = useState<string | null>(null);
  const nextOpen = items.find((m) => !m.done_on)?.id;
  return (
    <div className="flex flex-col gap-2">
      <ol className="relative flex flex-col">
        {items.map((m, i) => {
          const late = !m.done_on && !!m.planned_on && m.planned_on < today;
          const isNext = m.id === nextOpen;
          return (
            <li key={m.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < items.length - 1 ? (
                <span className={cn("absolute top-11 bottom-0 left-[21px] w-0.5", m.done_on ? "bg-primary" : "bg-border")} />
              ) : null}
              <button
                type="button"
                aria-label={m.done_on ? `Undo ${m.label}` : `Mark ${m.label} done`}
                disabled={pending}
                onClick={() => go(() => setMilestone({ id: m.id, done: !m.done_on }))}
                className={cn(
                  "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full ring-2",
                  m.done_on ? "bg-primary text-primary-foreground ring-primary" : late ? "bg-card ring-destructive" : isNext ? "bg-card ring-primary" : "bg-card ring-border",
                )}
              >
                {m.done_on ? <Check className="size-5" /> : null}
              </button>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className={cn("text-[15px] font-medium", m.done_on && "text-muted-foreground")}>{m.label}</p>
                  <p className={cn("text-xs", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                    {m.done_on ? `Done ${fmt(m.done_on)}` : late ? `Late · planned ${fmt(m.planned_on)}` : isNext ? "Next" : "Planned"}
                  </p>
                </div>
                {!m.done_on ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      aria-label={`${m.label} date`}
                      defaultValue={m.planned_on ?? ""}
                      onChange={(e) => e.target.value && go(() => setMilestone({ id: m.id, planned_on: e.target.value }))}
                      className="h-11 rounded-lg bg-secondary px-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShiftFrom(shiftFrom === m.id ? null : m.id)}
                      className="h-11 rounded-lg px-2 text-xs font-semibold text-primary"
                    >
                      Move…
                    </button>
                  </div>
                ) : null}
                {shiftFrom === m.id ? (
                  <div className="flex w-full flex-wrap gap-1.5">
                    <span className="self-center text-xs text-muted-foreground">This + later steps:</span>
                    {[-7, -3, 3, 7, 14].map((d) => (
                      <button
                        key={d}
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setShiftFrom(null);
                          go(() => shiftMilestones({ id: m.id, days: d }));
                        }}
                        className="h-10 rounded-full bg-secondary px-3 text-sm font-semibold"
                      >
                        {d > 0 ? `+${d}` : d} days
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {msg?.ok && msg.message ? <p className="text-sm text-primary">{msg.message}</p> : null}
      {msg && !msg.ok ? <p className="text-sm text-destructive">{msg.error}</p> : null}
    </div>
  );
}

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

export type TaskView = { id: string; title: string; status: string; due_date: string | null; assignee: string | null };

export function TaskList({
  projectId,
  tasks,
  people,
  today,
}: {
  projectId: string;
  tasks: TaskView[];
  people: { id: string; name: string }[];
  today: string;
}) {
  const { pending, go } = useAct();
  const [state, action] = useActionState(addTask, null);
  const open = tasks.filter((t) => t.status !== "done");
  const closed = tasks.filter((t) => t.status === "done");
  return (
    <div className="flex flex-col gap-3">
      {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks yet. Add the first one below.</p> : null}
      <ul className="flex flex-col divide-y rounded-xl ring-1 ring-border empty:hidden">
        {[...open, ...closed].map((t) => {
          const late = t.status !== "done" && !!t.due_date && t.due_date < today;
          return (
            <li key={t.id} className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                aria-label={t.status === "done" ? `Reopen ${t.title}` : `Done: ${t.title}`}
                disabled={pending}
                onClick={() => go(() => setTask({ id: t.id, done: t.status !== "done" }))}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-lg",
                  t.status === "done" ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center rounded-md border-2", t.status === "done" && "border-primary bg-primary text-primary-foreground")}>
                  {t.status === "done" ? <Check className="size-4" /> : null}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-[15px]", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                <p className={cn("text-xs", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
                  {[t.due_date ? `${late ? "Late · " : "Due "}${fmt(t.due_date)}` : null, t.assignee].filter(Boolean).join(" · ") || "No date"}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Delete ${t.title}`}
                disabled={pending}
                onClick={() => go(() => setTask({ id: t.id, remove: true }))}
                className="flex size-11 items-center justify-center text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="New task" htmlFor="task_title">
          <Input id="task_title" name="title" placeholder="Order hardware, call plumber…" />
        </Field>
        <Field label="Due" htmlFor="task_due">
          <Input id="task_due" name="due_date" type="date" />
        </Field>
        <Field label="Who" htmlFor="task_who">
          <NativeSelect id="task_who" name="assignee_id" defaultValue="">
            <option value="">Anyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <SubmitButton variant="secondary">Add</SubmitButton>
        <div className="sm:col-span-4">
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}

export type CostView = { id: string; category: string; vendor: string | null; amount: number; paid_on: string | null };

export function CostList({
  projectId,
  costs,
  categories,
}: {
  projectId: string;
  costs: CostView[];
  categories: { key: string; label: string }[];
}) {
  const { pending, go } = useAct();
  const [state, action] = useActionState(addCost, null);
  const label = (k: string) => categories.find((c) => c.key === k)?.label ?? k;
  return (
    <div className="flex flex-col gap-3">
      {costs.length === 0 ? <p className="text-sm text-muted-foreground">No costs yet. Add cabinets, countertops, labor…</p> : null}
      <ul className="flex flex-col divide-y rounded-xl ring-1 ring-border empty:hidden">
        {costs.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">{label(c.category)}</p>
              <p className="truncate text-xs text-muted-foreground">{[c.vendor, c.paid_on ? `paid ${fmt(c.paid_on)}` : null].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <span className="font-semibold tabular-nums">{formatCents(c.amount)}</span>
            <button
              type="button"
              aria-label="Delete cost"
              disabled={pending}
              onClick={() => go(() => removeCost({ id: c.id }))}
              className="flex size-11 items-center justify-center text-muted-foreground"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <form action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-[10rem_1fr_8rem_9rem_auto] sm:items-end">
        <input type="hidden" name="project_id" value={projectId} />
        <Field label="Category" htmlFor="cost_cat">
          <NativeSelect id="cost_cat" name="category" defaultValue={categories[0]?.key}>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Vendor" htmlFor="cost_vendor">
          <Input id="cost_vendor" name="vendor" placeholder="TimberPeak" />
        </Field>
        <Field label="Amount $" htmlFor="cost_amount">
          <Input id="cost_amount" name="amount" inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Paid on" htmlFor="cost_paid">
          <Input id="cost_paid" name="paid_on" type="date" />
        </Field>
        <SubmitButton variant="secondary" className="col-span-2 sm:col-span-1">
          Add cost
        </SubmitButton>
        <div className="col-span-2 sm:col-span-5">
          <FormMessage state={state} />
        </div>
      </form>
    </div>
  );
}
