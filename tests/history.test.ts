import { describe, expect, it } from "vitest";
import { buildHistory, type AuditRow, type HistoryLookups } from "@/lib/deals/history";

const L: HistoryLookups = {
  people: new Map([["u1", "Tugu"], ["u2", "Crystal"]]),
  stages: new Map([["new", "New lead"], ["qualified", "Qualified"], ["lost", "Lost"]]),
  lostReasons: new Map([["price", "Price"]]),
  requirements: new Map([["r1", "Measurements + sketch"]]),
  quotes: new Map([["q1", "26-1047-E1"]]),
  photoTags: new Map([["before", "Before"], ["sketch", "Sketch"]]),
  folders: new Map([["design", "Design"]]),
  formatTime: (iso) => `T(${iso.slice(11, 16)})`,
  formatMoney: (c) => `$${(c / 100).toLocaleString("en-US")}`,
};

let n = 0;
const row = (p: Partial<AuditRow>): AuditRow => ({
  id: ++n,
  table_name: "deals",
  record_id: "d1",
  action: "update",
  before: null,
  after: null,
  actor_id: "u1",
  created_at: "2026-10-31T20:00:00Z",
  ...p,
});

describe("buildHistory (v3 item 3)", () => {
  it("splits a deal update into stage, follow-up and field edits, with labels and old → new", () => {
    const h = buildHistory(
      [
        row({
          before: { stage: "new", next_follow_up_at: "2026-10-31T21:00:00Z", budget_max_cents: 2000000 },
          after: { stage: "lost", lost_reason: "price", next_follow_up_at: null, budget_max_cents: 2500000 },
        }),
      ],
      [],
      L,
    );
    expect(h.map((e) => e.kind)).toEqual(["stage", "change", "change"]);
    expect(h[0].title).toBe("Stage: New lead → Lost (Price)");
    expect(h[0].who).toBe("Tugu");
    expect(h.find((e) => e.title === "Deal edited")?.lines).toEqual(["Budget up to: $20,000 → $25,000"]);
    expect(h.find((e) => e.title === "Follow-up cleared")?.lines).toEqual(["was T(21:00)"]);
  });

  it("checklist ticks, files, estimates and activities read as sentences, newest first", () => {
    const h = buildHistory(
      [
        row({ table_name: "deal_checklist_checks", action: "insert", after: { requirement_id: "r1" }, created_at: "2026-10-31T20:01:00Z" }),
        row({ table_name: "deal_files", action: "insert", after: { folder: "photos", photo_tag: "sketch" }, created_at: "2026-10-31T20:02:00Z" }),
        row({ table_name: "quotes", record_id: "q1", action: "update", after: { archived_at: "x" }, created_at: "2026-10-31T20:03:00Z" }),
      ],
      [{ id: "a1", type: "call", direction: "in", summary: "Wants white shaker", occurred_at: "2026-10-31T20:04:00Z", created_by: null }],
      L,
    );
    expect(h.map((e) => e.title)).toEqual([
      "Call in",
      "Estimate archived: 26-1047-E1",
      "Photo (Sketch) added",
      "✓ Measurements + sketch (checked by hand)",
    ]);
    expect(h[0].who).toBe("Customer");
    expect(h[0].lines).toEqual(["Wants white shaker"]);
  });

  it("merges one person's line edits on the same estimate within 15 minutes", () => {
    const line = (min: number, after: Record<string, unknown>, who = "u1") =>
      row({
        table_name: "quote_line_items",
        action: "insert",
        after: { quote_id: "q1", ...after },
        actor_id: who,
        created_at: `2026-10-31T20:${String(min).padStart(2, "0")}:00Z`,
      });
    const h = buildHistory(
      [line(0, { code: "B36", qty: 2 }), line(5, { code: "W3030", qty: 1 }), line(40, { code: "SB36", qty: 1 }), line(41, { code: "F3", qty: 1 }, "u2")],
      [],
      L,
    );
    expect(h).toHaveLength(3);
    expect(h[2].lines).toEqual(["Added W3030 ×1", "Added B36 ×2"]);
    expect(h[0].who).toBe("Crystal");
  });

  it("never shows ballpark money in site-visit entries", () => {
    const h = buildHistory(
      [row({ table_name: "site_visits", action: "update", after: { walls: [], ballpark_low_cents: 1, notes: "x" } })],
      [],
      L,
    );
    expect(h[0].lines.join(" ")).not.toMatch(/ballpark/i);
  });
});
