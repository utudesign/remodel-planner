"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { JOB_STATUSES } from "@/lib/deals/display";
import { datetimeLocalToUtc } from "@/lib/dates";
import { parseDollarsToCents } from "@/lib/money";
import { optMoney } from "@/lib/validation/common";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";
import { flushNotifications } from "@/server/push";

const staff = () => requireRole("owner", "team", "partner");

export type SaleResult = (NonNullable<ActionState> & { missing?: string[] }) | null;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");
const optDay = z.preprocess((x) => (x === "" || x == null ? null : x), ymd.nullable());

/**
 * Mark sold (0015, replaces the hand-off): the database checks the job-ready checklist and the price,
 * moves the deal to Sold, starts the job and ticks Contract signed (+ Deposit received).
 */
export async function markSold(input: {
  deal_id: string;
  price: string;
  signed_on: string;
  deposit_on: string;
}): Promise<SaleResult> {
  try {
    const v = z
      .object({ deal_id: z.uuid(), price: z.string(), signed_on: optDay, deposit_on: optDay })
      .parse(input);
    let cents: number | null = null;
    try {
      cents = parseDollarsToCents(v.price);
    } catch {
      cents = null;
    }
    if (!cents || cents <= 0) return { ok: false, error: "Enter the sold price (the contract total)." };
    const s = await staff();
    const { error } = await s.db.rpc("mark_sold", {
      p_deal: v.deal_id,
      p_price_cents: cents,
      p_signed_on: v.signed_on ?? undefined,
      p_deposit_on: v.deposit_on ?? undefined,
    });
    if (error) {
      const m = error.message.match(/checklist is missing: (.*)$/);
      if (m) return { ok: false, error: "Add these first:", missing: m[1].split(", ") };
      return { ok: false, error: error.message };
    }
    const { data } = await s.db.from("deals").select("deal_number").eq("id", v.deal_id).single();
    if (data) revalidatePath(`/deals/${data.deal_number}`);
    revalidatePath("/deals");
    revalidatePath("/today");
    revalidatePath("/jobs");
    revalidatePath("/kpis");
    return { ok: true, message: "Sold. The job timeline is ready." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not mark it sold" };
  }
}

const dt = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

const saleSchema = z.object({
  deal_id: z.uuid(),
  job_status: z.enum(JOB_STATUSES.map((j) => j.key) as [string, ...string[]]),
  sold_price: optMoney,
  change_orders: optMoney,
  deposit_received_on: dt,
  paid_in_full_on: dt,
  completed_on: dt,
  partner_note: z.string().trim().max(2000).optional().default(""),
});

/** Sale + payments on a sold deal: status, price, change orders, deposit, paid in full, completed, note. */
export async function updateSale(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = saleSchema.parse(formToObject(fd));
    const s = await staff();
    const day = (d: string | null) => (d ? datetimeLocalToUtc(`${d}T12:00`, s.timezone).toISOString() : null);
    const deal = must(
      await s.db
        .from("deals")
        .select("deal_number, deposit_received_at, paid_in_full_at, job_completed_at, cancelled_at")
        .eq("id", v.deal_id)
        .eq("company_id", s.companyId)
        .single(),
    );
    const keepDay = (prev: string | null, next: string | null) =>
      next && prev && prev.slice(0, 10) === next.slice(0, 10) ? prev : next;
    ok(
      await s.db
        .from("deals")
        .update({
          job_status: v.job_status,
          sold_price_cents: v.sold_price,
          change_orders_cents: v.change_orders ?? 0,
          deposit_received_at: keepDay(deal.deposit_received_at, day(v.deposit_received_on)),
          paid_in_full_at: keepDay(deal.paid_in_full_at, day(v.paid_in_full_on)),
          job_completed_at: keepDay(deal.job_completed_at, day(v.completed_on)),
          cancelled_at: v.job_status === "cancelled" ? (deal.cancelled_at ?? new Date().toISOString()) : null,
          partner_note: v.partner_note || null,
        })
        .eq("id", v.deal_id),
    );
    after(() => flushNotifications(s.companyId));
    revalidatePath(`/deals/${deal.deal_number}`);
    revalidatePath("/deals");
    revalidatePath("/jobs");
    revalidatePath("/kpis");
    return { ok: true, message: "Saved" };
  });
}
