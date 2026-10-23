import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  ClipboardList,
  Hourglass,
  PhoneCall,
  Send,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/states";
import { ShiftChecklist } from "@/components/command/checklist";
import { ConfirmButton } from "@/components/command/confirm-button";
import { HandoffForm } from "@/components/command/handoff-form";
import { requirePageRole } from "@/lib/auth/require-role";
import { dayBoundsUtc, formatDateTime, formatTime } from "@/lib/dates";
import { isQuietHours, responseMinutesLeft } from "@/lib/routing";
import { CHECKLISTS } from "@/lib/shift";
import { cn } from "@/lib/utils";
import { draftHandoff, getCommandCenter } from "@/server/queries/command";

export const metadata = { title: "Command center" };

function Block({
  n,
  title,
  icon: Icon,
  count,
  danger,
  children,
}: {
  n: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  danger?: boolean;
  children: React.ReactNode;
}) {
  // Empty sections collapse to one line.
  return (
    <section
      className={cn("rounded-xl border bg-card p-4", danger && count && "border-destructive/40")}
    >
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="text-xs text-muted-foreground">{n}</span>
        <Icon className="size-4 text-muted-foreground" />
        {title}
        <Badge variant={danger && count ? "destructive" : "secondary"} className="ml-auto">
          {count}
        </Badge>
      </h2>
      {count ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

const callBtn =
  "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium";

export default async function CommandPage() {
  const s = await requirePageRole("owner", "team");
  const c = await getCommandCenter(s);
  const shiftStart = dayBoundsUtc(c.shift.shiftDate, s.timezone).start.toISOString();
  const draft = c.handoff?.body || (await draftHandoff(s, shiftStart, c.shift.kind));
  const quiet = isQuietHours(c.now, s.rules, s.timezone);
  const hygieneCount =
    c.hygiene.noFollowUp.length + c.hygiene.jobsNoPm.length + c.hygiene.tasksNoDue.length;

  return (
    <>
      <PageHeader
        title="Command center"
        description={
          quiet
            ? "Quiet hours (no client contact). Queue messages for 8:00 AM."
            : "Work top to bottom. Keep sections 1–2 at zero."
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          <Block
            n={1}
            title="New leads unanswered"
            icon={Hourglass}
            count={c.unanswered.length}
            danger
          >
            <ul className="flex flex-col divide-y">
              {c.unanswered.map((l) => {
                const left = responseMinutesLeft(new Date(l.created_at), s.rules, c.now);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/deal/${l.id}#log`} className="font-medium hover:underline">
                        {l.contact?.name}
                      </Link>
                      <p
                        className={cn(
                          "text-xs",
                          left < 0 ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {left < 0 ? `${-left} min late` : `${left} min left`} ·{" "}
                        {l.owner?.name ?? "unassigned"}
                      </p>
                    </div>
                    {l.contact?.phone && !quiet ? (
                      <a href={`tel:${l.contact.phone}`} className={callBtn}>
                        <PhoneCall className="size-4" /> Call
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Block>

          <Block
            n={2}
            title="Follow-ups due now"
            icon={PhoneCall}
            count={c.followUpsDue.length}
            danger
          >
            <ul className="flex flex-col divide-y">
              {c.followUpsDue.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/deal/${l.id}#log`} className="font-medium hover:underline">
                      {l.contact?.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {l.stage?.label} · due {formatDateTime(l.next_follow_up_at, s.timezone)} ·{" "}
                      {l.owner?.name ?? "—"}
                    </p>
                  </div>
                  {l.contact?.phone && !quiet ? (
                    <a href={`tel:${l.contact.phone}`} className={callBtn}>
                      <PhoneCall className="size-4" /> Call
                    </a>
                  ) : (
                    <Link href={`/deal/${l.id}#messages`} className={callBtn}>
                      <Send className="size-4" /> Queue
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </Block>

          <Block n={3} title="Visits to book" icon={CalendarPlus} count={c.toBook.length}>
            <p className="mb-2 text-xs text-muted-foreground">
              Qualified leads with no in-home measure booked. Book inside the owners&apos; field
              windows (evenings, weekends).
            </p>
            <ul className="flex flex-col divide-y">
              {c.toBook.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/deal/${l.id}`} className="font-medium hover:underline">
                    {l.contact?.name}
                  </Link>
                  <Link href={`/deal/${l.id}`} className={callBtn}>
                    <CalendarPlus className="size-4" /> Book
                  </Link>
                </li>
              ))}
            </ul>
          </Block>

          <Block
            n={4}
            title="Tomorrow's visits to confirm"
            icon={CalendarCheck}
            count={c.toConfirm.length}
          >
            <ul className="flex flex-col divide-y">
              {c.toConfirm.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <Link href={`/deal/${m.deal?.id}`} className="font-medium hover:underline">
                      {m.deal?.contact?.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(m.scheduled_at, s.timezone)} tomorrow
                    </p>
                  </div>
                  <ConfirmButton meetingId={m.id} />
                </li>
              ))}
            </ul>
          </Block>

          {c.messages.length ? (
            <Block n={0} title="Messages due to send" icon={Send} count={c.messages.length}>
              <ul className="flex flex-col divide-y">
                {c.messages.map((m) => (
                  <li key={m.id} className="py-2">
                    <Link href={`/deal/${m.deal_id}#messages`} className="text-sm hover:underline">
                      {m.body}
                    </Link>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          <p className="px-1 text-xs text-muted-foreground">
            Sections 5–8 (site visits, designs, payments, orders) arrive with Phases 2–4. Payments:
            see Money.
          </p>

          <Block n={9} title="Data hygiene" icon={Sparkles} count={hygieneCount}>
            <ul className="flex flex-col gap-1.5 text-sm">
              {c.hygiene.noFollowUp.map((l) => (
                <li key={l.id}>
                  <Link href={`/deal/${l.id}#log`} className="hover:underline">
                    {l.contact?.name}: no next follow-up
                  </Link>
                </li>
              ))}
              {c.hygiene.jobsNoPm.map((p) => (
                <li key={p.id}>
                  <Link href={`/job/${p.id}`} className="hover:underline">
                    {p.name}: no PM
                  </Link>
                </li>
              ))}
              {c.hygiene.tasksNoDue.map((p) => (
                <li key={p.id}>
                  <Link href={`/job/${p.id}?tab=tasks`} className="hover:underline">
                    {p.name}: {p.count} task{p.count === 1 ? "" : "s"} with no due date
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-4" />
                {c.shift.kind === "live" ? "Live shift" : "Back-office shift"}
              </CardTitle>
              <CardDescription>
                {c.shift.inWindow
                  ? "You're in this shift now."
                  : "Outside your work windows; showing the closest shift."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShiftChecklist
                kind={c.shift.kind}
                date={c.shift.shiftDate}
                items={CHECKLISTS[c.shift.kind]}
                done={(c.handoff?.checklist as Record<string, boolean>) ?? {}}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                {c.shift.kind === "back_office" ? "Morning brief" : "Shift handoff"}
              </CardTitle>
              <CardDescription>
                Drafted from what you did this shift. Edit, then post.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HandoffForm
                kind={c.shift.kind}
                date={c.shift.shiftDate}
                draft={draft}
                posted={!!c.handoff?.posted_at}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
