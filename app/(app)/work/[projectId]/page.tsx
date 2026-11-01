import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { SiteRulesSummary } from "@/components/jobs/site-rules";
import { WorkerTaskRow } from "@/components/work/worker-task";
import { requireCrew } from "@/lib/auth/require-role";
import { formatDateTime, todayIn } from "@/lib/dates";
import { isLate, whenText } from "@/lib/jobs/pm";
import { directionsUrl } from "@/lib/address";
import { getWorkerJob } from "@/server/queries/worker";

export const metadata = { title: "Job" };

type Wall = { name?: string; length_in?: number; label?: string };

/** A worker's job page (v3 F1): address, client phone, site rules, tasks by phase, measurements, photos, notes. */
export default async function WorkerJobPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const s = await requireCrew();
  const data = await getWorkerJob(s, projectId);
  if (!data) notFound();
  const { job, tasks, visit, phases, rules, comments, photos } = data;
  const today = todayIn(s.timezone);
  const phaseLabel = new Map(phases.map((p) => [p.key, p.label]));
  const address = [job.address, job.city, job.zip].filter(Boolean).join(", ");
  const walls = (Array.isArray(visit?.walls) ? visit.walls : []) as Wall[];
  return (
    <>
      <Link href="/work" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground">
        <ArrowLeft className="size-4" /> My work
      </Link>
      <PageHeader title={job.name} description={`#${job.deal_number} · ${job.pct}% done${job.manager_name ? ` · Manager: ${job.manager_name}` : ""}`} />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {address ? (
            <a
              href={directionsUrl(address)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card text-sm font-semibold ring-1 ring-border"
            >
              <MapPin className="size-4" /> Directions
            </a>
          ) : null}
          {job.client_phone ? (
            <a href={`tel:${job.client_phone}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card text-sm font-semibold ring-1 ring-border">
              <Phone className="size-4" /> Call {job.client_name?.split(" ")[0] ?? "client"}
            </a>
          ) : null}
        </div>
        {address ? <p className="text-sm text-muted-foreground">{address}</p> : null}
        <SiteRulesSummary rules={rules} />

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold">Tasks</h2>
          {tasks.length === 0 ? (
            <EmptyState title="No tasks on this job yet" />
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((t) => (
                <div key={t.id} className="flex flex-col gap-1">
                  {t.phase_key ? <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{phaseLabel.get(t.phase_key) ?? t.phase_key}</span> : null}
                  <WorkerTaskRow task={t} projectId={job.project_id} when={whenText(t)} late={isLate(t, today)} />
                </div>
              ))}
            </ul>
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Measurements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {!visit ? (
              <p className="text-muted-foreground">No site visit saved yet.</p>
            ) : (
              <>
                {visit.ceiling_in ? <p>Ceiling: {visit.ceiling_in}″</p> : null}
                {walls.map((w, i) => (
                  <p key={i}>
                    {w.name ?? w.label ?? `Wall ${i + 1}`}
                    {w.length_in ? `: ${w.length_in}″` : ""}
                  </p>
                ))}
                {visit.notes ? <p className="text-muted-foreground">{visit.notes}</p> : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent>
            {photos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No photos yet. Add one from a task.</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {photos.map((p) =>
                  p.url ? (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-secondary">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={p.title ?? p.tag ?? "Job photo"} className="size-full object-cover" loading="lazy" />
                    </a>
                  ) : null,
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notes on this job</CardTitle>
          </CardHeader>
          <CardContent>
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      {c.author ?? "Someone"} · {formatDateTime(c.created_at, s.timezone)} · {tasks.find((t) => t.id === c.task_id)?.title}
                    </p>
                    {c.body ? <p>{c.body}</p> : null}
                    {c.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photo} alt="" className="mt-1 max-h-48 rounded-lg" loading="lazy" />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
