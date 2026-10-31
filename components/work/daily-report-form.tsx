"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { submitDailyReport } from "@/server/actions/daily-report";

type Task = { id: string; title: string; pct: number; when: string };
type Issue = { type: string; note: string; needs_reorder: boolean; photoName: string | null };

/**
 * The 60-second daily report (v3 F3): % on today's tasks → issues (type, note, photo, needs re-order)
 * → tomorrow's plan → Send. One report per job per day; sending again replaces today's.
 */
export function DailyReportForm({
  projectId,
  tasks,
  issueTypes,
  last,
}: {
  projectId: string;
  tasks: Task[];
  issueTypes: { key: string; label: string }[];
  last: { tomorrow: string | null } | null;
}) {
  const [pcts, setPcts] = useState<Record<string, number>>(Object.fromEntries(tasks.map((t) => [t.id, t.pct])));
  const [issues, setIssues] = useState<Issue[]>([]);
  const [tomorrow, setTomorrow] = useState(last?.tomorrow ?? "");
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [state, action] = useActionState(submitDailyReport, null);
  const setIssue = (i: number, p: Partial<Issue>) => setIssues((x) => x.map((y, k) => (k === i ? { ...y, ...p } : y)));
  const payload = JSON.stringify({
    progress: tasks.map((t) => ({ task_id: t.id, pct: pcts[t.id] ?? t.pct })),
    issues: issues.map((i, k) => ({ type: i.type, note: i.note, needs_reorder: i.needs_reorder, photo: i.photoName ? k : null })),
    tomorrow,
  });

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="payload" value={payload} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">1 · How far did you get?</h2>
        {tasks.length === 0 ? (
          <p className="rounded-xl bg-secondary p-3 text-sm text-muted-foreground">No tasks of yours on this job today. You can still report issues and tomorrow&apos;s plan.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((t) => (
              <li key={t.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                <p className="font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.when}</p>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={pcts[t.id]}
                    aria-label={`${t.title} percent done`}
                    onChange={(e) => setPcts((p) => ({ ...p, [t.id]: Number(e.target.value) }))}
                    className="h-11 flex-1 accent-primary"
                  />
                  <span className="w-12 text-right font-bold tabular-nums">{pcts[t.id]}%</span>
                </div>
                <div className="flex gap-2">
                  {[50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPcts((p) => ({ ...p, [t.id]: n }))}
                      className="min-h-9 rounded-lg bg-secondary px-3 text-xs font-semibold"
                    >
                      {n === 100 ? "Done" : "Half"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">2 · Any problems?</h2>
        {issues.map((i, k) => (
          <div key={k} className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-950 dark:ring-amber-800">
            <div className="flex items-center gap-2">
              <select
                value={i.type}
                onChange={(e) => setIssue(k, { type: e.target.value })}
                aria-label="Problem type"
                className="h-11 min-w-0 flex-1 rounded-xl border bg-card px-2 text-sm"
              >
                {issueTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove problem"
                onClick={() => {
                  setIssues((x) => x.filter((_, j) => j !== k));
                }}
              >
                <Trash2 />
              </Button>
            </div>
            <Textarea rows={2} value={i.note} placeholder="What's wrong?" onChange={(e) => setIssue(k, { note: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-card px-3 text-sm font-semibold ring-1 ring-border">
                <Camera className="size-4" /> {i.photoName ? "Photo added" : "Photo"}
                <input
                  ref={(el) => {
                    fileRefs.current[k] = el;
                  }}
                  type="file"
                  name={`photo_${k}`}
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => setIssue(k, { photoName: e.target.files?.[0]?.name ?? null })}
                />
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl bg-card px-3 text-sm font-semibold ring-1 ring-border">
                <input type="checkbox" className="size-5" checked={i.needs_reorder} onChange={(e) => setIssue(k, { needs_reorder: e.target.checked })} />
                Needs re-order
              </label>
            </div>
          </div>
        ))}
        {issues.length < 10 ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIssues((x) => [...x, { type: issueTypes[0]?.key ?? "other", note: "", needs_reorder: false, photoName: null }])}
          >
            <Plus /> {issues.length ? "Another problem" : "Report a problem"}
          </Button>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">3 · Tomorrow</h2>
        <Textarea rows={2} value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} placeholder="e.g. Finish uppers, start crown" />
      </section>

      <FormMessage state={state} />
      <SubmitButton className="h-12 text-base">Send report</SubmitButton>
    </form>
  );
}
