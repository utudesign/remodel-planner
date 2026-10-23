import { describe, expect, it } from "vitest";
import { leadScore, nextStep, segmentOf } from "@/lib/deals/segments";

const now = new Date("2026-10-23T18:00:00Z");

describe("segmentOf", () => {
  it("open stages are selling", () => {
    expect(segmentOf({ stageKind: "open", cancelled_at: null, paid_in_full_at: null })).toBe("selling");
  });
  it("handed off stays with the partner until the commission is paid", () => {
    expect(
      segmentOf({ stageKind: "handed_off", cancelled_at: null, paid_in_full_at: "2026-10-01", commissionStatus: "owed", owedCents: 100 }),
    ).toBe("partner");
    expect(
      segmentOf({ stageKind: "handed_off", cancelled_at: null, paid_in_full_at: "2026-10-01", commissionStatus: "paid", owedCents: 0 }),
    ).toBe("closed");
  });
  it("cancelled with nothing owed is closed; lost is closed", () => {
    expect(segmentOf({ stageKind: "handed_off", cancelled_at: "x", paid_in_full_at: null, owedCents: 0 })).toBe("closed");
    expect(segmentOf({ stageKind: "handed_off", cancelled_at: "x", paid_in_full_at: null, owedCents: 500 })).toBe("partner");
    expect(segmentOf({ stageKind: "lost", cancelled_at: null, paid_in_full_at: null })).toBe("closed");
  });
});

describe("nextStep", () => {
  const base = {
    stage: "new",
    stageKind: "open" as const,
    created_at: "2026-10-23T16:00:00Z",
    first_response_at: null,
    next_follow_up_at: null,
    job_status: "not_started",
    partner_updated_at: null,
    handed_off_at: null,
  };
  it("unanswered lead is urgent with the wait time", () => {
    expect(nextStep(base, now)).toEqual({ label: "Reply · waiting 2 h", urgent: true });
  });
  it("late follow-up is urgent", () => {
    const s = nextStep({ ...base, stage: "qualified", first_response_at: "x", next_follow_up_at: "2026-10-23T17:30:00Z" }, now);
    expect(s).toEqual({ label: "Follow up · 30 min late", urgent: true });
  });
  it("handed off: owed commission first, then a stale partner", () => {
    const h = { ...base, stage: "handed_off", stageKind: "handed_off" as const, first_response_at: "x" };
    expect(nextStep({ ...h, owedCents: 96250 }, now).label).toBe("Commission owed");
    expect(nextStep({ ...h, handed_off_at: "2026-10-14T18:00:00Z" }, now)).toEqual({
      label: "Ask partner · no update 9 days",
      urgent: true,
    });
    expect(nextStep({ ...h, handed_off_at: "2026-10-20T18:00:00Z" }, now).urgent).toBe(false);
  });
});

describe("leadScore", () => {
  it("ranks an owner with a full kitchen soon above a renter just looking", () => {
    const hot = leadScore({ scope: "kitchen", timeline: "asap", owns_home: true, budget_max_cents: 4_000_000, knowledge_level: 2, decision_maker: "me and my wife" });
    const cold = leadScore({ scope: "other", timeline: "later", owns_home: false, budget_max_cents: null, knowledge_level: 1, decision_maker: null });
    expect(hot).toBe(10);
    expect(cold).toBe(0);
  });
});
