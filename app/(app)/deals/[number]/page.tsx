import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MessageSquare, Navigation, NotebookPen, Phone } from "lucide-react";
import { ScopeBadge } from "@/components/deals/deal-card";
import {
  ArchiveButton,
  BookVisitForm,
  ContactForm,
  FollowUpForm,
  LogForm,
  MeetingButtons,
  QualifyForm,
  StageForm,
} from "@/components/deals/jacket-forms";
import { UploadButton } from "@/components/deals/upload-button";
import { PhotoCapture } from "@/components/photos/photo-capture";
import { AutoReplyCard } from "@/components/deals/auto-reply-card";
import { QuickTexts } from "@/components/deals/quick-texts";
import { JobTab } from "@/components/jobs/job-tab";
import { MarkSoldForm } from "@/components/jobs/sale-forms";
import { NewEstimateForm } from "@/components/estimates/builder";
import { getTemplates, listQuotes } from "@/server/queries/estimates";
import { CopyButton } from "@/components/shared/copy-button";
import { appUrl } from "@/lib/app-url";
import { fillAutoReply } from "@/lib/leads/auto-reply";
import { addressForMaps, directionsUrl } from "@/lib/address";
import {
  buildTextVars,
  fillText,
  orderForStage,
  suggestText,
  type TextTemplate,
} from "@/lib/texts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { formatDateTime, todayIn, utcToDatetimeLocal } from "@/lib/dates";
import { DEAL_FOLDERS, type DealFolder } from "@/lib/deals/dealNumber";
import { FOLDER_LABELS, PHOTO_TAGS, sourceLabel, timelineLabel } from "@/lib/deals/display";
import { leadScore, nextStep } from "@/lib/deals/segments";
import { formatBudget, formatCentsWhole } from "@/lib/money";
import { signedUrls } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  getActivities,
  getChecklist,
  getDealByNumber,
  getDealFiles,
  getIntake,
  getLostReasons,
  getMeetings,
  getSharedQuoteToken,
  getStages,
  getTextSends,
  getTextTemplates,
  type ChecklistItem,
} from "@/server/queries/deals";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "estimate", label: "Estimate" },
  { key: "photos", label: "Photos" },
  { key: "files", label: "Files" },
  { key: "job", label: "Job" },
  { key: "activity", label: "Activity" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `#${number}` };
}

function telHref(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/[^\d+]/g, "");
  return d ? d : null;
}

