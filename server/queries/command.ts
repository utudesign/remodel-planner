import { formatInTimeZone } from "date-fns-tz";
import type { Session } from "@/lib/auth/require-role";
import { addDaysToDate, dayBoundsUtc, todayIn } from "@/lib/dates";
import { currentShift } from "@/lib/shift";
import { must, maybe } from "@/server/action-utils";

/** Admin command center (FIELD-AND-OFFICE §7): sections 1–4 and 9 in Phase 1, plus the shift panel. */
export async function getCommandCenter(s: Session) {
  const now = new Date();
  const today = todayIn(s.timezone, now);
  const tomorrow = addDaysToDate(today, 1);
  const tmr = dayBoundsUtc(tomorrow, s.timezone);

  const [openLeads, upcoming, tomorrowMeetings, jobsNoPm, tasksNoDue, messages, myWindows] =
    await Promise.all([
      s.db
        .from("deals")
        .select(
          "id, created_at, first_response_at, waiting_for_live, next_follow_up_at, owner:users(id, name), contact:contacts(name, phone), stage:pipeline_stages!inner(key, label)",
        )
        .not("stage.key", "in", "(won,lost)")
        .order("created_at"),
      s.db
        .from("meetings")
        .select("deal_id")
        .eq("status", "scheduled")
        .gte("scheduled_at", now.toISOString()),
      s.db
        .from("meetings")
        .select(
          "id, type, scheduled_at, confirmed_at, deal:deals(id, contact:contacts(name, phone))",
        )
        .eq("status", "scheduled")
        .gte("scheduled_at", tmr.start.toISOString())
        .lt("scheduled_at", tmr.end.toISOString())
        .order("scheduled_at"),
      s.db
        .from("projects")
        .select("id, name")
        .eq("status", "active")
        .is("project_manager_id", null),
      s.db
        .from("tasks")
        .select("id, project:projects!inner(id, name, status)")
        .is("due_date", null)
        .neq("status", "done")
        .eq("project.status", "active"),
      s.db
        .from("scheduled_messages")
        .select("id, body, channel, send_at, deal_id")
        .is("sent_at", null)
        .lte("send_at", now.toISOString())
        .order("send_at"),
      s.db
        .from("work_windows")
        .select("user_id, weekday, start_time, end_time, kind")
        .eq("user_id", s.userId),
    ]);

  const leads = must(openLeads);
  const booked = new Set(must(upcoming).map((m) => m.deal_id));
  const shift = currentShift(must(myWindows), now, s.timezone);
  const handoff = maybe(
    await s.db
      .from("shift_handoffs")
      .select("id, checklist, body, posted_at, publish_at")
      .eq("user_id", s.userId)
      .eq("shift_kind", shift.kind)
      .eq("shift_date", shift.shiftDate)
      .maybeSingle(),
  );

  const tasksByJob = new Map<string, { name: string; count: number }>();
  for (const t of must(tasksNoDue)) {
    const k = t.project!.id;
    tasksByJob.set(k, { name: t.project!.name, count: (tasksByJob.get(k)?.count ?? 0) + 1 });
  }

  return {
    now,
    unanswered: leads.filter((l) => !l.first_response_at),
    followUpsDue: leads.filter(
      (l) => l.first_response_at && (!l.next_follow_up_at || new Date(l.next_follow_up_at) <= now),
    ),
    // "Ready to measure": qualified (Contacted) with no visit booked yet.
    toBook: leads.filter((l) => l.stage?.key === "contacted" && !booked.has(l.id)),
    toConfirm: must(tomorrowMeetings).filter((m) => !m.confirmed_at),
    confirmed: must(tomorrowMeetings).filter((m) => !!m.confirmed_at),
    messages: must(messages),
    hygiene: {
      noFollowUp: leads.filter((l) => !l.next_follow_up_at),
      jobsNoPm: must(jobsNoPm),
      tasksNoDue: [...tasksByJob.entries()].map(([id, v]) => ({ id, ...v })),
    },
    shift,
    handoff,
  };
}

/** Draft for the handoff / morning brief, from what I did this shift + what's coming. */
export async function draftHandoff(s: Session, sinceIso: string, kind: "live" | "back_office") {
  const today = todayIn(s.timezone);
  // Night brief is about the coming day: before noon ET that's today, after noon it's tomorrow.
  const hourEt = Number(formatInTimeZone(new Date(), s.timezone, "H"));
  const day = dayBoundsUtc(
    kind === "back_office" && hourEt >= 12 ? addDaysToDate(today, 1) : today,
    s.timezone,
  );
  const [events, queued, visits] = await Promise.all([
    s.db
      .from("events")
      .select("summary")
      .eq("actor_id", s.userId)
      .gte("created_at", sinceIso)
      .order("created_at")
      .limit(20),
    s.db
      .from("scheduled_messages")
      .select("deal:deals(contact:contacts(name)), send_at")
      .is("sent_at", null)
      .gte("send_at", new Date().toISOString())
      .lt("send_at", day.end.toISOString()),
    s.db
      .from("meetings")
      .select("scheduled_at, deal:deals(contact:contacts(name))")
      .eq("status", "scheduled")
      .gte("scheduled_at", day.start.toISOString())
      .lt("scheduled_at", day.end.toISOString())
      .order("scheduled_at"),
  ]);
  const lines: string[] = [];
  const q = must(queued);
  if (q.length)
    lines.push(
      `• ${q.length} message${q.length === 1 ? "" : "s"} queued (${q
        .map((m) => m.deal?.contact?.name)
        .filter(Boolean)
        .join(", ")})`,
    );
  for (const e of must(events).slice(-8)) lines.push(`• ${e.summary}`);
  const v = must(visits);
  if (v.length) {
    lines.push(
      `• Visits: ${v
        .map(
          (m) =>
            `${new Date(m.scheduled_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: s.timezone })} ${m.deal?.contact?.name ?? ""}`,
        )
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}
