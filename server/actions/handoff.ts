"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/app-url";
import { JOB_STATUSES } from "@/lib/deals/display";
import { datetimeLocalToUtc } from "@/lib/dates";
import { optMoney } from "@/lib/validation/common";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";
import { flushNotifications } from "@/server/push";

export type HandoffResult = (NonNullable<ActionState> & { missing?: string[] }) | null;

/** Hand off: partner + plan; the database checks the "before hand-off" checklist (0006). */
export async function handOff(input: { deal_id: string; partner_id: string; plan_id: string }): Promise<HandoffResult> {
  try {
    const v = z.object({ deal_id: z.uuid(), partner_id: z.uuid(), plan_id: z.uuid() }).parse(input);
    const s = await requireRole("owner");
    const { data, error } = await s.db
      .from("deals")
      .update({ partner_id: v.partner_id, commission_plan_id: v.plan_id, handed_off_at: new Date().toISOString() })
      .eq("id", v.deal_id)
      .eq("company_id", s.companyId)
      .is("handed_off_at", null)
      .select("deal_number")
      .single();
    if (error) {
      const m = error.message.match(/missing before hand-off: (.*)$/);
      if (m) return { ok: false, error: "Add these first:", missing: m[1].split(", ") };
      return { ok: false, error: error.message };
    }
    revalidatePath(`/deals/${data.deal_number}`);
    revalidatePath("/deals");
    revalidatePath("/today");
    return { ok: true, message: "Handed off" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not hand off" };
  }
}

const dt = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

const jobSchema = z.object({
  deal_id: z.uuid(),
  job_status: z.enum(JOB_STATUSES.map((j) => j.key) as [string, ...string[]]),
  sold_price: optMoney,
  change_orders: optMoney,
  deposit_received_on: dt,
  paid_in_full_on: dt,
  completed_on: dt,
  partner_note: z.string().trim().max(2000).optional().default(""),
});

/** Job progress the partner reports: Crystal with her login, or me typing what she texted. */
export async function updateJob(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = jobSchema.parse(formToObject(fd));
    const s = await requireRole("owner", "partner");
    const day = (d: string | null) => (d ? datetimeLocalToUtc(`${d}T12:00`, s.timezone).toISOString() : null);
    const deal = must(
      await s.db
        .from("deals")
        .select("deal_number, deposit_received_at, paid_in_full_at, job_completed_at, cancelled_at")
        .eq("id", v.deal_id)
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
    revalidatePath(`/p/${deal.deal_number}`);
    revalidatePath("/money");
    return { ok: true, message: "Saved" };
  });
}

const partnerSchema = z.object({
  partner_id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1, "is required").max(120),
  contact_name: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  license_number: z.string().trim().max(40).optional().default(""),
  license_class: z.enum(["", "A", "B", "C"]).optional().default(""),
});

export async function savePartner(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = partnerSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const row = {
      company_id: s.companyId,
      name: v.name,
      contact_name: v.contact_name || null,
      phone: v.phone || null,
      email: v.email || null,
      license_number: v.license_number || null,
      license_class: v.license_class || null,
    };
    if (v.partner_id) ok(await s.db.from("partners").update(row).eq("id", v.partner_id));
    else ok(await s.db.from("partners").insert(row));
    revalidatePath("/partners");
    return { ok: true, message: "Saved" };
  });
}

const pct = z.coerce.number().min(0).max(100);
const planSchema = z.object({
  plan_id: z.uuid().optional().or(z.literal("")),
  partner_id: z.uuid(),
  name: z.string().trim().min(1, "is required").max(80),
  rate_pct: pct.refine((n) => n < 100, "must be under 100%"),
  first_payout_pct: pct,
  min_dollars: z.coerce.number().min(0).max(100000),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

/** Commission plans (More → Partners). Rates are typed as % and stored as numeric(5,4). */
export async function savePlan(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = planSchema.parse({ active: "false", ...formToObject(fd) });
    const s = await requireRole("owner");
    const row = {
      company_id: s.companyId,
      partner_id: v.partner_id,
      name: v.name,
      basis: "contract_price",
      rate: Math.round(v.rate_pct * 100) / 10000,
      first_payout_pct: Math.round(v.first_payout_pct * 100) / 10000,
      min_cents: Math.round(v.min_dollars * 100),
      active: v.active,
    };
    if (v.plan_id) ok(await s.db.from("commission_plans").update(row).eq("id", v.plan_id));
    else ok(await s.db.from("commission_plans").insert(row));
    revalidatePath("/partners");
    revalidatePath("/deals");
    return { ok: true, message: "Plan saved" };
  });
}

/** Invite Crystal: an invite row (the app links her login at first sign-in) + a Clerk email invitation. */
export async function invitePartner(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ partner_id: z.uuid(), email: z.email().max(200), name: z.string().trim().max(120).optional().default("") })
      .parse(formToObject(fd));
    const s = await requireRole("owner");
    const email = v.email.toLowerCase();
    ok(
      await s.db
        .from("partner_invites")
        .upsert(
          { company_id: s.companyId, partner_id: v.partner_id, email, name: v.name || null, accepted_at: null },
          { onConflict: "company_id,email" },
        ),
    );
    let sent = false;
    try {
      await (await clerkClient()).invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${await appUrl()}/sign-up`,
        ignoreExisting: true,
      });
      sent = true;
    } catch {
      sent = false; // Clerk not reachable / already a user: she can still sign in with this email
    }
    revalidatePath("/partners");
    return {
      ok: true,
      message: sent
        ? `Invite emailed to ${email}. When she signs in, she sees only the deals you hand to her.`
        : `Invite saved. Send her ${await appUrl()}/sign-in and have her sign in with ${email}.`,
    };
  });
}
