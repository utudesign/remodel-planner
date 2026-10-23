import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ArrowLeft, Hourglass, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/states";
import { FollowUpBadge } from "@/components/shared/follow-up-badge";
import { JacketChecklist, checklistBadge, type ChecklistRow } from "@/components/deals/jacket-checklist";
import { PhotoGrid } from "@/components/deals/photo-grid";
import { UploadButton } from "@/components/deals/upload-button";
import { LeadActionBar } from "@/components/leads/action-bar";
import { BookMeetingDialog } from "@/components/leads/book-meeting-dialog";
import { ConvertDialog } from "@/components/leads/convert-dialog";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { LeadOwnerChip } from "@/components/leads/lead-owner-chip";
import { MeetingRow } from "@/components/leads/meeting-row";
import { QuickLog } from "@/components/leads/quick-log";
import { ScheduleMessage } from "@/components/leads/schedule-message";
import { StageControl as StagePicker } from "@/components/leads/stage-control";
import { ClosePanel } from "@/components/projects/close-panel";
import { CostsPanel } from "@/components/projects/costs-panel";
import { FinanceSummary } from "@/components/projects/finance-summary";
import { MilestoneDates } from "@/components/projects/milestone-dates";
import { ProjectPmChip } from "@/components/projects/project-pm-chip";
import { ProjectSettings } from "@/components/projects/project-settings";
import { TaskPanel } from "@/components/projects/task-panel";
import { PaymentsPanel } from "@/components/payments/payments-panel";
import { CommentThread } from "@/components/team/comment-thread";
import { FeedList } from "@/components/team/feed-list";
import { getSession } from "@/lib/auth/require-role";
import { closeBlockers } from "@/lib/close-rule";
import { formatDate, formatDateTime, todayIn, utcToDatetimeLocal } from "@/lib/dates";
import { dealLabel, DEAL_FOLDERS, type DealFolder } from "@/lib/deals/dealNumber";
import { CREW_FOLDERS, FOLDER_LABEL, PHOTO_TAG_LABEL } from "@/lib/deals/labels";
import { suggestNextFollowUp } from "@/lib/follow-up";
import { isQuietHours, responseMinutesLeft } from "@/lib/routing";
import { signedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";
import { countOutboundSince, dealIdByNumber, getLeadDetail } from "@/server/queries/leads";
import { currentMilestone, getProjectDetail } from "@/server/queries/projects";
import {
  getCostCategories,
  getFollowUpRules,
  getLostReasons,
  getPaymentTemplates,
  getStages,
  getTaskTemplates,
  getTeam,
} from "@/server/queries/settings";
import { getComments, getFeed, recordView } from "@/server/queries/team";

export const metadata = { title: "Deal" };

const ACTIVITY_LABEL: Record<string, string> = {
  call: "Call",
  text: "Text",
  fb_msg: "FB message",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  stage_change: "Stage",
  system: "Update",
};
const KEY_DATES = ["materials_delivered", "project_start", "install_complete", "final_inspection"];

/** The deal jacket (docs/DEALS.md §3): one screen per customer job. */
export default async function DealJacketPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; number: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ year, number }, { tab }] = await Promise.all([params, searchParams]);
  const s = await getSession();
  const crew = s.role === "crew";
  const team = !crew;
  const dealId = /^\d{4}$/.test(year) ? await dealIdByNumber(s, Number(year), number) : null;
  if (!dealId) notFound();

  const now = new Date();
  const today = todayIn(s.timezone);
  const thisYear = Number(today.slice(0, 4));

  // Sales half (owners + team only; crew can't read deals) -----------------------------
  const sales = team ? await getLeadDetail(s, dealId) : null;
  const deal = sales?.lead ?? null;
  const projectRef = deal ? (Array.isArray(deal.project) ? deal.project[0] : deal.project) : null;
  const crewJob = crew
    ? must(await s.db.from("crew_projects").select("id, name").eq("deal_id", dealId).maybeSingle())
    : null;
  const projectId = projectRef?.id ?? crewJob?.id ?? null;

  const [job, people, files, checklist, dealComments, jobComments, feed, categories] = await Promise.all([
    projectId ? getProjectDetail(s, projectId) : Promise.resolve(null),
    getTeam(s),
    s.db
      .from("deal_files")
      .select("id, folder, photo_tag, title, storage_path, mime_type, created_at, requirement_id, uploader:users!deal_files_uploaded_by_fkey(name)")
      .eq("deal_id", dealId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    team
      ? s.db.from("deal_jacket_checklist").select("*").eq("deal_id", dealId)
      : Promise.resolve({ data: [] as ChecklistRow[], error: null }),
    team ? getComments(s, "deal", dealId) : Promise.resolve([]),
    projectId ? getComments(s, "project", projectId) : Promise.resolve([]),
    getFeed(s, { dealId: team ? dealId : undefined, projectId: projectId ?? undefined, limit: 60 }),
    team && projectId ? getCostCategories(s) : Promise.resolve([]),
  ]);
  after(() => (projectId ? recordView(s, "project", projectId) : Promise.resolve()));
  if (team) after(() => recordView(s, "deal", dealId));

  const fileRows = must(files);
  const checklistRows = must(checklist) as ChecklistRow[];
  const photoRows = fileRows.filter((f) => f.folder === "photos");
  const urls = await signedUrls(photoRows.map((f) => f.storage_path), s.companyId);
  const activeTeam = people.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name || u.email || "—", role: u.role }));
  const officePeople = activeTeam.filter((u) => u.role !== "crew");

  // Header facts -------------------------------------------------------------------------
  const contact = deal?.contact ?? job?.project.contact ?? null;
  const name = contact?.name ?? job?.project.name ?? "Deal";
  const address = contact ? [contact.address, contact.city, contact.zip].filter(Boolean).join(", ") || null : null;
  const stageKey = deal?.stage?.key ?? (job?.project.status === "closed" ? "closed" : "won");
  const isOpenSale = !!deal && stageKey !== "won" && stageKey !== "lost";
  const closed = job?.project.status === "closed";
  const current = job ? currentMilestone(job.milestones) : null;
  const stageLabel = closed ? "Closed" : job ? (current?.name ?? "In progress") : (deal?.stage?.label ?? "");
  const gate = !job ? null : current && current.sort_order <= 2 ? "before_order" : "before_close";
  const badge = gate ? checklistBadge(checklistRows, gate) : null;
  const canEditJob = team && (!closed || s.role === "owner");

  // Close gate = spec rule (balance/punch/costs) + missing jacket documents.
  const blockers = job
    ? [
        ...closeBlockers({
          balanceDueCents: job.financials.balanceDueCents,
          openPunchItems: job.tasks.filter((t) => t.kind === "punch" && t.status !== "done").length,
          costs: job.costs,
        }),
        ...checklistRows
          .filter((r) => r.gate === "before_close" && r.required && !r.satisfied)
          .map((r) => `Jacket: ${r.label}`),
      ]
    : [];

  const defaultTab = tab ?? (crew ? "tasks" : "overview");
  const comments = [...dealComments, ...jobComments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const label = deal ? dealLabel(deal.deal_number, deal.deal_year, thisYear) : `#${number}`;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/deals" className="flex w-fit items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Deals
      </Link>

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-lg font-semibold tabular-nums text-muted-foreground">{label}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={stageKey === "lost" ? "destructive" : closed ? "secondary" : job ? "success" : "secondary"}>{stageLabel}</Badge>
          {isOpenSale ? <FollowUpBadge at={deal!.next_follow_up_at} tz={s.timezone} now={now} /> : null}
          {isOpenSale && !deal!.first_response_at ? (
            (() => {
              const left = responseMinutesLeft(new Date(deal!.created_at), s.rules, now);
              return (
                <Badge variant={left < 0 ? "destructive" : "warning"}>
                  <Hourglass />
                  {left < 0 ? `No reply yet · ${-left} min late` : `Reply within ${left} min`}
                  {deal!.waiting_for_live ? " · waiting for live shift" : ""}
                </Badge>
              );
            })()
          ) : null}
          {badge && badge.total ? (
            <Badge variant={badge.done === badge.total ? "success" : "warning"}>
              {gate === "before_order" ? "Order" : "Close"}: {badge.done} of {badge.total}
            </Badge>
          ) : null}
          {stageKey === "lost" && deal?.lost_reason ? (
            <span className="text-sm text-muted-foreground">
              Lost: {deal.lost_reason.label}
              {deal.lost_note ? ` · ${deal.lost_note}` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {deal ? <LeadOwnerChip leadId={deal.id} owner={deal.owner} people={officePeople} /> : null}
          {job && team ? (
            <ProjectPmChip projectId={job.project.id} pm={job.project.manager} people={officePeople} disabled={!canEditJob} />
          ) : null}
          {job && crew && job.project.manager ? <span className="text-muted-foreground">PM: {job.project.manager.name}</span> : null}
          {address ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-4" /> {address}
            </span>
          ) : null}
        </div>
      </header>

      <LeadActionBar phone={contact?.phone ?? null} address={address} />

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full overflow-x-auto sm:w-fit">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {team ? <TabsTrigger value="estimates">Estimates</TabsTrigger> : null}
          <TabsTrigger value="photos">Photos{photoRows.length ? ` ${photoRows.length}` : ""}</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          {team && job ? <TabsTrigger value="money">Money</TabsTrigger> : null}
          {job ? <TabsTrigger value="tasks">Tasks</TabsTrigger> : null}
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ Overview */}
        <TabsContent value="overview" className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-5">
            {deal && isOpenSale ? (
              <div className="flex flex-wrap gap-2">
                <BookMeetingDialog leadId={deal.id} canMoveStage={["new", "contacted"].includes(stageKey)} />
                <DepositButton s={s} deal={deal} stageKey={stageKey} contactName={name} today={today} />
              </div>
            ) : null}

            {job ? (
              <Card>
                <CardHeader>
                  <CardTitle>Key dates</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {KEY_DATES.map((k) => {
                      const m = job.milestones.find((x) => x.key === k);
                      if (!m) return null;
                      const late = !m.actual_date && !!m.planned_date && m.planned_date < today;
                      return (
                        <div key={k} className="rounded-lg border bg-card px-3 py-2">
                          <dt className="text-xs text-muted-foreground">{m.name}</dt>
                          <dd className={late ? "text-sm font-semibold text-destructive" : "text-sm font-medium"}>
                            {m.actual_date ? `✓ ${formatDate(m.actual_date)}` : m.planned_date ? formatDate(m.planned_date) : "Not set"}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                  <MilestoneDates milestones={job.milestones} today={today} canEdit={canEditJob} />
                </CardContent>
              </Card>
            ) : null}

            {deal ? (
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                  <CardDescription>Scope, budget and the qualifying answers.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadEditForm lead={deal} contact={deal.contact!} team={officePeople} />
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            {deal && stageKey !== "won" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  <StageControl s={s} deal={deal} />
                </CardContent>
              </Card>
            ) : null}
            {team ? (
              <Card>
                <CardHeader>
                  <CardTitle>Jacket checklist</CardTitle>
                  <CardDescription>Ordering and closing are blocked until the required papers are filed.</CardDescription>
                </CardHeader>
                <CardContent>
                  <JacketChecklist dealId={dealId} rows={checklistRows} canAdd />
                </CardContent>
              </Card>
            ) : null}
            {sales ? (
              <Card>
                <CardHeader>
                  <CardTitle>Meetings</CardTitle>
                </CardHeader>
                <CardContent>
                  {sales.meetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">None booked.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {sales.meetings.map((m) => (
                        <MeetingRow key={m.id} meeting={m} tz={s.timezone} />
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}
            {job && team && canEditJob ? (
              <ProjectSettings project={job.project} team={activeTeam} memberIds={job.memberIds} />
            ) : null}
          </div>
        </TabsContent>

        {/* ------------------------------------------------------------------ Estimates */}
        {team ? (
          <TabsContent value="estimates">
            <EmptyState
              title="Estimates arrive in Phase 3"
              description="Quick estimate, quote versions, ballpark history and the Home Depot comparison (docs/QUICK-ESTIMATE.md). Until then, file quote PDFs under Files → Estimates."
              action={<UploadButton dealId={dealId} folder="estimates" label="Add a quote PDF" />}
            />
          </TabsContent>
        ) : null}

        {/* ------------------------------------------------------------------ Photos */}
        <TabsContent value="photos" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {(crew ? ["progress", "issue"] : ["before", "progress", "after", "measurement", "issue"]).map((t) => (
              <UploadButton key={t} dealId={dealId} folder="photos" photoTag={t} label={PHOTO_TAG_LABEL[t]} camera />
            ))}
          </div>
          <PhotoGrid
            tz={s.timezone}
            photos={photoRows
              .filter((f) => urls[f.storage_path])
              .map((f) => ({ id: f.id, url: urls[f.storage_path], tag: f.photo_tag, at: f.created_at, by: f.uploader?.name ?? null }))}
          />
        </TabsContent>

        {/* ------------------------------------------------------------------ Files */}
        <TabsContent value="files">
          <ul className="flex flex-col divide-y rounded-xl border bg-card">
            {(crew ? CREW_FOLDERS : DEAL_FOLDERS.filter((f) => f !== "photos"))
              .filter((f) => f !== "photos")
              .map((folder) => {
                const items = fileRows.filter((f) => f.folder === folder);
                return (
                  <li key={folder} className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        {FOLDER_LABEL[folder as DealFolder]} <span className="text-xs text-muted-foreground">{items.length}</span>
                      </p>
                      {team ? <UploadButton dealId={dealId} folder={folder} label="Add" /> : null}
                    </div>
                    {items.length ? (
                      <ul className="flex flex-col gap-1 text-sm">
                        {items.map((f) => (
                          <li key={f.id} className="flex justify-between gap-2 text-muted-foreground">
                            <span className="truncate">{f.title ?? f.storage_path.split("/").pop()}</span>
                            <span className="shrink-0 text-xs">
                              {formatDateTime(f.created_at, s.timezone)}
                              {f.uploader?.name ? ` · ${f.uploader.name}` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Preview, phone scan → PDF and export arrive with PROMPT-deals Steps 4 and 7.</p>
        </TabsContent>

        {/* ------------------------------------------------------------------ Money */}
        {team && job ? (
          <TabsContent value="money" className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-5">
              <FinanceSummary f={job.financials} targetBps={s.settings.targetMarginBps} />
              <Card>
                <CardHeader>
                  <CardTitle>Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <PaymentsPanel
                    projectId={job.project.id}
                    payments={job.payments}
                    milestones={job.milestones}
                    revenueCents={job.financials.revenueCents}
                    today={today}
                    canEdit={canEditJob}
                  />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Costs</CardTitle>
                </CardHeader>
                <CardContent>
                  <CostsPanel projectId={job.project.id} costs={job.costs} categories={categories} canEdit={canEditJob} />
                </CardContent>
              </Card>
            </div>
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Close the deal</CardTitle>
              </CardHeader>
              <CardContent>
                <ClosePanel projectId={job.project.id} blockers={blockers} isOwner={s.role === "owner"} closed={closed} />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        {/* ------------------------------------------------------------------ Tasks */}
        {job ? (
          <TabsContent value="tasks">
            <TaskPanel projectId={job.project.id} tasks={job.tasks} milestones={job.milestones} team={activeTeam} today={today} canEdit={canEditJob} />
          </TabsContent>
        ) : null}

        {/* ------------------------------------------------------------------ Activity */}
        <TabsContent value="activity" className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-5">
            {deal && isOpenSale ? (
              <Card id="log">
                <CardHeader>
                  <CardTitle>Log a touch</CardTitle>
                </CardHeader>
                <CardContent>
                  <LogTouch s={s} deal={deal} now={now} />
                </CardContent>
              </Card>
            ) : null}
            <Card id="comments">
              <CardHeader>
                <CardTitle>Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <CommentThread
                  comments={comments}
                  entityType={projectId ? "project" : "deal"}
                  entityId={projectId ?? dealId}
                  people={officePeople}
                  tz={s.timezone}
                />
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            {deal && isOpenSale ? (
              <Card id="messages">
                <CardHeader>
                  <CardTitle>Messages to the client</CardTitle>
                </CardHeader>
                <CardContent>
                  <Messages s={s} dealId={deal.id} phone={contact?.phone ?? null} email={contact?.email ?? null} now={now} />
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Timeline</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {sales?.activities.length ? (
                  <ol className="flex flex-col gap-3">
                    {sales.activities.map((a) => (
                      <li key={a.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                        <div className="min-w-0">
                          <p>
                            <span className="font-medium">
                              {ACTIVITY_LABEL[a.type] ?? a.type}
                              {a.direction ? (a.direction === "out" ? " · out" : " · in") : ""}
                            </span>
                            {a.summary ? <span className="text-muted-foreground"> — {a.summary}</span> : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(a.occurred_at, s.timezone)}
                            {a.author?.name ? ` · ${a.author.name}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
                <div className={cn(sales?.activities.length && "border-t pt-4")}>
                  <FeedList items={feed} tz={s.timezone} now={now} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------------------------------------------------------- helpers
type Session = Awaited<ReturnType<typeof getSession>>;
type Deal = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>["lead"]>;

async function DepositButton({
  s,
  deal,
  stageKey,
  contactName,
  today,
}: {
  s: Session;
  deal: Deal;
  stageKey: string;
  contactName: string;
  today: string;
}) {
  const [payTemplates, taskTemplates] = await Promise.all([getPaymentTemplates(s), getTaskTemplates(s)]);
  return (
    <ConvertDialog
      leadId={deal.id}
      defaultName={`${contactName} — ${deal.scope === "full" ? "kitchen remodel" : (deal.scope ?? "kitchen")}`}
      paymentTemplates={payTemplates
        .filter((t) => t.active)
        .map((t) => ({ id: t.id, name: t.name, items: t.items.map((i) => ({ ...i, kind: i.kind as "percent" | "fixed" })) }))}
      taskTemplates={taskTemplates.filter((t) => t.active)}
      today={today}
      highlight={stageKey === "design_approved"}
    />
  );
}

async function StageControl({ s, deal }: { s: Session; deal: Deal }) {
  const [stages, reasons] = await Promise.all([getStages(s), getLostReasons(s)]);
  return (
    <StagePicker
      leadId={deal.id}
      stageId={deal.stage_id}
      stageKey={deal.stage?.key ?? ""}
      stages={stages.filter((x) => x.active)}
      reasons={reasons.filter((r) => r.active)}
    />
  );
}

async function LogTouch({ s, deal, now }: { s: Session; deal: Deal; now: Date }) {
  const [rules, attempts] = await Promise.all([
    getFollowUpRules(s, deal.stage_id),
    countOutboundSince(s, deal.id, deal.stage_entered_at),
  ]);
  const suggested = utcToDatetimeLocal(
    suggestNextFollowUp({ rules, stageEnteredAt: new Date(deal.stage_entered_at), attempt: attempts + 1, now, tz: s.timezone }),
    s.timezone,
  );
  return <QuickLog leadId={deal.id} suggested={suggested} />;
}

async function Messages({
  s,
  dealId,
  phone,
  email,
  now,
}: {
  s: Session;
  dealId: string;
  phone: string | null;
  email: string | null;
  now: Date;
}) {
  const messages = must(
    await s.db
      .from("scheduled_messages")
      .select("id, channel, body, send_at, sent_at")
      .eq("deal_id", dealId)
      .order("send_at", { ascending: false })
      .limit(10),
  );
  return (
    <ScheduleMessage
      leadId={dealId}
      phone={phone}
      email={email}
      messages={messages}
      tz={s.timezone}
      quietNow={isQuietHours(now, s.rules, s.timezone)}
      nowIso={now.toISOString()}
    />
  );
}
