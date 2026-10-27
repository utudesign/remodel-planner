import { describe, expect, it } from "vitest";
import { leadScore, nextStep, segmentOf } from "@/lib/deals/segments";

const now = new Date("2026-10-23T18:00:00Z");

describe("segmentOf", () => {
  it("open stages are selling", () => {
    expect(segmentOf({ stageKind: "open", cancelled_at: null, paid_in_full_at: null })).toBe("selling");
  });
  it("sold stays sold until paid in full", () => {
    expect(segmentOf({ stageKind: "handed_off", cancelled_at: null, paid_in_full_at: null })).toBe("sold");
    expect(segmentOf({ stageKind: "handed_off", cancelled_at: null, paid_in_full_at: "2026-10-01" })).toBe("closed");
  });
  it("cancelled is closed; lost is closed", () => {
    expect(segmentOf({ stageKind: "handed_off", cancelled_at: "x", paid_in_full_at: null })).toBe("closed");
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
  };
  it("unanswered lead is urgent with the wait time", () => {
    expect(nextStep(base, now)).toEqual({ label: "Reply · waiting 2 h", urgent: true });
  });
  it("late follow-up is urgent", () => {
    const s = nextStep({ ...base, stage: "qualified", first_response_at: "x", next_follow_up_at: "2026-10-23T17:30:00Z" }, now);
    expect(s).toEqual({ label: "Follow up · 30 min late", urgent: true });
  });
  it("contract + deposit says Mark sold; sold deals show the job step", () => {
    expect(nextStep({ ...base, stage: "ready", first_response_at: "x" }, now).label).toBe("Mark sold");
    const h = { ...base, stage: "handed_off", stageKind: "handed_off" as const, first_response_at: "x" };
    expect(nextStep({ ...h, job_status: "signed" }, now)).toEqual({ label: "Job · measure + design", urgent: false });
    expect(nextStep({ ...h, job_status: "completed", paid_in_full_at: "2026-10-20T18:00:00Z" }, now).label).toBe("Paid in full");
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
