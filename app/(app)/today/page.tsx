import Link from "next/link";
import { AlertTriangle, CalendarClock, Check, ClipboardCheck, Clock, HardHat, Navigation, Phone, Receipt, Reply } from "lucide-react";
import { IssueRow } from "@/components/jobs/daily-reports";
import { directionsUrl } from "@/lib/address";
import { rulesSummary, type SiteRules } from "@/lib/jobs/pm";
import { formatCents } from "@/lib/money";
import { ScopeBadge } from "@/components/deals/deal-card";
import { EmptyState } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { formatTime } from "@/lib/dates";
import { formatCentsWhole } from "@/lib/money";
import { nextStep } from "@/lib/deals/segments";
import { isDayJob } from "@/lib/workday";
import { cn } from "@/lib/utils";
import { getToday, getTodayJobs } from "@/server/queries/today";

export const metadata = { title: "Today" };

function Section({ title, tone, id, children }: { title: string; tone?: "red"; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-2">
      <h2
        className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          tone === "red" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {title}
      </h2>
      <div className="flex flex-col divide-y overflow-hidden rounded-2xl bg-card ring-1 ring-border">{children}</div>
    </section>
  );
}

function Row({
  d,
  sub,
  subTone,
  right,
  icon: Icon,
  iconTone,
  href,
}: {
  d: { deal_number: string | null; scope: string | null; title: string | null; contact: { name: string | null } | null };
  sub: string;
  subTone?: string;
  right?: React.ReactNode;
  icon: typeof Check;
  iconTone: string;
  href?: string;
}) {
  return (
    <Link href={href ?? `/deals/${d.deal_number}`} className="flex min-h-16 items-center gap-3 px-3.5 py-2.5 active:bg-secondary">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", iconTone)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-semibold">{d.contact?.name || d.title || "No name"}</span>
          <ScopeBadge scope={d.scope} />
        </span>
        <span className={cn("block truncate text-[13px]", subTone ?? "text-muted-foreground")}>
          #{d.deal_number} · {sub}
        </span>
      </span>
      {right}
    </Link>
  );
}

