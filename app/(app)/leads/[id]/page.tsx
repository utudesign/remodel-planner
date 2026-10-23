import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft, FolderKanban, Hourglass, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { FollowUpBadge } from "@/components/shared/follow-up-badge";
import { LeadActionBar } from "@/components/leads/action-bar";
import { BookMeetingDialog } from "@/components/leads/book-meeting-dialog";
import { ConvertDialog } from "@/components/leads/convert-dialog";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { LeadOwnerChip } from "@/components/leads/lead-owner-chip";
import { MeetingRow } from "@/components/leads/meeting-row";
import { QuickLog } from "@/components/leads/quick-log";
import { ScheduleMessage } from "@/components/leads/schedule-message";
import { StageControl } from "@/components/leads/stage-control";
import { CommentThread } from "@/components/team/comment-thread";
import { requirePageRole } from "@/lib/auth/require-role";
import { formatDateTime, todayIn, utcToDatetimeLocal } from "@/lib/dates";
import { suggestNextFollowUp } from "@/lib/follow-up";
import { isQuietHours, responseMinutesLeft } from "@/lib/routing";
import { signedUrls } from "@/lib/storage";
import { must } from "@/server/action-utils";
import { countOutboundSince, getLeadDetail } from "@/server/queries/leads";
import {
  getFollowUpRules,
  getLostReasons,
  getPaymentTemplates,
  getStages,
  getTaskTemplates,
  getTeam,
} from "@/server/queries/settings";
import { getComments, recordView } from "@/server/queries/team";

