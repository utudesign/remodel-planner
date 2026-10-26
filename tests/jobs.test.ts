import { describe, expect, it } from "vitest";
import { advanceJobStatus, jobMoney, milestoneDealPatch } from "@/lib/jobs";
import { kpiForDeal, kpiTotals } from "@/lib/kpis";

const fresh = { job_status: "not_started", deposit_received_at: null, paid_in_full_at: null, job_completed_at: null };
const AT = "2026-11-02T17:00:00.000Z";

describe("job milestones → deal", () => {
  it("only moves the status forward", () => {
    expect(advanceJobStatus("not_started", "signed")).toBe("signed");
    expect(advanceJobStatus("in_progress", "signed")).toBe("in_progress");
    expect(advanceJobStatus("cancelled", "completed")).toBe("cancelled");
  });
  it("deposit sets the deposit date (which starts the commission) once", () => {
    expect(milestoneDealPatch("deposit", fresh, AT)).toEqual({ job_status: "signed", deposit_received_at: AT });
    expect(milestoneDealPatch("deposit", { ...fresh, job_status: "ordered", deposit_received_at: "x" }, AT)).toEqual({});
  });
  it("ordered / install / walkthrough / paid", () => {
    expect(milestoneDealPatch("cabinets_ordered", { ...fresh, job_status: "signed" }, AT)).toEqual({ job_status: "ordered" });
    expect(milestoneDealPatch("cabinet_install", { ...fresh, job_status: "ordered" }, AT)).toEqual({ job_status: "in_progress" });
    expect(milestoneDealPatch("walkthrough", { ...fresh, job_status: "in_progress" }, AT)).toEqual({ job_status: "completed", job_completed_at: AT });
    expect(milestoneDealPatch("paid_full", fresh, AT)).toEqual({ paid_in_full_at: AT });
    expect(milestoneDealPatch("design_approved", fresh, AT)).toEqual({});
  });
});

describe("job money + KPIs", () => {
  it("profit = sold + change orders − costs − commission", () => {
    const m = jobMoney({ soldCents: 3_850_000, changeOrdersCents: 150_000, costs: [1_800_000, 600_000, null], commissionCents: 200_000 });
    expect(m).toEqual({ revenueCents: 4_000_000, costCents: 2_400_000, commissionCents: 200_000, profitCents: 1_400_000, margin: 0.35 });
  });
  it("RenoDesign's own deals carry no commission; cancelled isn't won", () => {
    const base = { created_at: "2026-10-01", change_orders_cents: 0, estimated_value_cents: null, costCents: [500_000], commissionExpectedCents: 99_999 };
    const own = kpiForDeal({ ...base, id: "a", origin: "partner", sold_price_cents: 2_000_000, cancelled_at: null, latestQuoteCents: 2_100_000 });
    expect(own).toMatchObject({ won: true, wonCents: 2_000_000, commissionCents: 0, profitCents: 1_500_000, estimatedCents: 2_100_000 });
    const lost = kpiForDeal({ ...base, id: "b", origin: "rep", sold_price_cents: 3_000_000, cancelled_at: "2026-10-05", latestQuoteCents: null });
    expect(lost).toMatchObject({ won: false, wonCents: 0, commissionCents: 0, profitCents: -500_000 });
    const open = kpiForDeal({ ...base, id: "c", origin: "rep", sold_price_cents: null, cancelled_at: null, latestQuoteCents: null, costCents: [], estimated_value_cents: 1_000_000 });
    const t = kpiTotals([own, lost, open]);
    expect(t).toMatchObject({ deals: 3, estimated: 2, won: 1, wonCents: 2_000_000, costCents: 1_000_000, avgWonCents: 2_000_000 });
    expect(t.winRate).toBe(0.5);
  });
});
