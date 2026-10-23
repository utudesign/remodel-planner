import type { Session } from "@/lib/auth/require-role";
import { addDaysToDate, dayBoundsUtc, PAYMENT_GRACE_DAYS, todayIn, weekRange } from "@/lib/dates";
import { must } from "@/server/action-utils";

export async function getToday(s: Session) {
  const today = todayIn(s.timezone);
  const { start, end } = dayBoundsUtc(today, s.timezone);
  const week = weekRange(today);
  const office = s.role !== "crew";
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const empty = Promise.resolve({ data: [], error: null });

  const [
    followUps,
    meetings,
    overduePayments,
    blocked,
    starting,
    lateDeliveries,
    updates,
    closable,
  ] = await Promise.all([
    office
      ? s.db
          .from("leads")
          .select(
            "id, next_follow_up_at, scope, contact:contacts(name, phone), stage:pipeline_stages!inner(key, label)",
          )
          .not("stage.key", "in", "(won,lost)")
          .or(`next_follow_up_at.is.null,next_follow_up_at.lt.${end.toISOString()}`)
          .order("next_follow_up_at", { ascending: true, nullsFirst: true })
      : empty,
    s.db
      .from("meetings")
      .select(
        "id, type, scheduled_at, status, lead:leads(id, contact:contacts(name, address, city)), project:projects(id, name)",
      )
      .eq("status", "scheduled")
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at"),
    office
      ? s.db
          .from("payments")
          .select(
            "id, label, amount_cents, due_date, status, received_on, project:projects(id, name)",
          )
          .eq("status", "due")
          .lt("due_date", addDaysToDate(today, -PAYMENT_GRACE_DAYS))
          .order("due_date")
      : empty,
    s.db
      .from("tasks")
      .select("id, title, description, trade, project:projects!inner(id, name, status)")
      .eq("status", "blocked")
      .eq("project.status", "active"),
    s.db
      .from("milestones")
      .select("id, planned_date, project:projects!inner(id, name, status)")
      .eq("key", "project_start")
      .is("actual_date", null)
      .gte("planned_date", week.start)
      .lte("planned_date", week.end)
      .eq("project.status", "active")
      .order("planned_date"),
    s.db
      .from("milestones")
      .select("id, planned_date, project:projects!inner(id, name, status)")
      .eq("key", "materials_delivered")
      .is("actual_date", null)
      .lt("planned_date", today)
      .eq("project.status", "active"),
    s.db
      .from("activities")
      .select(
        "id, type, direction, summary, occurred_at, author:users(name), lead:leads(id, contact:contacts(name)), project:projects(id, name)",
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(25),
    office
      ? s.db
          .from("projects")
          .select("id, name, milestones!inner(key, actual_date), tasks(kind, status)")
          .eq("status", "active")
          .eq("milestones.key", "final_payment")
          .not("milestones.actual_date", "is", null)
      : empty,
  ]);

  return {
    today,
    week,
    followUps: must(followUps),
    meetings: must(meetings),
    overduePayments: must(overduePayments),
    blocked: must(blocked),
    starting: must(starting),
    lateDeliveries: must(lateDeliveries),
    updates: must(updates),
    // Spec §6: final payment received + punch list clear → prompt to close.
    readyToClose: must(closable).filter(
      (p) => !p.tasks.some((t) => t.kind === "punch" && t.status !== "done"),
    ),
  };
}
