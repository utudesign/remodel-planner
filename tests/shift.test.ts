import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import { currentShift, nextMorning } from "@/lib/shift";
import type { WorkWindow } from "@/lib/routing";

const TZ = "America/New_York";
const w: WorkWindow[] = [
  { user_id: "a", weekday: 4, start_time: "11:00", end_time: "15:00", kind: "live" },
  { user_id: "a", weekday: 4, start_time: "23:00", end_time: "03:00", kind: "back_office" },
];

describe("currentShift", () => {
  it("live shift on Thursday", () => {
    expect(currentShift(w, new Date("2026-10-22T16:00:00Z"), TZ)).toEqual({
      kind: "live",
      shiftDate: "2026-10-22",
      inWindow: true,
    });
  });
  it("back office after midnight keeps the date the shift started", () => {
    // Fri 1:30 AM EDT → Thursday's back-office shift
    expect(currentShift(w, new Date("2026-10-23T05:30:00Z"), TZ)).toEqual({
      kind: "back_office",
      shiftDate: "2026-10-22",
      inWindow: true,
    });
  });
});

describe("nextMorning", () => {
  it("brief written at 1 AM publishes at 7 AM the same morning", () => {
    expect(
      formatInTimeZone(nextMorning(new Date("2026-10-23T05:00:00Z"), TZ), TZ, "yyyy-MM-dd HH:mm"),
    ).toBe("2026-10-23 07:00");
  });
  it("crosses DST correctly (Sat Oct 31 11 PM EDT → Sun Nov 1 7 AM EST = 12:00Z)", () => {
    expect(nextMorning(new Date("2026-11-01T03:00:00Z"), TZ).toISOString()).toBe(
      "2026-11-01T12:00:00.000Z",
    );
  });
});