export const metadata = { title: "Lead" };

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

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePageRole("owner", "team");
  const { lead, activities, meetings } = await getLeadDetail(s, id);
  const [
    stages,
    reasons,
    team,
    rules,
    attempts,
    payTemplates,
    taskTemplates,
    comments,
    messages,
    files,
  ] = await Promise.all([
    getStages(s),
    getLostReasons(s),
    getTeam(s),
    getFollowUpRules(s, lead.stage_id),
    countOutboundSince(s, lead.id, lead.stage_entered_at),
    getPaymentTemplates(s),
    getTaskTemplates(s),
    getComments(s, "lead", lead.id),
    s.db
      .from("scheduled_messages")
      .select("id, channel, body, send_at, sent_at")
      .eq("lead_id", lead.id)
      .order("send_at", { ascending: false })
      .limit(10),
    s.db
      .from("files")
      .select("path")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false }),
  ]);
  after(() => recordView(s, "lead", lead.id));

  const now = new Date();
  const stageKey = lead.stage?.key ?? "";
  const isOpen = stageKey !== "won" && stageKey !== "lost";
  const suggested = utcToDatetimeLocal(
    suggestNextFollowUp({
      rules,
      stageEnteredAt: new Date(lead.stage_entered_at),
      attempt: attempts + 1,
      now,
      tz: s.timezone,
    }),
    s.timezone,
  );
  const contact = lead.contact!;
  const project = Array.isArray(lead.project) ? lead.project[0] : lead.project;
  const address = [contact.address, contact.city, contact.zip].filter(Boolean).join(", ") || null;
  const people = team
    .filter((u) => u.active && u.role !== "crew")
    .map((u) => ({ id: u.id, name: u.name || u.email || "—" }));
  const minutesLeft = !lead.first_response_at
    ? responseMinutesLeft(new Date(lead.created_at), s.rules, now)
    : null;
  const photoPaths = must(files).map((f) => f.path);
  const photoUrls = await signedUrls(photoPaths, s.companyId);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/leads" className="flex w-fit items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Leads
      </Link>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              stageKey === "lost" ? "destructive" : stageKey === "won" ? "success" : "secondary"
            }
          >
            {lead.stage?.label}
          </Badge>
          {isOpen ? <FollowUpBadge at={lead.next_follow_up_at} tz={s.timezone} now={now} /> : null}
          {minutesLeft !== null && isOpen ? (
            <Badge variant={minutesLeft < 0 ? "destructive" : "warning"}>
              <Hourglass />
              {minutesLeft < 0
                ? `No reply yet · ${-minutesLeft} min late`
                : `Reply within ${minutesLeft} min`}
              {lead.waiting_for_live ? " · waiting for live shift" : ""}
            </Badge>
          ) : null}
          {stageKey === "lost" && lead.lost_reason ? (
            <span className="text-sm text-muted-foreground">
              Reason: {lead.lost_reason.label}
              {lead.lost_note ? ` · ${lead.lost_note}` : ""}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <LeadOwnerChip leadId={lead.id} owner={lead.owner} people={people} />
          {contact.phone ? (
            <span className="flex items-center gap-1.5">
              <Phone className="size-4" /> {contact.phone}
            </span>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              <Mail className="size-4" /> {contact.email}
            </a>
          ) : null}
          {address ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {address}
            </span>
          ) : null}
        </div>
      </div>

      <LeadActionBar phone={contact.phone} address={address} />

      <div className="flex flex-wrap gap-2">
        {project ? (
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-md border px-4 text-sm font-medium"
          >
            <FolderKanban className="size-4" /> Open job
          </Link>
        ) : isOpen ? (
          <>
            <BookMeetingDialog
              leadId={lead.id}
              canMoveStage={["new", "contacted"].includes(stageKey)}
            />
            <ConvertDialog
              leadId={lead.id}
              defaultName={`${contact.name} — ${lead.scope === "full" ? "kitchen remodel" : (lead.scope ?? "kitchen")}`}
              paymentTemplates={payTemplates
                .filter((t) => t.active)
                .map((t) => ({
                  id: t.id,
                  name: t.name,
                  items: t.items.map((i) => ({ ...i, kind: i.kind as "percent" | "fixed" })),
                }))}
              taskTemplates={taskTemplates.filter((t) => t.active)}
              today={todayIn(s.timezone)}
              highlight={stageKey === "design_approved"}
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-5">
          {isOpen ? (
            <Card id="log">
              <CardHeader>
                <CardTitle>Log a touch</CardTitle>
              </CardHeader>
              <CardContent>
                <QuickLog leadId={lead.id} suggested={suggested} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentThread
                comments={comments}
                entityType="lead"
                entityId={lead.id}
                people={people}
                tz={s.timezone}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Log the first call or text above."
                />
              ) : (
                <ol className="flex flex-col gap-3">
                  {activities.map((a) => (
                    <li key={a.id} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary/60" />
                      <div className="min-w-0">
                        <p>
                          <span className="font-medium">
                            {ACTIVITY_LABEL[a.type] ?? a.type}
                            {a.direction ? (a.direction === "out" ? " · out" : " · in") : ""}
                          </span>
                          {a.summary ? (
                            <span className="text-muted-foreground"> — {a.summary}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(a.occurred_at, s.timezone)}
                          {a.author?.name ? ` · ${a.author.name}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {stageKey === "won" ? (
                <p className="text-sm text-muted-foreground">Won — this lead is now a job.</p>
              ) : (
                <StageControl
                  leadId={lead.id}
                  stageId={lead.stage_id}
                  stageKey={stageKey}
                  stages={stages.filter((x) => x.active)}
                  reasons={reasons.filter((r) => r.active)}
                />
              )}
            </CardContent>
          </Card>

          {isOpen ? (
            <Card>
              <CardHeader>
                <CardTitle>Messages to the client</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleMessage
                  leadId={lead.id}
                  phone={contact.phone}
                  email={contact.email}
                  messages={must(messages)}
                  tz={s.timezone}
                  quietNow={isQuietHours(now, s.rules, s.timezone)}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground">None booked.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {meetings.map((m) => (
                    <MeetingRow key={m.id} meeting={m} tz={s.timezone} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {photoPaths.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Photos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {photoPaths.map((p) =>
                  photoUrls[p] ? (
                    <a key={p} href={photoUrls[p]} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoUrls[p]} alt="" className="size-20 rounded-md object-cover" />
                    </a>
                  ) : null,
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadEditForm lead={lead} contact={contact} team={people} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
