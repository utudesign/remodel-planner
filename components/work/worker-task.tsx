"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, MessageSquare, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { addWorkerComment, setMyTask } from "@/server/actions/worker";
import type { WorkerTask } from "@/server/queries/worker";

const STATUS_LABEL = { todo: "To do", doing: "Working", blocked: "Blocked", done: "Done" } as const;
const STATUS_TONE = {
  todo: "bg-secondary text-secondary-foreground",
  doing: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
  blocked: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
  done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
} as const;

/** One task on a worker's job. Their own tasks get a % slider, Done and Blocked; any task takes a note + photo. */
export function WorkerTaskRow({ task: t, projectId, when, late }: { task: WorkerTask; projectId: string; when: string; late: boolean }) {
  const router = useRouter();
  const [pct, setPct] = useState(t.pct);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = (patch: { pct?: number; status?: WorkerTask["status"] }) =>
    start(async () => {
      setError(null);
      const r = await setMyTask({ id: t.id, ...patch });
      if (r && !r.ok) setError(r.error ?? "Couldn't save");
      router.refresh();
    });
  return (
    <li className={cn("flex flex-col gap-2 rounded-2xl bg-card p-3 ring-1 ring-border", late && "ring-destructive/60", t.mine && "ring-2 ring-primary/40")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t.title}</p>
          <p className={cn("text-xs", late ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {when}
            {late ? " · late" : ""}
            {t.assignee_name ? ` · ${t.mine ? "You" : t.assignee_name}` : " · Not assigned"}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_TONE[t.status])}>{STATUS_LABEL[t.status]}</span>
      </div>
      {t.notes ? <p className="text-sm text-muted-foreground">{t.notes}</p> : null}
      {t.mine ? (
        <>
          <label className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={pct}
              aria-label={`${t.title} percent done`}
              onChange={(e) => setPct(Number(e.target.value))}
              onPointerUp={() => pct !== t.pct && save({ pct })}
              onKeyUp={() => pct !== t.pct && save({ pct })}
              className="h-11 flex-1 accent-primary"
            />
            <span className="w-12 text-right text-sm font-bold tabular-nums">{pct}%</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={t.status === "done" ? "secondary" : "default"} disabled={pending} onClick={() => save({ status: t.status === "done" ? "doing" : "done" })}>
              {pending ? <Loader2 className="animate-spin" /> : <Check />} {t.status === "done" ? "Reopen" : "Done"}
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={() => save({ status: t.status === "blocked" ? "doing" : "blocked" })}>
              <OctagonAlert /> {t.status === "blocked" ? "Unblock" : "Blocked"}
            </Button>
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">
        <MessageSquare className="size-4" /> {open ? "Close" : "Note or photo"}
      </button>
      {open ? <WorkerComment taskId={t.id} projectId={projectId} onDone={() => setOpen(false)} /> : null}
    </li>
  );
}

function WorkerComment({ taskId, projectId, onDone }: { taskId: string; projectId: string; onDone: () => void }) {
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof addWorkerComment>>, fd: FormData) => {
    const r = await addWorkerComment(prev, fd);
    if (r?.ok) onDone();
    return r;
  }, null);
  const [name, setName] = useState<string | null>(null);
  return (
    <form action={action} className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-2">
      <input type="hidden" name="task_id" value={taskId} />
      <input type="hidden" name="project_id" value={projectId} />
      <Textarea name="body" rows={2} placeholder="What happened? (optional with a photo)" />
      <div className="flex gap-2">
        <label className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-card text-sm font-semibold ring-1 ring-border">
          <Camera className="size-4" /> {name ? "Photo added" : "Add photo"}
          <input type="file" name="photo" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setName(e.target.files?.[0]?.name ?? null)} />
        </label>
        <select name="tag" defaultValue="progress" className="h-11 rounded-xl border bg-card px-2 text-sm" aria-label="Kind">
          <option value="progress">Progress</option>
          <option value="issue">Issue</option>
        </select>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Send</SubmitButton>
    </form>
  );
}
