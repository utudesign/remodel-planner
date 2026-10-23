import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClosePanel } from "@/components/projects/close-panel";
import { CostsPanel } from "@/components/projects/costs-panel";
import { FinanceSummary } from "@/components/projects/finance-summary";
import { MilestoneDates } from "@/components/projects/milestone-dates";
import { ProjectSettings } from "@/components/projects/project-settings";
import { TaskPanel } from "@/components/projects/task-panel";
import { PaymentsPanel } from "@/components/payments/payments-panel";
import { getSession } from "@/lib/auth/require-role";
import { closeBlockers } from "@/lib/close-rule";
import { formatDate, todayIn } from "@/lib/dates";
import { formatCentsWhole } from "@/lib/money";
import { currentMilestone, getProjectDetail } from "@/server/queries/projects";
import { getCostCategories, getTeam } from "@/server/queries/settings";
import { getComments, getFeed, recordView } from "@/server/queries/team";
import { CommentThread } from "@/components/team/comment-thread";
import { FeedList } from "@/components/team/feed-list";
import { ProjectPmChip } from "@/components/projects/project-pm-chip";

export const metadata = { title: "Project" };

const KEY_DATES = ["materials_delivered", "project_start", "install_complete", "final_inspection"];

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const s = await getSession();
  const office = s.role !== "crew";
  const detail = await getProjectDetail(s, id);
  const [team, categories, comments, feed] = await Promise.all([
    getTeam(s),
    office ? getCostCategories(s) : Promise.resolve([]),
    getComments(s, "project", id),
    getFeed(s, { projectId: id, limit: 40 }),
  ]);
  after(() => recordView(s, "project", id));
  const { project, milestones, tasks, payments, costs, financials, memberIds } = detail;
  const today = todayIn(s.timezone);
  const closed = project.status === "closed";
  const contact = project.contact!;
  const current = currentMilestone(milestones);
  const canEdit = office && (!closed || s.role === "owner");
  const activeTeam = team
    .filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name || u.email || "—", role: u.role }));

  const blockers = closeBlockers({
    balanceDueCents: financials.balanceDueCents,
    openPunchItems: tasks.filter((t) => t.kind === "punch" && t.status !== "done").length,
    costs,
  });
  const readyToClose = !closed && blockers.length === 0;
  const defaultTab = tab ?? (office ? "overview" : "tasks");

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/projects"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{contact.name}</span>
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  className="flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <Phone className="size-3.5" /> {contact.phone}
                </a>
              ) : null}
              {contact.address ? (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent([contact.address, contact.city, contact.zip].filter(Boolean).join(", "))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <MapPin className="size-3.5" /> {contact.address}
                </a>
              ) : null}
              {office ? <span>{formatCentsWhole(project.contract_value_cents)}</span> : null}
              {!office && project.manager ? <span>PM: {project.manager.name}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {closed ? (
              <Badge variant="secondary">Closed</Badge>
            ) : readyToClose ? (
              <Badge variant="success">Ready to close</Badge>
            ) : (
              <Badge>{current?.name ?? "In progress"}</Badge>
            )}
            {canEdit ? (
              <ProjectSettings project={project} team={activeTeam} memberIds={memberIds} />
            ) : null}
            {project.lead?.id && office ? (
              <Link
                href={`/leads/${project.lead.id}`}
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Lead
              </Link>
            ) : null}
          </div>
        </div>

        {office ? (
          <div>
            <ProjectPmChip
              projectId={project.id}
              pm={project.manager}
              people={activeTeam.filter((u) => u.role !== "crew")}
              disabled={!canEdit}
            />
          </div>
        ) : null}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KEY_DATES.map((k) => {
            const m = milestones.find((x) => x.key === k);
            if (!m) return null;
            const late = !m.actual_date && !!m.planned_date && m.planned_date < today;
            return (
              <div key={k} className="rounded-lg border bg-card px-3 py-2">
                <dt className="text-xs text-muted-foreground">{m.name}</dt>
                <dd
                  className={
                    late ? "text-sm font-semibold text-destructive" : "text-sm font-medium"
                  }
                >
                  {m.actual_date
                    ? `✓ ${formatDate(m.actual_date)}`
                    : m.planned_date
                      ? formatDate(m.planned_date)
                      : "Not set"}
                </dd>
              </div>
            );
          })}
        </dl>
      </header>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {office ? <TabsTrigger value="overview">Overview</TabsTrigger> : null}
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {office ? <TabsTrigger value="payments">Payments</TabsTrigger> : null}
          {office ? <TabsTrigger value="costs">Costs</TabsTrigger> : null}
          {!office ? <TabsTrigger value="dates">Dates</TabsTrigger> : null}
          <TabsTrigger value="comments">
            Comments{comments.length ? ` (${comments.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {office ? (
          <TabsContent value="overview" className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-5">
              <FinanceSummary f={financials} targetBps={s.settings.targetMarginBps} />
              <Card>
                <CardHeader>
                  <CardTitle>Milestones</CardTitle>
                </CardHeader>
                <CardContent>
                  <MilestoneDates milestones={milestones} today={today} canEdit={canEdit} />
                </CardContent>
              </Card>
            </div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Close project</CardTitle>
              </CardHeader>
              <CardContent>
                <ClosePanel
                  projectId={project.id}
                  blockers={blockers}
                  isOwner={s.role === "owner"}
                  closed={closed}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : (
          <TabsContent value="dates">
            <Card>
              <CardContent>
                <MilestoneDates milestones={milestones} today={today} canEdit={false} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="tasks">
          <TaskPanel
            projectId={project.id}
            tasks={tasks}
            milestones={milestones}
            team={activeTeam}
            today={today}
            canEdit={canEdit}
          />
        </TabsContent>

        {office ? (
          <>
            <TabsContent value="payments">
              <PaymentsPanel
                projectId={project.id}
                payments={payments}
                milestones={milestones}
                revenueCents={financials.revenueCents}
                today={today}
                canEdit={canEdit}
              />
            </TabsContent>
            <TabsContent value="costs">
              <CostsPanel
                projectId={project.id}
                costs={costs}
                categories={categories}
                canEdit={canEdit}
              />
            </TabsContent>
          </>
        ) : null}

        <TabsContent value="comments" className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardContent>
              <CommentThread
                comments={comments}
                entityType="project"
                entityId={project.id}
                people={activeTeam.filter((u) => u.role !== "crew" || s.role === "crew")}
                tz={s.timezone}
              />
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Job activity</CardTitle>
            </CardHeader>
            <CardContent>
              <FeedList items={feed} tz={s.timezone} now={new Date()} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
