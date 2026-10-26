import type { Session } from "@/lib/auth/require-role";
import { dayBoundsUtc, todayIn } from "@/lib/dates";
import { segmentOf } from "@/lib/deals/segments";
import { must } from "@/server/action-utils";
import { getCommissions, getStages, listDeals, type DealRow } from "@/server/queries/deals";

const DAY = 86400_000;

/** Earned date of a commission: paid in full, else the deposit. */
export function earnedAt(c: { deposit_received_at: string | null }, d: DealRow): string | null {
  return d.paid_in_full_at ?? c.deposit_received_at ?? null;
}

/** Today (SALES-REP-MODE §7): what to do now, from the rep's point of view. */
export async function getToday(s: Session, now = new Date()) {
  const today = todayIn(s.timezone, now);
  const { start, end } = dayBoundsUtc(today, s.timezone);
  const [stages, deals, commissions, meetingsRes] = await Promise.all([
    getStages(s),
    listDeals(s),
    getCommissions(s),
    s.db
      .from("meetings")
      .select("id, starts_at, kind, deal:deals(deal_number, scope, title, owner_id, contact:contacts(name, address, city))")
      .eq("company_id", s.companyId)
      .eq("status", "scheduled")
      .gte("starts_at", start.toISOString())
      .lt("starts_at", end.toISOString())
      .order("starts_at"),
  ]);
  // Each of us sees our own deals (Crystal's are RenoDesign's; mine are mine). 0013
  const partner = s.role === "partner";
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

  const withPartner = (partner ? [] : mine).filter((d) => {
    const c = commissions.get(d.id);
    return (
      kind.get(d.stage) === "handed_off" &&
      segmentOf({
        stageKind: "handed_off",
        cancelled_at: d.cancelled_at,
        paid_in_full_at: d.paid_in_full_at,
        commissionStatus: c?.commission_status,
        owedCents: c?.owed_cents,
      }) === "partner"
    );
  });
  const askPartner = withPartner.filter((d) => {
    if (d.paid_in_full_at || d.cancelled_at) return false;
    const last = d.partner_updated_at ?? d.handed_off_at;
    return !!last && now.getTime() - new Date(last).getTime() > 7 * DAY;
  });
  const owed = withPartner
    .map((d) => ({ deal: d, c: commissions.get(d.id)! }))
    .filter((x) => x.c && x.c.owed_cents > 0)
    .map((x) => {
      const at = earnedAt(x.c, x.deal);
      return { ...x, days: at ? Math.floor((now.getTime() - new Date(at).getTime()) / DAY) : 0 };
    })
    .sort((a, b) => b.days - a.days);
  const owedTotal = partner ? 0 : [...commissions.values()].reduce((n, c) => n + Math.max(0, c.owed_cents), 0);

  // Job steps due within 2 days (Crystal runs the jobs).
  const soon = new Date(start.getTime() + 2 * DAY).toISOString().slice(0, 10);
  const jobSteps = partner
    ? must(
        await s.db
          .from("job_milestones")
          .select("id, label, planned_on, project:projects(deal:deals(deal_number, scope, title, contact:contacts(name)))")
          .eq("company_id", s.companyId)
          .is("done_on", null)
          .lte("planned_on", soon)
          .order("planned_on")
          .limit(30),
      ).filter((m) => m.project?.deal)
    : [];

  return { today, replyNow, followUps, noTouch, ready, askPartner, owed, owedTotal, meetings, jobSteps, partner };
}
