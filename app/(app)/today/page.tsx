import Link from "next/link";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  Hammer,
  Lock,
  MessageSquareText,
  OctagonX,
  PhoneCall,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { getSession } from "@/lib/auth/require-role";
import { formatDate, formatDateTime, formatTime, relativeDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";
import { getToday } from "@/server/queries/today";

export const metadata = { title: "Today" };

const MEETING: Record<string, string> = {
  initial: "In-home measure",
  design_review: "Design presentation",
  mid_check: "Mid-project check",
  final: "Final walkthrough",
};

const ACTIVITY: Record<string, string> = {
  call: "called",
  text: "texted",
  fb_msg: "messaged on FB",
  email: "emailed",
  meeting: "met",
  note: "noted",
  stage_change: "moved",
  system: "",
};

function Section({
  title,
  icon: Icon,
  count,
  tone,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card p-4",
        tone === "danger" && count && "border-destructive/40",
      )}
    >
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon
          className={cn(
            "size-4 text-muted-foreground",
            tone === "danger" && count && "text-destructive",
          )}
        />
        {title}
        {count !== undefined ? (
          <Badge
            variant={tone === "danger" && count ? "destructive" : "secondary"}
            className="ml-auto"
          >
            {count}
          </Badge>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export default async function TodayPage() {
  const s = await getSession();
  const office = s.role !== "crew";
  const d = await getToday(s);
  const now = new Date();
  const firstName = s.name.split(" ")[0];

  const overdueFollowUps = d.followUps.filter(
    (l) => !l.next_follow_up_at || new Date(l.next_follow_up_at) < now,
  );
  const nothing =
    d.followUps.length +
      d.meetings.length +
      d.overduePayments.length +
      d.blocked.length +
      d.starting.length +
      d.lateDeliveries.length +
      d.readyToClose.length ===
    0;

  return (
    <>
      <PageHeader
        title={firstName ? `Today, ${firstName}` : "Today"}
        description={`${formatDate(d.today)} · Eastern Time`}
      />

      {nothing ? (
        <EmptyState
          className="mb-4"
          title="All clear"
          description="No follow-ups, meetings, overdue payments or blocked tasks today."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {office ? (
          <Section
            title="Follow-ups"
            icon={PhoneCall}
            count={d.followUps.length}
            tone={overdueFollowUps.length ? "danger" : undefined}
          >
            {d.followUps.length === 0 ? (
              <Quiet>No one to call back today.</Quiet>
            ) : (
              <ul className="flex flex-col divide-y">
                {d.followUps.map((l) => {
                  const overdue = !l.next_follow_up_at || new Date(l.next_follow_up_at) < now;
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                          {l.contact?.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {l.stage?.label} ·{" "}
                          <span className={cn(overdue && "font-medium text-destructive")}>
                            {l.next_follow_up_at
                              ? `${overdue ? "overdue since " : "at "}${formatDateTime(l.next_follow_up_at, s.timezone)}`
                              : "no follow-up set"}
                          </span>
                        </p>
                      </div>
                      {l.contact?.phone ? (
                        <a
                          href={`tel:${l.contact.phone}`}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
                        >
                          <PhoneCall className="size-4" /> Call
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        ) : null}

        <Section title="Meetings today" icon={CalendarDays} count={d.meetings.length}>
          {d.meetings.length === 0 ? (
            <Quiet>No meetings today.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {d.meetings.map((m) => {
                const href = m.project
                  ? `/projects/${m.project.id}`
                  : m.lead
                    ? `/leads/${m.lead.id}`
                    : "#";
                const who = m.project?.name ?? m.lead?.contact?.name ?? "";
                const where = m.lead?.contact
                  ? [m.lead.contact.address, m.lead.contact.city].filter(Boolean).join(", ")
                  : "";
                return (
                  <li key={m.id} className="flex gap-3 py-2">
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">
                      {formatTime(m.scheduled_at, s.timezone)}
                    </span>
                    <div className="min-w-0">
                      <Link href={href} className="font-medium hover:underline">
                        {who}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {MEETING[m.type] ?? m.type}
                        {where ? ` · ${where}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        {office ? (
          <Section
            title="Overdue payments"
            icon={BadgeDollarSign}
            count={d.overduePayments.length}
            tone="danger"
          >
            {d.overduePayments.length === 0 ? (
              <Quiet>No overdue payments.</Quiet>
            ) : (
              <ul className="flex flex-col divide-y">
                {d.overduePayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${p.project?.id}?tab=payments`}
                        className="font-medium hover:underline"
                      >
                        {p.project?.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.label} · due {formatDate(p.due_date)} (
                        {relativeDays(p.due_date!, d.today)})
                      </p>
                    </div>
                    <span className="font-semibold tabular-nums text-destructive">
                      {formatCents(p.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : null}

        <Section title="Blocked tasks" icon={OctagonX} count={d.blocked.length} tone="danger">
          {d.blocked.length === 0 ? (
            <Quiet>Nothing blocked.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {d.blocked.map((t) => (
                <li key={t.id} className="py-2">
                  <Link
                    href={`/projects/${t.project?.id}?tab=tasks`}
                    className="font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t.project?.name}
                    {t.trade ? ` · ${t.trade}` : ""}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Starting this week" icon={Hammer} count={d.starting.length}>
          {d.starting.length === 0 ? (
            <Quiet>No project starts this week.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {d.starting.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${m.project?.id}`} className="font-medium hover:underline">
                    {m.project?.name}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(m.planned_date)} ({relativeDays(m.planned_date!, d.today)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {d.lateDeliveries.length > 0 ? (
          <Section
            title="Delivery overdue"
            icon={Truck}
            count={d.lateDeliveries.length}
            tone="danger"
          >
            <ul className="flex flex-col divide-y">
              {d.lateDeliveries.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${m.project?.id}`} className="font-medium hover:underline">
                    {m.project?.name}
                  </Link>
                  <span className="text-sm text-destructive">
                    expected {formatDate(m.planned_date)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {d.readyToClose.length > 0 ? (
          <Section title="Ready to close" icon={Lock} count={d.readyToClose.length}>
            <ul className="flex flex-col divide-y">
              {d.readyToClose.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    Paid in full · punch list clear
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Team updates (last 48h)" icon={MessageSquareText}>
          {d.updates.length === 0 ? (
            <Quiet>No updates in the last 2 days.</Quiet>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {d.updates.map((a) => {
                const href = a.project
                  ? `/projects/${a.project.id}`
                  : a.lead
                    ? `/leads/${a.lead.id}`
                    : "#";
                const subject = a.project?.name ?? a.lead?.contact?.name ?? "";
                const verb = ACTIVITY[a.type] ?? a.type;
                return (
                  <li key={a.id} className="text-sm">
                    <p>
                      <span className="font-medium">{a.author?.name ?? "System"}</span>{" "}
                      {verb ? <span className="text-muted-foreground">{verb} </span> : null}
                      <Link href={href} className="font-medium hover:underline">
                        {subject}
                      </Link>
                      {a.summary ? (
                        <span className="text-muted-foreground"> — {a.summary}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(a.occurred_at, s.timezone)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {office && overdueFollowUps.length > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          {overdueFollowUps.length} lead{overdueFollowUps.length === 1 ? " is" : "s are"} waiting on
          a reply.
        </p>
      ) : null}
    </>
  );
}
