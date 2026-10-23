import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { ProjectBoard } from "@/components/projects/project-board";
import { getSession } from "@/lib/auth/require-role";
import { formatDateTime, todayIn } from "@/lib/dates";
import { formatBps } from "@/lib/money";
import { getBoardProjects } from "@/server/queries/projects";
import { getMilestoneDefinitions } from "@/server/queries/settings";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const s = await getSession();
  const [projects, defs] = await Promise.all([getBoardProjects(s), getMilestoneDefinitions(s)]);
  const active = projects.filter((p) => p.status === "active");
  const closed = projects.filter((p) => p.status === "closed").slice(0, 10);
  const columns = defs
    .filter((d) => d.key !== "deposit_received" && d.key !== "closed")
    .map((d) => ({ key: d.key, label: d.label }));
  const canDrag = s.role !== "crew";

  return (
    <>
      <PageHeader
        title="Projects"
        description={
          canDrag
            ? `${active.length} active. Each column is the next step; drag a card when a step is done.`
            : "Projects you're assigned to."
        }
      />
      {active.length === 0 ? (
        <EmptyState
          title="No active projects"
          description={
            canDrag
              ? "A project is created when you record a lead's deposit."
              : "Nothing assigned to you yet."
          }
          action={
            canDrag ? (
              <Link href="/leads" className="text-sm font-medium underline underline-offset-4">
                Go to leads
              </Link>
            ) : null
          }
        />
      ) : (
        <ProjectBoard
          columns={columns}
          projects={active}
          today={todayIn(s.timezone)}
          canDrag={canDrag}
        />
      )}

      {closed.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recently closed</h2>
          <ul className="divide-y rounded-lg border bg-card">
            {closed.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {formatDateTime(p.closed_at, s.timezone)}
                  {p.locked_margin_bps !== null ? (
                    <Badge variant="secondary">{formatBps(p.locked_margin_bps)}</Badge>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
