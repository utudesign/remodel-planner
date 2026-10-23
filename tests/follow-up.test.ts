import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { suggestNextFollowUp } from "@/lib/follow-up";
import { dayBoundsUtc, isPaymentOverdue, todayIn, weekRange } from "@/lib/dates";

const TZ = "America/New_York";
const et = (d: Date) => formatInTimeZone(d, TZ, "yyyy-MM-dd HH:mm");

const contacted = [
  { sequence: 1, offset_days: 1, offset_hours: 0 },
  { sequence: 2, offset_days: 3, offset_hours: 0 },
  { sequence: 3, offset_days: 7, offset_hours: 0 },
];

describe("suggestNextFollowUp", () => {
  // Entered "Contacted" Mon Oct 19 2026, 2:15 PM ET
  const entered = new Date("2026-10-19T18:15:00Z");

  it("first follow-up: +1 day at 9 AM ET", () => {
    const r = suggestNextFollowUp({
      rules: contacted,
      stageEnteredAt: entered,
      attempt: 0,
      now: entered,
    });
    expect(et(r)).toBe("2026-10-20 09:00");
  });

  it("second and third follow-ups count from stage entry (+3, +7)", () => {
    const now = new Date("2026-10-20T14:00:00Z");
    expect(
      et(suggestNextFollowUp({ rules: contacted, stageEnteredAt: entered, attempt: 1, now })),
    ).toBe("2026-10-22 09:00");
    expect(
      et(suggestNextFollowUp({ rules: contacted, stageEnteredAt: entered, attempt: 2, now })),
    ).toBe("2026-10-26 09:00");
  });

  it("moves a rule that's already in the past to the next morning", () => {
    const late = new Date("2026-10-24T20:00:00Z"); // Sat 4 PM ET
    expect(
      et(suggestNextFollowUp({ rules: contacted, stageEnteredAt: entered, attempt: 1, now: late })),
    ).toBe("2026-10-25 09:00");
  });

  it("after the last rule, repeats the last gap (7 − 3 = 4 days)", () => {
    const now = new Date("2026-10-26T15:00:00Z");
    expect(
      et(suggestNextFollowUp({ rules: contacted, stageEnteredAt: entered, attempt: 3, now })),
    ).toBe("2026-10-30 09:00");
  });

  it("hour rules are exact (new lead → +1h)", () => {
    const now = new Date("2026-10-23T12:49:00Z");
    const r = suggestNextFollowUp({
      rules: [{ sequence: 1, offset_days: 0, offset_hours: 1 }],
      stageEnteredAt: now,
      attempt: 0,
      now,
    });
    expect(r.toISOString()).toBe("2026-10-23T13:49:00.000Z");
  });

  it("no rules → 2 days, 9 AM", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    expect(et(suggestNextFollowUp({ rules: [], stageEnteredAt: now, attempt: 0, now }))).toBe(
      "2026-10-25 09:00",
    );
  });

  it("handles the DST change (Nov 1 2026): 9 AM ET stays 9 AM", () => {
    const entered = new Date("2026-10-30T16:00:00Z");
    const r = suggestNextFollowUp({
      rules: [{ sequence: 1, offset_days: 3, offset_hours: 0 }],
      stageEnteredAt: entered,
      attempt: 0,
      now: entered,
    });
    expect(et(r)).toBe("2026-11-02 09:00");
    expect(r.toISOString()).toBe("2026-11-02T14:00:00.000Z"); // EST = UTC−5
  });
});

describe("dates", () => {
  it("today is computed in ET, not UTC", () => {
    expect(todayIn(TZ, new Date("2026-10-24T02:00:00Z"))).toBe("2026-10-23"); // 10 PM ET
  });
  it("day bounds are ET midnights", () => {
    const b = dayBoundsUtc("2026-10-23", TZ);
    expect(b.start.toISOString()).toBe("2026-10-23T04:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-10-24T04:00:00.000Z");
  });
  it("week runs Monday–Sunday", () => {
    expect(weekRange("2026-10-23")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
    expect(weekRange("2026-10-25")).toEqual({ start: "2026-10-19", end: "2026-10-25" });
  });
  it("payment is overdue only after the 3-day grace period", () => {
    const p = { status: "due", due_date: "2026-10-20" };
    expect(isPaymentOverdue(p, "2026-10-23")).toBe(false);
    expect(isPaymentOverdue(p, "2026-10-24")).toBe(true);
    expect(isPaymentOverdue({ ...p, status: "received" }, "2026-11-30")).toBe(false);
    expect(isPaymentOverdue({ status: "pending", due_date: null }, "2026-11-30")).toBe(false);
  });
});
