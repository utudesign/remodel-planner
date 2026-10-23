import { describe, expect, it } from "vitest";
import { isDayJob, isDigestRun } from "@/lib/workday";

const w = { days: [1, 2, 3, 4, 5], start: "07:00", end: "15:30" };

describe("isDayJob", () => {
  it("weekday 9 AM ET is the day job; 3:30 PM is not", () => {
    expect(isDayJob(new Date("2026-10-23T13:00:00Z"), w)).toBe(true); // Fri 9:00 EDT
    expect(isDayJob(new Date("2026-10-23T19:30:00Z"), w)).toBe(false); // Fri 3:30 PM EDT
    expect(isDayJob(new Date("2026-10-24T13:00:00Z"), w)).toBe(false); // Saturday
  });
  it("uses Eastern time after the DST change", () => {
    expect(isDayJob(new Date("2026-11-09T12:30:00Z"), w)).toBe(true); // Mon 7:30 EST
    expect(isDayJob(new Date("2026-11-09T11:30:00Z"), w)).toBe(false); // Mon 6:30 EST
  });
});

describe("isDigestRun", () => {
  it("fires from the 19:30 UTC run in summer and the 20:30 UTC run in winter", () => {
    expect(isDigestRun(new Date("2026-10-23T19:30:00Z"), "15:30", w.days)).toBe(true);
    expect(isDigestRun(new Date("2026-10-23T20:30:00Z"), "15:30", w.days)).toBe(false);
    expect(isDigestRun(new Date("2026-12-04T20:30:00Z"), "15:30", w.days)).toBe(true);
    expect(isDigestRun(new Date("2026-12-04T19:30:00Z"), "15:30", w.days)).toBe(false);
  });
  it("not on weekends", () => {
    expect(isDigestRun(new Date("2026-10-24T19:30:00Z"), "15:30", w.days)).toBe(false);
  });
});