export default async function DealJacket({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ number }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const s = await requireStaff();
  const deal = await getDealByNumber(s, decodeURIComponent(number).replace(/^#/, ""));
  if (!deal) notFound();
  // Sold = marked sold (0015), or an older hand-off / signed partner deal.
  const sold = !!deal.sold_at || !!deal.handed_off_at || (deal.origin === "partner" && deal.job_status !== "not_started");
  const tabs = [...TABS];
  const tab: Tab = tabs.find((t) => t.key === tabParam)?.key ?? "overview";

  const [
    stages,
    reasons,
    files,
    checklist,
    ownerRes,
    templates,
    sends,
    meetings,
    quoteToken,
    intake,
  ] = await Promise.all([
    getStages(s),
    getLostReasons(s),
    getDealFiles(s, deal.id),
    getChecklist(s, deal.id, "before_handoff"),
    deal.owner_id
      ? s.db.from("users").select("name").eq("id", deal.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getTextTemplates(s),
    getTextSends(s, deal.id, deal.stage_entered_at),
    getMeetings(s, deal.id),
    getSharedQuoteToken(s, deal.id),
    getIntake(s, deal.id),
  ]);
  const stage = stages.find((x) => x.key === deal.stage);
  const now = new Date();
  const step = nextStep({ ...deal, stageKind: stage?.kind }, now);
  const ownerName = ownerRes.data?.name ?? null;
  const value = deal.sold_price_cents
    ? deal.sold_price_cents + deal.change_orders_cents
    : deal.estimated_value_cents;
  const c = deal.contact;
  const phone = telHref(c?.phone);
  const address = addressForMaps(c?.address, c?.city, c?.zip);
  const photos = files.filter((f) => f.folder === "photos");
  const requiredLeft = checklist.filter((i) => i.required && !i.satisfied).length;
  const requiredTotal = checklist.filter((i) => i.required).length;
  const bookingLink = `${await appUrl()}/book/${deal.booking_token}`;
  const needsReply = deal.stage === "new" && !deal.first_response_at;

  // Ready-made texts (Settings → Texts): the next unsent one for this stage first.
  const nextVisit = meetings
    .filter(
      (m) =>
        m.status === "scheduled" && new Date(m.starts_at).getTime() > now.getTime() - 3 * 3600_000,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const appBase = await appUrl();
  const vars = buildTextVars({
    customerName: c?.name,
    myName: s.name,
    partnerName: s.companyName,
    partnerContact: s.name,
    nextVisitAt: nextVisit?.starts_at,
    estimateLink: quoteToken ? `${appBase}/q/${quoteToken}` : null,
    bookingLink,
    tz: s.timezone,
    now,
  });
  const sentKeys = new Set(sends.map((r) => r.template_key));
  const sug = suggestText({
    templates: templates as TextTemplate[],
    stage: deal.stage,
    stageEnteredAt: new Date(deal.stage_entered_at),
    sentKeysSinceStage: sentKeys,
    now,
    tz: s.timezone,
  });
  const quickTexts = orderForStage(templates as TextTemplate[], deal.stage).map((t) => ({
    key: t.key,
    label: t.label,
    text: fillText(t.body, vars),
    sent: sentKeys.has(t.key),
    missingLink: t.body.includes("{link}") && !quoteToken,
  }));
  const textHint = sug.current
    ? sug.early && sug.dueAt
      ? `★ Next in your sequence, due ${formatDateTime(sug.dueAt.toISOString(), s.timezone)}`
      : "★ Next in your sequence"
    : null;

  return (
    <div className="-mx-4 -mt-5 lg:mx-0 lg:mt-0">
      {/* Sticky jacket header */}
      <header className="sticky top-14 z-20 border-b bg-card px-4 pt-2 lg:top-0 lg:rounded-2xl lg:border">
        <div className="flex items-center justify-between">
          <Link
            href="/deals"
            className="-ml-1 flex h-11 items-center gap-0.5 text-[15px] font-medium text-primary"
          >
            <ChevronLeft className="size-5" /> Deals
          </Link>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              stage?.kind === "lost"
                ? "bg-muted text-muted-foreground"
                : "bg-accent text-accent-foreground",
            )}
          >
            {stage?.label ?? deal.stage}
          </span>
        </div>
        <p className="text-[13px] font-bold tracking-wide text-muted-foreground tabular-nums">
          #{deal.deal_number}
          {deal.opened_on
            ? ` · opened ${new Date(`${deal.opened_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : ""}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {c?.name || deal.title || "No name yet"}
          </h1>
          <ScopeBadge scope={deal.scope} />
        </div>
        {address ? <p className="truncate text-sm text-muted-foreground">{address}</p> : null}

        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { href: phone ? `tel:${phone}` : null, label: "Call", Icon: Phone },
            { href: phone ? `sms:${phone}` : null, label: "Text", Icon: MessageSquare },
            {
              href: address ? directionsUrl(address) : null,
              label: "Navigate",
              Icon: Navigation,
            },
            {
              href: `/deals/${deal.deal_number}?tab=activity#log`,
              label: "Log",
              Icon: NotebookPen,
            },
          ].map(({ href, label, Icon }) =>
            href ? (
              <a
                key={label}
                href={href}
                className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary text-xs font-semibold"
              >
                <Icon className="size-5" />
                {label}
              </a>
            ) : (
              <span
                key={label}
                aria-disabled
                className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl bg-secondary/60 text-xs font-semibold text-muted-foreground/60"
              >
                <Icon className="size-5" />
                {label}
              </span>
            ),
          )}
        </div>

        <nav className="-mx-4 mt-2 flex gap-5 overflow-x-auto px-4 text-[15px] font-semibold whitespace-nowrap [scrollbar-width:none]">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`/deals/${deal.deal_number}?tab=${t.key}`}
              scroll={false}
              className={cn(
                "py-3 text-muted-foreground",
                tab === t.key && "text-foreground shadow-[inset_0_-2.5px_0_currentColor]",
              )}
            >
              {t.label}
              {t.key === "photos" && photos.length ? ` ${photos.length}` : ""}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-0">
        {tab === "overview" ? (
          <>
            {needsReply ? (
              <AutoReplyCard
                dealId={deal.id}
                phone={c?.phone ?? null}
                waitingLabel={step.label.replace("Reply · ", "")}
                message={fillAutoReply(s.settings.autoReply, {
                  customerName: c?.name,
                  myName: s.name,
                  link: bookingLink,
                })}
              />
            ) : null}
            {!needsReply && stage?.kind !== "lost" && quickTexts.length ? (
              <QuickTexts
                dealId={deal.id}
                phone={c?.phone ?? null}
                firstName={vars.first === "there" ? "the client" : vars.first}
                texts={quickTexts}
                suggestedKey={sug.current?.key ?? null}
                hint={textHint}
              />
            ) : null}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
              <Stat
                label={deal.sold_price_cents ? "Sold price" : "Value"}
                value={value ? formatCentsWhole(value) : "—"}
              />
              <Stat label="Working it" value={ownerName ?? "—"} small hint={sourceLabel(deal.source)} />
              <Stat
                label="Next step"
                value={step.label}
                tone={step.urgent ? "text-destructive" : undefined}
                small
              />
              <Stat
                label="Lead score"
                value={`${leadScore(deal)}/10`}
                small
                hint={timelineLabel(deal.timeline) ?? sourceLabel(deal.source)}
              />
            </div>

            {stage?.kind !== "lost" && !sold ? (
              <JobReadyCard
                number={deal.deal_number}
                items={checklist}
                left={requiredLeft}
                total={requiredTotal}
                dealId={deal.id}
              />
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Stage + follow-up</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <StageForm dealId={deal.id} stage={deal.stage} stages={stages} reasons={reasons} />
                {deal.lost_reason ? (
                  <p className="text-sm text-muted-foreground">
                    Lost:{" "}
                    {reasons.find((r) => r.key === deal.lost_reason)?.label ?? deal.lost_reason}
                  </p>
                ) : null}
                {stage?.kind !== "lost" ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium">
                      Next follow-up{" "}
                      <span
                        className={cn(
                          "font-normal",
                          step.urgent ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {deal.next_follow_up_at
                          ? formatDateTime(deal.next_follow_up_at, s.timezone)
                          : "none"}
                      </span>
                    </p>
                    <FollowUpForm
                      dealId={deal.id}
                      value={
                        deal.next_follow_up_at
                          ? utcToDatetimeLocal(deal.next_follow_up_at, s.timezone)
                          : ""
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Visits
              dealId={deal.id}
              number={deal.deal_number}
              tz={s.timezone}
              minutes={s.settings.booking.minutes}
              bookingLink={bookingLink}
            />

            {intake ? (
              <Card>
                <CardHeader>
                  <CardTitle>From their form</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {intake.summary
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                  </ul>
                  {intake.ballpark_low_cents !== null && intake.ballpark_high_cents !== null ? (
                    <p className="rounded-xl bg-secondary p-3 text-sm">
                      <span className="font-semibold">
                        Rough range: {formatCentsWhole(intake.ballpark_low_cents)}–
                        {formatCentsWhole(intake.ballpark_high_cents)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Your eyes only. From their cabinet count and your first template; measure at
                        the visit.
                      </span>
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Qualify</CardTitle>
              </CardHeader>
              <CardContent>
                <QualifyForm dealId={deal.id} v={deal} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  {sourceLabel(deal.source)} · budget{" "}
                  {formatBudget(deal.budget_min_cents, deal.budget_max_cents)}
                </p>
                <ContactForm dealId={deal.id} c={c} />
              </CardContent>
            </Card>
            <ArchiveButton dealId={deal.id} />
          </>
        ) : null}

        {tab === "estimate" ? <EstimateTab dealId={deal.id} number={deal.deal_number} /> : null}

        {tab === "photos" ? (
          <PhotosTab
            dealId={deal.id}
            number={deal.deal_number}
            files={photos}
            companyId={s.companyId}
            requirementId={checklist.find((i) => i.folder === "photos")?.requirement_id ?? null}
          />
        ) : null}

        {tab === "files" ? (
          <FilesTab dealId={deal.id} files={files} checklist={checklist} companyId={s.companyId} />
        ) : null}

        {tab === "job" && sold ? <JobTab dealId={deal.id} number={deal.deal_number} /> : null}
        {tab === "job" && !sold ? (
          <MarkSoldTab
            dealId={deal.id}
            number={deal.deal_number}
            checklist={checklist}
            lost={stage?.kind === "lost"}
            today={todayIn(s.timezone)}
          />
        ) : null}

        {tab === "activity" ? <ActivityTab dealId={deal.id} tz={s.timezone} /> : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  small,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  small?: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("truncate font-bold tabular-nums", small ? "text-[15px]" : "text-xl", tone)}>
        {value}
      </p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Overview: the job-ready checklist (what production needs before Mark sold). */
function JobReadyCard({
  number,
  items,
  left,
  total,
  dealId,
}: {
  number: string;
  items: ChecklistItem[];
  left: number;
  total: number;
  dealId: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Job-ready checklist</CardTitle>
        <span
          className={cn("text-sm font-semibold", left ? "text-muted-foreground" : "text-primary")}
        >
          {total - left} of {total}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Checklist items={items} dealId={dealId} />
        {!left ? (
          <Link
            href={`/deals/${number}?tab=job`}
            className="flex h-11 items-center justify-center rounded-xl bg-accent text-sm font-semibold text-accent-foreground"
          >
            Ready: Mark sold on the Job tab
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Job tab before the sale: the checklist + Mark sold (price, contract date, deposit). */
async function MarkSoldTab({
  dealId,
  number,
  checklist,
  lost,
  today,
}: {
  dealId: string;
  number: string;
  checklist: ChecklistItem[];
  lost: boolean;
  today: string;
}) {
  const s = await requireStaff();
  const [quote] = await listQuotes(s, dealId);
  const left = checklist.filter((i) => i.required && !i.satisfied).length;
  if (lost) {
    return (
      <EmptyState
        title="This deal is lost"
        description="Move it back to an open stage on the Overview tab to sell it again."
      />
    );
  }
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Job-ready checklist</CardTitle>
          <span className={cn("text-sm font-semibold", left ? "text-destructive" : "text-primary")}>
            {left ? `${left} missing` : "Ready"}
          </span>
        </CardHeader>
        <CardContent>
          <Checklist items={checklist} dealId={dealId} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mark sold</CardTitle>
        </CardHeader>
        <CardContent>
          <MarkSoldForm
            dealId={dealId}
            defaultPriceCents={quote?.totals?.total_price_cents ?? null}
            today={today}
            ready={!left}
          />
        </CardContent>
      </Card>
      <p className="px-1 text-xs text-muted-foreground">
        Mark sold once the contract is signed. It moves #{number} to Sold, starts the job timeline and ticks Contract
        signed (and Deposit received if you enter a date).
      </p>
    </>
  );
}

function Checklist({ items, dealId }: { items: ChecklistItem[]; dealId: string }) {
  if (!items.length)
    return <p className="text-sm text-muted-foreground">No checklist items set up.</p>;
  return (
    <ul className="flex flex-col">
      {items.map((i) => (
        <li
          key={i.requirement_id}
          className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              i.satisfied ? "bg-primary text-primary-foreground" : "ring-2 ring-input",
            )}
          >
            {i.satisfied ? "✓" : ""}
          </span>
          <span
            className={cn(
              "flex-1 text-[15px]",
              !i.required && !i.satisfied && "text-muted-foreground",
            )}
          >
            {i.label}
            {!i.required ? " (optional)" : ""}
            {i.file_count ? (
              <span className="ml-1 text-xs text-muted-foreground">· {i.file_count}</span>
            ) : null}
          </span>
          <UploadButton
            dealId={dealId}
            folder={i.folder}
            requirementId={i.requirement_id}
            label="Add"
            compact
            defaultTag={i.folder === "photos" ? "before" : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

async function Visits({
  dealId,
  number,
  tz,
  minutes,
  bookingLink,
}: {
  dealId: string;
  number: string;
  tz: string;
  minutes: number;
  bookingLink: string;
}) {
  const s = await requireStaff();
  const meetings = await getMeetings(s, dealId);
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Site visit</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {upcoming.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3"
          >
            <div>
              <p className="font-semibold">{formatDateTime(m.starts_at, tz)}</p>
              <p className="text-xs text-muted-foreground">
                {m.booked_via === "link" ? "Booked by the client" : "Booked by me"}
              </p>
            </div>
            <MeetingButtons meetingId={m.id} />
          </div>
        ))}
        {meetings
          .filter((m) => m.status !== "scheduled")
          .slice(0, 3)
          .map((m) => (
            <p key={m.id} className="text-sm text-muted-foreground">
              {formatDateTime(m.starts_at, tz)} · {m.status === "done" ? "done" : "canceled"}
            </p>
          ))}
        <BookVisitForm dealId={dealId} minutes={minutes} />
        <Link
          href={`/deals/${number}/visit`}
          className="flex h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground"
        >
          Open the site visit form
        </Link>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3">
          <p className="min-w-0 text-sm">
            <span className="block font-medium">Client booking link</span>
            <span className="block truncate text-xs text-muted-foreground">{bookingLink}</span>
          </p>
          <CopyButton text={bookingLink} />
        </div>
      </CardContent>
    </Card>
  );
}

async function PhotosTab({
  dealId,
  number,
  files,
  companyId,
  requirementId,
}: {
  dealId: string;
  number: string;
  files: Awaited<ReturnType<typeof getDealFiles>>;
  companyId: string;
  requirementId: string | null;
}) {
  const urls = await signedUrls(
    files.map((f) => f.storage_path),
    companyId,
  );
  const groups = PHOTO_TAGS.map((t) => ({
    ...t,
    items: files.filter((f) => (f.photo_tag ?? "other") === t.key),
  })).filter((g) => g.items.length);
  return (
    <>
      <PhotoCapture dealId={dealId} dealNumber={number} requirementId={requirementId} />
      {files.length === 0 ? (
        <EmptyState
          title="No photos yet"
          description="Every wall, ceiling, floor, the panel and under the sink."
        />
      ) : (
        groups.map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {g.label} · {g.items.length}
            </h2>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {g.items.map((f) =>
                urls[f.storage_path] ? (
                  <a
                    key={f.id}
                    href={urls[f.storage_path]}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={urls[f.storage_path]}
                      alt={f.title ?? g.label}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </a>
                ) : (
                  <div
                    key={f.id}
                    className="flex aspect-square items-center justify-center rounded-lg bg-muted p-1 text-center text-[10px] text-muted-foreground"
                  >
                    {f.title ?? "photo"}
                  </div>
                ),
              )}
            </div>
          </section>
        ))
      )}
    </>
  );
}

async function FilesTab({
  dealId,
  files,
  checklist,
  companyId,
}: {
  dealId: string;
  files: Awaited<ReturnType<typeof getDealFiles>>;
  checklist: ChecklistItem[];
  companyId: string;
}) {
  const docs = files.filter((f) => f.folder !== "photos");
  const urls = await signedUrls(
    docs.map((f) => f.storage_path),
    companyId,
  );
  const folders = DEAL_FOLDERS.filter((f) => f !== "photos");
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Job-ready checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <Checklist items={checklist} dealId={dealId} />
        </CardContent>
      </Card>
      {folders.map((folder: DealFolder) => {
        const items = docs.filter((f) => f.folder === folder);
        if (!items.length && !["design", "estimates", "other"].includes(folder)) return null;
        return (
          <Card key={folder}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>
                {FOLDER_LABELS[folder]}{" "}
                <span className="font-normal text-muted-foreground">{items.length}</span>
              </CardTitle>
              <UploadButton dealId={dealId} folder={folder} label="Add" compact />
            </CardHeader>
            {items.length ? (
              <CardContent>
                <ul className="flex flex-col">
                  {items.map((f) => (
                    <li
                      key={f.id}
                      className="flex min-h-11 items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-0"
                    >
                      {urls[f.storage_path] ? (
                        <a
                          href={urls[f.storage_path]}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-[15px] text-primary underline"
                        >
                          {f.title ?? "File"}
                        </a>
                      ) : (
                        <span className="truncate text-[15px]">{f.title ?? "File"}</span>
                      )}
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {Math.max(1, Math.round(f.size_bytes / 1024))} KB
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        );
      })}
    </>
  );
}

async function ActivityTab({ dealId, tz }: { dealId: string; tz: string }) {
  const s = await requireStaff();
  const items = await getActivities(s, dealId);
  const icon: Record<string, string> = {
    call: "Call",
    text: "Text",
    fb_msg: "FB message",
    email: "Email",
    visit: "Visit",
    note: "Note",
    stage_change: "Stage",
    system: "System",
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Log a touch</CardTitle>
        </CardHeader>
        <CardContent>
          <LogForm dealId={dealId} />
        </CardContent>
      </Card>
      {items.length === 0 ? (
        <EmptyState title="Nothing logged yet" />
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl bg-card p-3 ring-1 ring-border">
              <p className="flex justify-between gap-2 text-xs font-semibold text-muted-foreground">
                <span>
                  {icon[a.type] ?? a.type}
                  {a.direction === "in" ? " · in" : a.direction === "out" ? " · out" : ""}
                </span>
                <span>{formatDateTime(a.occurred_at, tz)}</span>
              </p>
              {a.summary ? (
                <p className="mt-1 text-[15px] whitespace-pre-wrap">{a.summary}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

async function EstimateTab({ dealId, number }: { dealId: string; number: string }) {
  const s = await requireStaff();
  const [quotes, templates] = await Promise.all([listQuotes(s, dealId), getTemplates(s)]);
  return (
    <>
      {quotes.length ? (
        <ul className="flex flex-col gap-2">
          {quotes.map((q) => (
            <li key={q.id}>
              <Link
                href={`/deals/${number}/estimate/${q.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 ring-1 ring-border"
              >
                <span>
                  <span className="block font-semibold">
                    {q.doc_number ?? `Draft v${q.version}`}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {q.name ?? "Estimate"} · {q.status}
                    {q.totals
                      ? ` · ${Math.round(Number(q.totals.gross_margin) * 1000) / 10}% margin`
                      : ""}
                  </span>
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {q.totals ? formatCentsWhole(q.totals.total_price_cents) : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>{quotes.length ? "Another estimate" : "Quick estimate"}</CardTitle>
        </CardHeader>
        <CardContent>
          <NewEstimateForm dealId={dealId} templates={templates} />
        </CardContent>
      </Card>
    </>
  );
}
