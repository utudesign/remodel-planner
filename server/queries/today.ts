import type { Session } from "@/lib/auth/require-role";
import { addDaysToDate, dayBoundsUtc, PAYMENT_GRACE_DAYS, todayIn, weekRange } from "@/lib/dates";
import { must } from "@/server/action-utils";

/**
 * Everything due today across both pipelines. Rows carry owner/assignee ids so the page can split
 * "Mine" from "Team" (CONTEXT §4). Job names come from crew_projects, which works for every role
 * and never exposes money.
 */
export async function getToday(s: Session) {
  const today = todayIn(s.timezone);
  const { start, end } = dayBoundsUtc(today, s.timezone);
  const week = weekRange(today);
  const team = s.role !== "crew";
  const empty = Promise.resolve({ data: [] as never[], error: null });

  const [
    jobs,
    followUps,
    meetings,
    overduePayments,
    tasks,
    starting,
    lateDeliveries,
    messages,
    closable,
  ] = await Promise.all([
    s.db.from("crew_projects").select("id, name, status, project_manager_id"),
    team
      ? s.db
          .from("leads")
          .select(
            "id, owner_id, created_at, first_response_at, waiting_for_live, next_follow_up_at, contact:contacts(name, phone), stage:pipeline_stages!inner(key, label)",
          )
          .not("stage.key", "in", "(won,lost)")
          .or(
            `next_follow_up_at.is.null,next_follow_up_at.lt.${end.toISOString()},first_response_at.is.null`,
          )
          .order("next_follow_up_at", { ascending: true, nullsFirst: true })
      : empty,
    s.db
      .from("meetings")
      .select("id, type, scheduled_at, assignee_id, lead_id, project_id")
      .eq("status", "scheduled")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at"),
    team
      ? s.db
          .from("payments")
          .select("id, label, amount_cents, due_date, status, received_on, project_id")
          .eq("status", "due")
          .lt("due_date", addDaysToDate(today, -PAYMENT_GRACE_DAYS))
          .order("due_date")
      : empty,
    s.db
      .from("tasks")
      .select("id, title, description, trade, status, due_date, assignee_id, project_id")
      .neq("status", "done")
      .or(`status.eq.blocked,due_date.lte.${today}`),
    s.db
      .from("milestones")
      .select("id, project_id, planned_date")
      .eq("key", "project_start")
      .is("actual_date", null)
      .gte("planned_date", week.start)
      .lte("planned_date", week.end)
      .order("planned_date"),
    s.db
      .from("milestones")
      .select("id, project_id, planned_date")
      .eq("key", "materials_delivered")
      .is("actual_date", null)
      .lt("planned_date", today),
    team
      ? s.db
          .from("scheduled_messages")
          .select("id, channel, body, send_at, created_by, lead_id")
          .is("sent_at", null)
          .lte("send_at", new Date().toISOString())
          .order("send_at")
      : empty,
    team
      ? s.db
          .from("projects")
          .select(
            "id, name, project_manager_id, milestones!inner(key, actual_date), tasks(kind, status)",
          )
          .eq("status", "active")
          .eq("milestones.key", "final_payment")
          .not("milestones.actual_date", "is", null)
      : empty,
  ]);

  const jobList = must(jobs);
  const job = new Map(jobList.map((j) => [j.id!, j]));
  const active = (id: string | null) => !!id && job.get(id)?.status === "active";
  const leadNames = new Map<string, string>();
  const fu = must(followUps);
  for (const l of fu) leadNames.set(l.id, l.contact?.name ?? "");
  const meetingLeadIds = must(meetings)
    .map((m) => m.lead_id)
    .filter((x): x is string => !!x && !leadNames.has(x));
  const msgLeadIds = must(messages)
    .map((m) => m.lead_id)
    .filter((x): x is string => !!x && !leadNames.has(x));
  if (team && (meetingLeadIds.length || msgLeadIds.length)) {
    const extra = must(
      await s.db
        .from("leads")
        .select("id, contact:contacts(name)")
        .in("id", [...new Set([...meetingLeadIds, ...msgLeadIds])]),
    );
    for (const l of extra) leadNames.set(l.id, l.contact?.name ?? "");
  }

  return {
    today,
    week,
    jobName: (id: string | null) => (id ? (job.get(id)?.name ?? "") : ""),
    pmOf: (id: string | null) => (id ? (job.get(id)?.project_manager_id ?? null) : null),
    leadName: (id: string | null) => (id ? (leadNames.get(id) ?? "") : ""),
    unanswered: fu.filter((l) => !l.first_response_at),
    followUps: fu.filter(
      (l) =>
        l.first_response_at && (!l.next_follow_up_at || l.next_follow_up_at < end.toISOString()),
    ),
    meetings: must(meetings),
    overduePayments: must(overduePayments),
    blocked: must(tasks).filter((t) => t.status === "blocked" && active(t.project_id)),
    dueTasks: must(tasks).filter((t) => t.status !== "blocked" && active(t.project_id)),
    starting: must(starting).filter((m) => active(m.project_id)),
    lateDeliveries: must(lateDeliveries).filter((m) => active(m.project_id)),
    messages: must(messages),
    // Spec §7: final payment received + punch list clear → prompt to close.
    readyToClose: must(closable).filter(
      (p) => !p.tasks.some((t) => t.kind === "punch" && t.status !== "done"),
    ),
  };
}
export type TodayData = Awaited<ReturnType<typeof getToday>>;
