/**
 * Where a deal sits in my lifecycle (SALES-REP-MODE §2) and what to do next.
 * Pure functions: the Deals list, Today and tests share them.
 */
export type StageKind = "open" | "handed_off" | "lost";
export type Segment = "selling" | "partner" | "closed";

export type SegmentInput = {
  stageKind: StageKind | undefined;
  cancelled_at: string | null;
  paid_in_full_at: string | null;
  commissionStatus?: string | null;
  owedCents?: number | null;
};

/**
 * selling = I'm working it; partner = handed off, job or commission still open;
 * closed  = lost, cancelled, or the job is paid in full and my commission is fully paid.
 */
export function segmentOf(d: SegmentInput): Segment {
  if (d.stageKind === "lost") return "closed";
  if (d.stageKind === "handed_off") {
    if (d.cancelled_at && (d.owedCents ?? 0) <= 0) return "closed";
    if (d.paid_in_full_at && d.commissionStatus === "paid") return "closed";
    return "partner";
  }
  return "selling";
}

export type NextStepInput = {
  stage: string;
  stageKind: StageKind | undefined;
  created_at: string | null;
  first_response_at: string | null;
  next_follow_up_at: string | null;
  job_status: string;
  partner_updated_at: string | null;
  handed_off_at: string | null;
  owedCents?: number | null;
};

export type NextStep = { label: string; urgent: boolean };

function ago(fromIso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - new Date(fromIso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

export function nextStep(d: NextStepInput, now: Date): NextStep {
  if (d.stageKind === "lost") return { label: "Lost", urgent: false };
  if (d.stage === "new" && !d.first_response_at && d.created_at) {
    return { label: `Reply · waiting ${ago(d.created_at, now)}`, urgent: true };
  }
  if (d.stageKind === "handed_off") {
    if ((d.owedCents ?? 0) > 0) return { label: "Commission owed", urgent: true };
    const last = d.partner_updated_at ?? d.handed_off_at;
    if (last && now.getTime() - new Date(last).getTime() > 7 * 86400_000) {
      return { label: `Ask partner · no update ${ago(last, now)}`, urgent: true };
    }
    return { label: "With partner", urgent: false };
  }
  if (d.next_follow_up_at && new Date(d.next_follow_up_at) < now) {
    return { label: `Follow up · ${ago(d.next_follow_up_at, now)} late`, urgent: true };
  }
  const by: Record<string, string> = {
    new: "Reply",
    qualified: "Book the visit",
    visit_booked: "Visit",
    visit_done: "Make the estimate",
    estimate: "Follow up on estimate",
    ready: "Hand off",
  };
  return { label: by[d.stage] ?? "Follow up", urgent: false };
}

/** A rough lead score from the qualify answers (higher = call first). */
export function leadScore(q: {
  scope: string | null;
  timeline: string | null;
  owns_home: boolean | null;
  budget_max_cents: number | null;
  knowledge_level: number | null;
  decision_maker: string | null;
}): number {
  let s = 0;
  if (q.scope === "kitchen") s += 3;
  else if (q.scope === "cabinets_only" || q.scope === "countertops") s += 2;
  else if (q.scope) s += 1;
  s += ({ asap: 3, "1_3_months": 3, "3_6_months": 2, later: 0 } as Record<string, number>)[q.timeline ?? ""] ?? 0;
  if (q.owns_home === true) s += 2;
  if (q.owns_home === false) s -= 3;
  if ((q.budget_max_cents ?? 0) >= 2_000_000) s += 2;
  else if ((q.budget_max_cents ?? 0) >= 500_000) s += 1;
  if ((q.knowledge_level ?? 0) >= 2) s += 1;
  if (q.decision_maker && /me|both|us|self|owner/i.test(q.decision_maker)) s += 1;
  return Math.max(0, Math.min(10, s));
}
