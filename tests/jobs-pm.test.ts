import { describe, expect, it } from "vitest";
import {
  bucketOf,
  crewConflicts,
  currentPhase,
  hoursWarnings,
  progress,
  rulesSummary,
  type PmTask,
  type SiteRules,
} from "@/lib/jobs/pm";

const phases = [
  { key: "demo", label: "Demo", sort_order: 1 },
  { key: "floor", label: "Floor", sort_order: 2 },
  { key: "cabinet_install", label: "Cabinet install", sort_order: 3 },
];
let n = 0;
const task = (p: Partial<PmTask>): PmTask => ({
  id: `t${++n}`,
  project_id: "p1",
  title: "x",
  phase_key: null,
  trade_key: null,
  assignee_id: null,
  status: "todo",
  pct: 0,
  start_on: null,
  end_on: null,
  start_time: null,
  end_time: null,
  sort_order: n,
  ...p,
});

describe("progress + phase (Ruby's job)", () => {
  it("floor 100%, cabinet install 70% → phase Cabinet install, ~57%", () => {
    const t = [
      task({ phase_key: "demo", status: "done", pct: 100 }),
      task({ phase_key: "floor", status: "done", pct: 100 }),
      task({ phase_key: "cabinet_install", status: "doing", pct: 70 }),
      task({ phase_key: "cabinet_install", title: "Crown", status: "todo", pct: 0 }),
    ];
    expect(currentPhase(t, phases)).toBe("cabinet_install");
    expect(progress(t)).toBe(68);
  });
  it("all done → done", () => {
    expect(currentPhase([task({ phase_key: "demo", status: "done" })], phases)).toBe("done");
  });
});

describe("crewConflicts", () => {
  it("same installer on two jobs on overlapping days", () => {
    const a = task({ project_id: "p1", assignee_id: "bagi", start_on: "2026-11-02", end_on: "2026-11-04" });
    const b = task({ project_id: "p2", assignee_id: "bagi", start_on: "2026-11-04", end_on: "2026-11-05" });
    const c = task({ project_id: "p3", assignee_id: "bagi", start_on: "2026-11-06" });
    const d = task({ project_id: "p2", assignee_id: "other", start_on: "2026-11-03" });
    const m = crewConflicts([a, b, c, d]);
    expect(m.get(a.id)?.map((x) => x.id)).toEqual([b.id]);
    expect(m.has(c.id)).toBe(false);
    expect(m.has(d.id)).toBe(false);
  });
});

describe("site rules (Ruby's condo)", () => {
  const rules: SiteRules = {
    building_type: "condo",
    hours: {
      mon: { start: "08:00", end: "21:00" },
      tue: { start: "08:00", end: "21:00" },
      wed: { start: "08:00", end: "21:00" },
      thu: { start: "08:00", end: "21:00" },
      fri: { start: "08:00", end: "21:00" },
    },
    loud_until: "18:00",
  };
  it("summary", () => {
    expect(rulesSummary(rules)).toBe("Condo · Mon–Fri 8:00 AM–9:00 PM · no loud work after 6:00 PM");
  });
  it("warns outside hours and on days with no work", () => {
    // Sat Nov 7 2026
    expect(hoursWarnings({ start_on: "2026-11-06", end_on: "2026-11-07", start_time: "07:30", end_time: null, status: "todo" }, rules)).toEqual([
      "no work allowed on Sat",
      "starts before 8:00 AM on Fri",
    ]);
    expect(hoursWarnings({ start_on: "2026-11-02", end_on: null, start_time: "08:00", end_time: "20:00", status: "todo" }, rules)).toEqual([]);
    expect(hoursWarnings({ start_on: "2026-11-02", end_on: null, start_time: null, end_time: "21:30", status: "todo" }, rules)).toEqual([
      "ends after 9:00 PM on Mon",
    ]);
  });
});

describe("My work buckets", () => {
  const today = "2026-11-02";
  it("overdue / today / week / later / no date", () => {
    expect(bucketOf({ start_on: "2026-10-30", end_on: "2026-11-01", status: "todo" }, today)).toBe("overdue");
    expect(bucketOf({ start_on: "2026-11-01", end_on: "2026-11-03", status: "doing" }, today)).toBe("today");
    expect(bucketOf({ start_on: "2026-11-06", end_on: null, status: "todo" }, today)).toBe("week");
    expect(bucketOf({ start_on: "2026-11-20", end_on: null, status: "todo" }, today)).toBe("later");
    expect(bucketOf({ start_on: null, end_on: null, status: "todo" }, today)).toBe("nodate");
  });
});

import { whenText } from "@/lib/jobs/pm";
import { homeFor } from "@/lib/auth/roles";

describe("v3 F1/F3 helpers", () => {
  it("whenText shows the day range and times", () => {
    expect(whenText({ start_on: "2026-11-02", end_on: "2026-11-04", start_time: "08:00", end_time: "16:30" })).toBe(
      "Mon, Nov 2 – Wed, Nov 4 · 8:00 AM–4:30 PM",
    );
    expect(whenText({ start_on: null, end_on: null, start_time: null, end_time: null })).toBe("No date");
  });
  it("each role lands on its own home", () => {
    expect(homeFor("crew")).toBe("/work");
    expect(homeFor("customer")).toBe("/my-job");
    expect(homeFor("team")).toBe("/deals");
  });
});
