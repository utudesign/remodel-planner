import Link from "next/link";
import { CalendarClock, Check, Clock, MessageCircle, Navigation, Reply, Wallet } from "lucide-react";
import { ScopeBadge } from "@/components/deals/deal-card";
import { EmptyState } from "@/components/shared/states";
import { requireStaff } from "@/lib/auth/require-role";
import { formatTime } from "@/lib/dates";
import { formatCents, formatCentsWhole } from "@/lib/money";
import { nextStep } from "@/lib/deals/segments";
import { isDayJob } from "@/lib/workday";
import { cn } from "@/lib/utils";
import { getToday } from "@/server/queries/today";

export const metadata = { title: "Today" };

function Section({ title, tone, children }: { title: string; tone?: "red"; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
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
  const t = await getToday(s, now);
  const dayJob = !t.partner && isDayJob(now, s.settings.workday, s.timezone);
  const nothing =
    !t.replyNow.length &&
    !t.followUps.length &&
    !t.meetings.length &&
    !t.ready.length &&
    !t.askPartner.length &&
    !t.owed.length &&
    !t.noTouch.length &&
    !t.jobSteps.length;
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

      <div className="grid grid-cols-3 gap-2">
        <Tile label="New leads" value={String(t.replyNow.length)} />
        <Tile label="Visits" value={String(t.meetings.length)} />
        {t.partner ? (
          <Tile label="Job steps due" value={String(t.jobSteps.length)} dark href="/jobs" />
        ) : (
          <Tile label="Owed to you" value={formatCentsWhole(t.owedTotal)} dark href="/money" />
        )}
      </div>

      {nothing ? <EmptyState title="All caught up" description="New leads, follow-ups and visits show up here." /> : null}

      {t.replyNow.length ? (
        <Section title="Reply now" tone="red">
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

      {t.meetings.length ? (
        <Section title="Visits today">
          {t.meetings.map((m) =>
            m.deal ? (
              <Row
                key={m.id}
                d={m.deal}
                icon={Navigation}
                iconTone="bg-accent text-accent-foreground"
                sub={`${formatTime(m.starts_at, s.timezone)}${m.deal.contact?.city ? ` · ${m.deal.contact.city}` : ""}`}
              />
            ) : null,
          )}
        </Section>
      ) : null}

      {t.followUps.length ? (
        <Section title="Follow up">
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
        <Section title="Ready to hand off">
          {t.ready.map((d) => (
            <Row
              key={d.id}
              d={d}
              icon={Check}
              iconTone="bg-accent text-accent-foreground"
              sub={d.estimated_value_cents ? formatCentsWhole(d.estimated_value_cents) : "Hand off"}
              href={`/deals/${d.deal_number}?tab=partner`}
            />
          ))}
        </Section>
      ) : null}

      {t.askPartner.length ? (
        <Section title="Ask the partner">
          {t.askPartner.map((d) => (
            <Row
              key={d.id}
              d={d}
              icon={MessageCircle}
              iconTone="bg-warning/15 text-warning"
              sub={nextStep({ ...d, stageKind: "handed_off" }, now).label.replace("Ask partner · ", "")}
              subTone="text-warning"
              href={`/deals/${d.deal_number}?tab=partner`}
            />
          ))}
        </Section>
      ) : null}

      {t.owed.length ? (
        <Section title="Commission owed">
          {t.owed.map(({ deal, c, days }) => (
            <Row
              key={deal.id}
              d={deal}
              icon={Wallet}
              iconTone={days > 14 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground"}
              sub={`${formatCents(c.owed_cents)} earned ${days} day${days === 1 ? "" : "s"} ago`}
              subTone={days > 14 ? "text-destructive" : undefined}
              href={`/deals/${deal.deal_number}?tab=partner`}
            />
          ))}
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

function Tile({ label, value, dark, href }: { label: string; value: string; dark?: boolean; href?: string }) {
  const body = (
    <>
      <p className={cn("text-xs font-medium", dark ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </>
  );
  const cls = cn("rounded-2xl p-3", dark ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border");
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
