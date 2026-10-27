import type { Session } from "@/lib/auth/require-role";
import { dayBoundsUtc, todayIn } from "@/lib/dates";
import { must } from "@/server/action-utils";
import { getStages, listDeals } from "@/server/queries/deals";

const DAY = 86400_000;

/** Today: what to do now. Sales work is per person (my deals); job steps are the whole team's (0015). */
export async function getToday(s: Session, now = new Date()) {
  const today = todayIn(s.timezone, now);
  const { start, end } = dayBoundsUtc(today, s.timezone);
  const soon = new Date(start.getTime() + 2 * DAY).toISOString().slice(0, 10);
  const [stages, deals, meetingsRes, stepsRes] = await Promise.all([
    getStages(s),
    listDeals(s),
    s.db
      .from("meetings")
      .select("id, starts_at, kind, deal:deals(deal_number, scope, title, owner_id, contact:contacts(name, address, city))")
      .eq("company_id", s.companyId)
      .eq("status", "scheduled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
    // Job steps due within 2 days (or late).
    s.db
      .from("job_milestones")
      .select("id, label, planned_on, project:projects(deal:deals(deal_number, scope, title, contact:contacts(name)))")
      .eq("company_id", s.companyId)
      .is("done_on", null)
      .lte("planned_on", soon)
      .order("planned_on")
      .limit(30),
  ]);
  const mine = deals.filter((d) => d.owner_id === s.userId);
  const meetings = must(meetingsRes).filter((m) => m.deal?.owner_id === s.userId);
  const kind = new Map(stages.map((x) => [x.key, x.kind]));
  const open = mine.filter((d) => kind.get(d.stage) === "open");

  const replyNow = open.filter((d) => d.stage === "new" && !d.first_response_at);
  const replyIds = new Set(replyNow.map((d) => d.id));
  const followUps = open
    .filter((d) => !replyIds.has(d.id) && d.stage !== "ready")
    .filter((d) => d.next_follow_up_at && new Date(d.next_follow_up_at) < end)
    .sort((a, b) => (a.next_follow_up_at ?? "").localeCompare(b.next_follow_up_at ?? ""));
  const noTouch = open.filter(
    (d) =>
      !replyIds.has(d.id) &&
      !followUps.includes(d) &&
      now.getTime() - new Date(d.last_touch_at ?? d.created_at ?? now).getTime() > 2 * DAY,
  );
  const ready = open.filter((d) => d.stage === "ready");
  const jobSteps = must(stepsRes).filter((m) => m.project?.deal);

  return { today, replyNow, followUps, noTouch, ready, meetings, jobSteps };
}
