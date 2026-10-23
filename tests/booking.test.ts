import { describe, expect, it } from "vitest";
import { availableSlots } from "@/lib/booking";
import { fillAutoReply, smsHref } from "@/lib/leads/auto-reply";

const rules = { minutes: 90, weekday: { start: "17:30", end: "20:00" }, saturday: { start: "09:00", end: "17:00" } };
const tz = "America/New_York";

describe("availableSlots", () => {
  const now = new Date("2026-10-23T12:00:00Z"); // Fri 8:00 AM EDT
  const slots = availableSlots(rules, [], now, tz, 3); // Fri, Sat, Sun

  it("weekday evening slots fit the 90-minute visit: 5:30 and 6:00 and 6:30", () => {
    expect(slots.filter((s) => s.date === "2026-10-23").map((s) => s.label)).toEqual(["5:30 PM", "6:00 PM", "6:30 PM"]);
  });
  it("Saturday 9:00 to 3:30 start times; Sunday off", () => {
    const sat = slots.filter((s) => s.date === "2026-10-24");
    expect(sat[0].label).toBe("9:00 AM");
    expect(sat.at(-1)!.label).toBe("3:30 PM");
    expect(slots.some((s) => s.date === "2026-10-25")).toBe(false);
  });
  it("stored in UTC (5:30 PM EDT = 21:30Z)", () => {
    expect(slots[0].start).toBe("2026-10-23T21:30:00.000Z");
  });
  it("a booked visit blocks overlapping slots plus a 30-minute buffer", () => {
    const busy = [{ start: new Date("2026-10-23T22:00:00Z"), end: new Date("2026-10-23T23:30:00Z") }];
    const fri = availableSlots(rules, busy, now, tz, 1).map((s) => s.label);
    expect(fri).toEqual([]);
  });
  it("no slot within 4 hours", () => {
    const late = availableSlots(rules, [], new Date("2026-10-23T18:15:00Z"), tz, 1); // 2:15 PM EDT
    expect(late.map((s) => s.label)).toEqual(["6:30 PM"]);
  });
  it("after the DST change 5:30 PM EST = 22:30Z", () => {
    const s = availableSlots(rules, [], new Date("2026-11-09T12:00:00Z"), tz, 1);
    expect(s[0].start).toBe("2026-11-09T22:30:00.000Z");
  });
});

describe("auto-reply", () => {
  it("fills first names and the link", () => {
    const t = fillAutoReply(null, { customerName: "maria gonzalez", myName: "Tugu Z", link: "https://x/book/1" });
    expect(t.startsWith("Hi maria!")).toBe(true);
    expect(t).toContain("I'm Tugu");
    expect(t.endsWith("https://x/book/1")).toBe(true);
  });
  it("custom template + sms link", () => {
    expect(fillAutoReply("Hey {first} {link}", { customerName: "", myName: "", link: "L" })).toBe("Hey there L");
    expect(smsHref("(571) 555-0101", "a b")).toBe("sms:5715550101&body=a%20b");
  });
});