export default async function TodayPage() {
  const s = await requireStaff();
  const now = new Date();
  const [t, j] = await Promise.all([getToday(s, now), getTodayJobs(s, now)]);
  const overdueFollowUps = t.followUps.filter((d) => d.next_follow_up_at && new Date(d.next_follow_up_at) < now);
  const dayJob = s.role === "owner" && isDayJob(now, s.settings.workday, s.timezone);
  const nothing =
    !t.replyNow.length &&
    !t.followUps.length &&
    !t.meetings.length &&
    !t.ready.length &&
    !t.noTouch.length &&
    !t.jobSteps.length &&
    !j.onSite.length &&
    !j.reports.length &&
    !j.issues.length &&
    !j.unpaid.length;
  const dateLabel = new Date(`${t.today}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{dateLabel}</p>
          {dayJob ? (
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              Day job until {s.settings.workday.end === "15:30" ? "3:30 PM" : s.settings.workday.end}
            </span>
          ) : null}
        </div>
        <h1 className="text-[32px] leading-tight font-bold tracking-tight">Today</h1>
      </div>

      {/* v3 E2 (Focus stack): counts first — tap to jump */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip href="#follow-up" n={t.replyNow.length + overdueFollowUps.length} label="overdue" red />
        <Chip href="#now" n={t.meetings.length} label={t.meetings.length === 1 ? "visit" : "visits"} />
        <Chip href="#now" n={j.onSite.length} label="on site" />
        <Chip href="#reports" n={j.reports.length} label={j.reports.length === 1 ? "report" : "reports"} />
        <Chip href="#issues" n={j.issues.length} label={j.issues.length === 1 ? "issue" : "issues"} red={j.issues.some((i) => i.needs_reorder)} />
        <Chip href="#unpaid" n={j.unpaid.length} label="unpaid" />
      </div>

      {t.meetings.length || j.onSite.length ? (
        <Section title="Now / next" id="now">
          {t.meetings.map((m) =>
            m.deal ? (
              <div key={m.id} className="flex flex-col gap-2 px-3.5 py-3">
                <Link href={`/deals/${m.deal.deal_number}`} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-sm font-bold tabular-nums">{formatTime(m.starts_at, s.timezone)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">Visit · {m.deal.contact?.name || m.deal.title || "No name"}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">
                      #{m.deal.deal_number}
                      {m.deal.contact?.city ? ` · ${m.deal.contact.city}` : ""}
                    </span>
                  </span>
                </Link>
                <ActionRow phone={m.deal.contact?.phone ?? null} address={[m.deal.contact?.address, m.deal.contact?.city, m.deal.contact?.zip].filter(Boolean).join(", ")} />
              </div>
            ) : null,
          )}
          {j.onSite.map((o) => (
            <div key={o.dealId} className="flex flex-col gap-2 px-3.5 py-3">
              <Link href={`/deals/${o.number}?tab=job`} className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <HardHat className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">On site · {o.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    #{o.number} · {o.tasks.slice(0, 2).join(", ")}
                    {o.people.length ? ` · ${o.people.join(", ")}` : ""}
                  </span>
                  {o.rules ? (
                    <span className="block truncate text-[13px] font-medium text-amber-700">
                      {rulesSummary({ building_type: o.rules.building_type, hours: (o.rules.hours ?? {}) as SiteRules["hours"], loud_until: o.rules.loud_until })}
                    </span>
                  ) : null}
                </span>
              </Link>
              <ActionRow phone={o.phone} address={o.address} />
            </div>
          ))}
        </Section>
      ) : null}

      {nothing ? <EmptyState title="All caught up" description="New leads, follow-ups and visits show up here." /> : null}

      {t.replyNow.length ? (
        <Section title="Reply now" tone="red" id="reply">
          {t.replyNow.map((d) => (
            <Row
              key={d.id}
              d={d}
              icon={Reply}
              iconTone="bg-destructive text-white"
              sub={nextStep({ ...d, stageKind: "open" }, now).label}
              subTone="text-destructive font-semibold"
            />
          ))}
        </Section>
      ) : null}

      {j.reports.length ? (
        <Section title="Worker reports today" id="reports">
          {j.reports.map((r) => (
            <Row
              key={r.id}
              d={r.project!.deal!}
              href={`/deals/${r.project!.deal!.deal_number}?tab=job`}
              icon={ClipboardCheck}
              iconTone="bg-accent text-accent-foreground"
              sub={`${(r.author as { name: string | null } | null)?.name ?? "Worker"} · ${formatTime(r.created_at, s.timezone)}`}
            />
          ))}
        </Section>
      ) : null}

      {j.issues.length ? (
        <section id="issues" className="flex scroll-mt-20 flex-col gap-2">
          <h2 className={cn("text-xs font-semibold tracking-wide uppercase", j.issues.some((i) => i.needs_reorder) ? "text-destructive" : "text-muted-foreground")}>
            <AlertTriangle className="mr-1 inline size-3.5" />
            Job issues
          </h2>
          <div className="flex flex-col gap-2">
            {j.issues.map((i) => (
              <div key={i.id} className="flex flex-col gap-1">
                <Link href={`/deals/${i.project!.deal!.deal_number}?tab=job`} className="text-xs font-semibold text-muted-foreground">
                  #{i.project!.deal!.deal_number} · {i.project!.deal!.contact?.name || i.project!.deal!.title}
                </Link>
                <IssueRow issue={{ id: i.id, type: i.type, note: i.note, needs_reorder: i.needs_reorder, resolved: false }} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {t.jobSteps.length ? (
        <Section title="Job steps due" tone={t.jobSteps.some((m) => (m.planned_on ?? "") < t.today) ? "red" : undefined}>
          {t.jobSteps.map((m) => {
            const late = (m.planned_on ?? "") < t.today;
            return (
              <Row
                key={m.id}
                d={m.project!.deal!}
                href={`/deals/${m.project!.deal!.deal_number}?tab=job`}
                icon={CalendarClock}
                iconTone={late ? "bg-destructive text-white" : "bg-accent text-accent-foreground"}
                sub={`${m.label} · ${late ? "late, was " : ""}${new Date(`${m.planned_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                subTone={late ? "text-destructive font-semibold" : undefined}
              />
            );
          })}
        </Section>
      ) : null}

      {t.followUps.length ? (
        <Section title="Follow up" id="follow-up" tone={overdueFollowUps.length ? "red" : undefined}>
          {t.followUps.map((d) => {
            const late = d.next_follow_up_at && new Date(d.next_follow_up_at) < now;
            return (
              <Row
                key={d.id}
                d={d}
                icon={CalendarClock}
                iconTone={late ? "bg-destructive/10 text-destructive" : "bg-secondary"}
                sub={late ? nextStep({ ...d, stageKind: "open" }, now).label : `Due ${formatTime(d.next_follow_up_at!, s.timezone)}`}
                subTone={late ? "text-destructive" : undefined}
              />
            );
          })}
        </Section>
      ) : null}

      {t.ready.length ? (
        <Section title="Contract + deposit">
          {t.ready.map((d) => (
            <Row
              key={d.id}
              d={d}
              icon={Check}
              iconTone="bg-accent text-accent-foreground"
              sub={d.estimated_value_cents ? `${formatCentsWhole(d.estimated_value_cents)} · Mark sold` : "Mark sold"}
              href={`/deals/${d.deal_number}?tab=job`}
            />
          ))}
        </Section>
      ) : null}

      {j.unpaid.length ? (
        <Section title="Payment links not paid" id="unpaid" tone={j.unpaid.some((p) => p.due_date && p.due_date < t.today) ? "red" : undefined}>
          {j.unpaid.map((p) => {
            const late = !!p.due_date && p.due_date < t.today;
            return (
              <Row
                key={p.id}
                d={p.project!.deal!}
                href={`/deals/${p.project!.deal!.deal_number}?tab=job`}
                icon={Receipt}
                iconTone={late ? "bg-destructive text-white" : "bg-secondary"}
                sub={`${p.label ?? "Payment"} ${formatCents(p.amount)}${late ? " · overdue" : p.link_sent_at ? " · link sent" : ""}`}
                subTone={late ? "text-destructive font-semibold" : undefined}
              />
            );
          })}
        </Section>
      ) : null}

      {t.noTouch.length ? (
        <Section title="No touch in 2 days">
          {t.noTouch.slice(0, 10).map((d) => (
            <Row key={d.id} d={d} icon={Clock} iconTone="bg-secondary" sub={nextStep({ ...d, stageKind: "open" }, now).label} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function Chip({ href, n, label, red }: { href: string; n: number; label: string; red?: boolean }) {
  return (
    <a
      href={href}
      className={cn(
        "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold",
        n === 0 ? "bg-card text-muted-foreground ring-1 ring-border" : red ? "bg-destructive text-white" : "bg-foreground text-background",
      )}
    >
      <span className="tabular-nums">{n}</span> {label}
    </a>
  );
}

function ActionRow({ phone, address }: { phone: string | null; address: string }) {
  if (!phone && !address) return null;
  return (
    <div className="flex gap-2 pl-[4.75rem]">
      {phone ? (
        <a href={`tel:${phone}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold">
          <Phone className="size-4" /> Call
        </a>
      ) : null}
      {address ? (
        <a href={directionsUrl(address)} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-secondary px-3 text-sm font-semibold">
          <Navigation className="size-4" /> Directions
        </a>
      ) : null}
    </div>
  );
}
