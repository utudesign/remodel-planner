import Link from "next/link";
import {
  BadgeDollarSign,
  CalendarDays,
  Hammer,
  Hourglass,
  ListChecks,
  Lock,
  MessageSquareText,
  OctagonX,
  PhoneCall,
  Send,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { FeedList } from "@/components/team/feed-list";
import { getSession } from "@/lib/auth/require-role";
import { formatDate, formatDateTime, formatTime, relativeDays } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { responseMinutesLeft } from "@/lib/routing";
import { cn } from "@/lib/utils";
import { getToday } from "@/server/queries/today";
import { getFeed } from "@/server/queries/team";

export const metadata = { title: "Today" };

const MEETING: Record<string, string> = {
  initial: "In-home measure",
  design_review: "Design presentation",
  mid_check: "Mid-project check",
  final: "Final walkthrough",
};

function Section({
  id,
  title,
  icon: Icon,
  count,
  danger,
  children,
}: {
  id?: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const red = danger && !!count;
  return (
    <section
      id={id}
      className={cn("rounded-xl border bg-card p-4", red && "border-destructive/40")}
    >
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className={cn("size-4 text-muted-foreground", red && "text-destructive")} />
        {title}
        {count !== undefined ? (
          <Badge variant={red ? "destructive" : "secondary"} className="ml-auto">
            {count}
          </Badge>
        ) : null}
      </h2>
      {children}
    </section>
  );
}

const Quiet = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const s = await getSession();
  const crew = s.role === "crew";
  const mine = crew || tab !== "team";
  const now = new Date();
  const [d, feed] = await Promise.all([
    getToday(s),
    getFeed(s, { limit: 25, since: new Date(now.getTime() - 48 * 3600_000).toISOString() }),
  ]);
  const me = s.userId;
  const isMyJob = (projectId: string | null) => d.pmOf(projectId) === me;

  // Mine vs Team (CONTEXT §4)
  const unanswered = d.unanswered.filter((l) => !mine || l.owner_id === me);
  const followUps = d.followUps.filter((l) => !mine || l.owner_id === me);
  const meetings = d.meetings.filter((m) => !mine || m.assignee_id === me);
  const payments = d.overduePayments.filter(
    (p) => !mine || s.role === "team" || isMyJob(p.project_id),
  );
  const blocked = d.blocked.filter(
    (t) => !mine || crew || t.assignee_id === me || isMyJob(t.project_id),
  );
  const dueTasks = d.dueTasks.filter(
    (t) => !mine || crew || t.assignee_id === me || isMyJob(t.project_id),
  );
  const starting = d.starting.filter((m) => !mine || crew || isMyJob(m.project_id));
  const late = d.lateDeliveries.filter(
    (m) => !mine || crew || s.role === "team" || isMyJob(m.project_id),
  );
  const messages = d.messages.filter((m) => !mine || m.created_by === me);
  const closable = d.readyToClose.filter(
    (p) => !mine || s.role === "owner" || p.project_manager_id === me,
  );
  const pinned = feed.filter((e) => e.pinned_until && new Date(e.pinned_until) > now);

  const total =
    unanswered.length +
    followUps.length +
    meetings.length +
    payments.length +
    blocked.length +
    dueTasks.length +
    starting.length +
    late.length +
    messages.length +
    closable.length;
  const firstName = s.name.split(" ")[0];
  const callBtn =
    "inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium";

  return (
    <>
      <PageHeader
        title={firstName ? `Today, ${firstName}` : "Today"}
        description={`${formatDate(d.today)} · Eastern Time`}
      />

      {!crew ? (
        <nav className="mb-4 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-medium sm:w-72">
          {[
            { key: "mine", label: "Mine" },
            { key: "team", label: "Team" },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/today?tab=${t.key}`}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-muted-foreground",
                (t.key === "mine") === mine && "bg-card text-foreground shadow-sm",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {pinned.length ? (
        <div className="mb-4">
          <FeedList items={pinned} tz={s.timezone} now={now} />
        </div>
      ) : null}

      {total === 0 ? (
        <EmptyState
          className="mb-4"
          title="All clear"
          description={mine ? "Nothing on your plate right now." : "Nothing due across the team."}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {!crew && unanswered.length ? (
          <Section
            title="New leads waiting for a reply"
            icon={Hourglass}
            count={unanswered.length}
            danger
          >
            <ul className="flex flex-col divide-y">
              {unanswered.map((l) => {
                const left = responseMinutesLeft(new Date(l.created_at), s.rules, now);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                        {l.contact?.name}
                      </Link>
                      <p
                        className={cn(
                          "text-xs",
                          left < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {left < 0
                          ? `${-left} min past the reply goal`
                          : `${left} min left to reply`}
                        {l.waiting_for_live ? " · waiting for live shift" : ""}
                      </p>
                    </div>
                    {l.contact?.phone ? (
                      <a href={`tel:${l.contact.phone}`} className={callBtn}>
                        <PhoneCall className="size-4" /> Call
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}

        {!crew ? (
          <Section
            id="follow-ups"
            title="Follow-ups"
            icon={PhoneCall}
            count={followUps.length}
            danger={followUps.some(
              (l) => !l.next_follow_up_at || new Date(l.next_follow_up_at) < now,
            )}
          >
            {followUps.length === 0 ? (
              <Quiet>No one to call back today.</Quiet>
            ) : (
              <ul className="flex flex-col divide-y">
                {followUps.map((l) => {
                  const overdue = !l.next_follow_up_at || new Date(l.next_follow_up_at) < now;
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/leads/${l.id}#log`} className="font-medium hover:underline">
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
                        <a href={`tel:${l.contact.phone}`} className={callBtn}>
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

        {!crew && messages.length ? (
          <Section title="Messages to send now" icon={Send} count={messages.length}>
            <ul className="flex flex-col divide-y">
              {messages.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/leads/${m.lead_id}#messages`}
                    className="font-medium hover:underline"
                  >
                    {d.leadName(m.lead_id)}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{m.body}</p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Meetings today" icon={CalendarDays} count={meetings.length}>
          {meetings.length === 0 ? (
            <Quiet>No meetings today.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {meetings.map((m) => (
                <li key={m.id} className="flex gap-3 py-2">
                  <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">
                    {formatTime(m.scheduled_at, s.timezone)}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={m.project_id ? `/projects/${m.project_id}` : `/leads/${m.lead_id}`}
                      className="font-medium hover:underline"
                    >
                      {m.project_id ? d.jobName(m.project_id) : d.leadName(m.lead_id)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{MEETING[m.type] ?? m.type}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Blocked tasks" icon={OctagonX} count={blocked.length} danger>
          {blocked.length === 0 ? (
            <Quiet>Nothing blocked.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {blocked.map((t) => (
                <li key={t.id} className="py-2">
                  <Link
                    href={`/projects/${t.project_id}?tab=tasks`}
                    className="font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {d.jobName(t.project_id)}
                    {t.trade ? ` · ${t.trade}` : ""}
                    {t.description ? ` · ${t.description}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {dueTasks.length ? (
          <Section
            title="Tasks due"
            icon={ListChecks}
            count={dueTasks.length}
            danger={dueTasks.some((t) => !!t.due_date && t.due_date < d.today)}
          >
            <ul className="flex flex-col divide-y">
              {dueTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link
                      href={`/projects/${t.project_id}?tab=tasks`}
                      className="font-medium hover:underline"
                    >
                      {t.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {d.jobName(t.project_id)}
                      {t.trade ? ` · ${t.trade}` : ""}
                    </p>
                  </div>
                  {t.due_date ? (
                    <span
                      className={cn(
                        "text-xs",
                        t.due_date < d.today
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {relativeDays(t.due_date, d.today)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {!crew ? (
          <Section title="Overdue payments" icon={BadgeDollarSign} count={payments.length} danger>
            {payments.length === 0 ? (
              <Quiet>No overdue payments.</Quiet>
            ) : (
              <ul className="flex flex-col divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${p.project_id}?tab=payments`}
                        className="font-medium hover:underline"
                      >
                        {d.jobName(p.project_id)}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.label} · due {formatDate(p.due_date)}
                        {p.due_date ? ` (${relativeDays(p.due_date, d.today)})` : ""}
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

        <Section title="Starting this week" icon={Hammer} count={starting.length}>
          {starting.length === 0 ? (
            <Quiet>No job starts this week.</Quiet>
          ) : (
            <ul className="flex flex-col divide-y">
              {starting.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${m.project_id}`} className="font-medium hover:underline">
                    {d.jobName(m.project_id)}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(m.planned_date)}
                    {m.planned_date ? ` (${relativeDays(m.planned_date, d.today)})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {late.length ? (
          <Section title="Delivery overdue" icon={Truck} count={late.length} danger>
            <ul className="flex flex-col divide-y">
              {late.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/projects/${m.project_id}`} className="font-medium hover:underline">
                    {d.jobName(m.project_id)}
                  </Link>
                  <span className="text-sm text-destructive">
                    expected {formatDate(m.planned_date)}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {closable.length ? (
          <Section title="Ready to close" icon={Lock} count={closable.length}>
            <ul className="flex flex-col divide-y">
              {closable.map((p) => (
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

        {!mine || crew ? (
          <Section title="Team updates (last 48h)" icon={MessageSquareText}>
            <FeedList items={feed.filter((e) => !pinned.includes(e))} tz={s.timezone} now={now} />
          </Section>
        ) : null}
      </div>
    </>
  );
}
