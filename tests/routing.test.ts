import { describe, expect, it } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import {
  isInWindow,
  isQuietHours,
  nextSendTime,
  responseMinutesLeft,
  routeNewLead,
  usersInWindow,
  type WorkWindow,
} from "@/lib/routing";

const TZ = "America/New_York";
const et = (d: Date) => formatInTimeZone(d, TZ, "EEE yyyy-MM-dd HH:mm");

// Office admin split shift (FIELD-AND-OFFICE §2), Mon–Fri
const admin = "u-admin";
const tugu = "u-tugu";
const crystal = "u-crystal";
const windows: WorkWindow[] = [
  ...[1, 2, 3, 4, 5].map((d) => ({ user_id: admin, weekday: d, start_time: "11:00", end_time: "15:00", kind: "live" })),
  ...[1, 2, 3, 4, 5].map((d) => ({ user_id: admin, weekday: d, start_time: "23:00", end_time: "03:00", kind: "back_office" })),
  ...[1, 2, 3, 4, 5].map((d) => ({ user_id: tugu, weekday: d, start_time: "15:30", end_time: "21:00", kind: "live" })),
];
const members = [
  { id: tugu, role: "owner", active: true, is_default_owner: true },
  { id: crystal, role: "owner", active: true, is_default_owner: false },
  { id: admin, role: "team", active: true, is_default_owner: false },
];

describe("work windows", () => {
  it("live window, EDT (Mon Oct 26 2026, 11:30 AM ET = 15:30Z)", () => {
    expect(usersInWindow(windows, new Date("2026-10-26T15:30:00Z"), "live", TZ)).toEqual([admin]);
  });

  it("live window, EST after the Nov 1 DST change (Mon Nov 2, 11:30 AM ET = 16:30Z)", () => {
    expect(usersInWindow(windows, new Date("2026-11-02T16:30:00Z"), "live", TZ)).toEqual([admin]);
    // 15:30Z on Nov 2 is 10:30 AM EST: before the shift
    expect(usersInWindow(windows, new Date("2026-11-02T15:30:00Z"), "live", TZ)).toEqual([]);
  });

  it("overnight back-office window belongs to the day it started", () => {
    const fri = windows.find((w) => w.kind === "back_office" && w.weekday === 5)!;
    expect(isInWindow(fri, new Date("2026-10-31T05:00:00Z"), TZ)).toBe(true); // Sat 1:00 AM EDT
    expect(isInWindow(fri, new Date("2026-10-31T08:00:00Z"), TZ)).toBe(false); // Sat 4:00 AM
    // Sun 1:30 AM is NOT covered: no Saturday shift
    expect(usersInWindow(windows, new Date("2026-11-01T05:30:00Z"), "back_office", TZ)).toEqual([]);
  });
});

describe("routeNewLead", () => {
  it("assigns to whoever is live, team first", () => {
    expect(routeNewLead({ windows, members, at: new Date("2026-10-26T16:00:00Z"), tz: TZ })).toEqual({
      ownerId: admin,
      waitingForLive: false,
    });
  });
  it("evening: Tugu is live", () => {
    expect(routeNewLead({ windows, members, at: new Date("2026-10-26T23:00:00Z"), tz: TZ }).ownerId).toBe(tugu);
  });
  it("morning gap (7–11 AM): default owner, waiting for live shift", () => {
    expect(routeNewLead({ windows, members, at: new Date("2026-10-27T12:30:00Z"), tz: TZ })).toEqual({
      ownerId: tugu,
      waitingForLive: true,
    });
  });
  it("ignores inactive and crew members", () => {
    const r = routeNewLead({
      windows,
      members: members.map((m) => (m.id === admin ? { ...m, active: false } : m)),
      at: new Date("2026-10-26T16:00:00Z"),
      tz: TZ,
    });
    expect(r).toEqual({ ownerId: tugu, waitingForLive: true });
  });
});

describe("quiet hours", () => {
  const rules = { quietStart: "21:00", quietEnd: "08:00" };
  it("detects quiet hours across midnight", () => {
    expect(isQuietHours(new Date("2026-10-27T01:30:00Z"), rules, TZ)).toBe(true); // 9:30 PM EDT
    expect(isQuietHours(new Date("2026-10-27T11:00:00Z"), rules, TZ)).toBe(true); // 7:00 AM
    expect(isQuietHours(new Date("2026-10-27T12:00:00Z"), rules, TZ)).toBe(false); // 8:00 AM
  });
  it("outside quiet hours sends now", () => {
    const now = new Date("2026-10-27T15:00:00Z");
    expect(nextSendTime(now, rules, TZ)).toEqual(now);
  });
  it("late evening → next morning 8:00 AM", () => {
    expect(et(nextSendTime(new Date("2026-10-27T02:00:00Z"), rules, TZ))).toBe("Tue 2026-10-27 08:00");
  });
  it("after midnight → same morning 8:00 AM", () => {
    expect(et(nextSendTime(new Date("2026-10-27T06:00:00Z"), rules, TZ))).toBe("Tue 2026-10-27 08:00");
  });
  it("across the Nov 1 DST change: Sat 10 PM EDT → Sun 8:00 AM EST (13:00Z)", () => {
    const r = nextSendTime(new Date("2026-11-01T02:00:00Z"), rules, TZ);
    expect(et(r)).toBe("Sun 2026-11-01 08:00");
    expect(r.toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });
});

describe("response clock", () => {
  it("counts down from 60 minutes", () => {
    const created = new Date("2026-10-27T15:00:00Z");
    expect(responseMinutesLeft(created, { responseMinutes: 60 }, new Date("2026-10-27T15:45:00Z"))).toBe(15);
    expect(responseMinutesLeft(created, { responseMinutes: 60 }, new Date("2026-10-27T16:30:00Z"))).toBe(-30);
  });
});
