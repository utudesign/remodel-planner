import { describe, expect, it } from "vitest";
import { bumpFollowUp, followUpLabel } from "@/lib/deals/follow-up-bump";

const tz = "America/New_York";
// Sat Oct 31 2026, 5:00 PM EDT
const now = new Date("2026-10-31T21:00:00Z");

describe("bumpFollowUp (v3 item 4 quick buttons)", () => {
  it("+1 day keeps the follow-up's clock time, counted from today", () => {
    const cur = new Date("2026-10-27T22:00:00Z"); // Tue 6:00 PM EDT (overdue)
    expect(bumpFollowUp(cur, now, 1, tz).toISOString()).toBe("2026-11-01T23:00:00.000Z"); // Sun 6:00 PM EST
  });

  it("crosses the DST change on Nov 1 correctly", () => {
    const cur = new Date("2026-10-31T13:00:00Z"); // 9:00 AM EDT
    expect(bumpFollowUp(cur, now, 3, tz).toISOString()).toBe("2026-11-03T14:00:00.000Z"); // 9:00 AM EST
  });

  it("no follow-up yet → 9:00 AM", () => {
    expect(bumpFollowUp(null, now, 7, tz).toISOString()).toBe("2026-11-07T14:00:00.000Z");
  });
});

describe("followUpLabel", () => {
  it("today / tomorrow / this week / later", () => {
    expect(followUpLabel(new Date("2026-10-31T22:00:00Z"), now, tz)).toBe("Today 6:00 PM");
    expect(followUpLabel(new Date("2026-11-01T23:00:00Z"), now, tz)).toBe("Tomorrow 6:00 PM");
    expect(followUpLabel(new Date("2026-11-03T23:00:00Z"), now, tz)).toBe("Tue 6:00 PM");
    expect(followUpLabel(new Date("2026-11-10T23:00:00Z"), now, tz)).toBe("Tue Nov 10, 6:00 PM");
    expect(followUpLabel(new Date("2026-10-27T22:00:00Z"), now, tz)).toBe("Tue Oct 27, 6:00 PM");
  });
});
