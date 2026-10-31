"use server";

import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { datetimeLocalToUtc } from "@/lib/dates";
import { bumpFollowUp as bumpTime } from "@/lib/deals/follow-up-bump";
import { maybe, ok, run, type ActionState } from "@/server/action-utils";
import { completeVisit, jacketDeal as deal, revalidateJacket as revalidateDeal } from "@/server/jacket-shared";

/**
 * Deal jacket, change request v3 batch B: checklist ticks by hand (item 1), the stage stepper and
 * follow-up quick buttons (item 4), Mark as visited (item 5). Every change lands in History through
 * the 0018 audit triggers; nothing here writes History by hand.
 */

/** Tick (or untick) a job-ready checklist item by hand. Records who + when (0018); the gate accepts it. */
export async function setChecklistTick(input: {
  deal_id: string;
  requirement_id: string;
  checked: boolean;
}): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ deal_id: z.uuid(), requirement_id: z.uuid(), checked: z.boolean() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const d = await deal(s, v.deal_id);
    if (v.checked) {
      const { error } = await s.db
        .from("deal_checklist_checks")
        .insert({ deal_id: d.id, requirement_id: v.requirement_id, company_id: s.companyId });
      if (error && !/duplicate key/.test(error.message)) throw new Error(error.message);
    } else {
      ok(
        await s.db
          .from("deal_checklist_checks")
          .delete()
          .eq("deal_id", d.id)
          .eq("requirement_id", v.requirement_id),
      );
    }
    revalidateDeal(d.deal_number);
    return { ok: true, message: v.checked ? "Checked" : "Unchecked" };
  });
}

/**
 * Stepper move. Sold goes through Mark sold (the database refuses any other way); Lost needs a reason.
 * The follow-up resets from the stage's rules in the database (0001/0007 trigger).
 */
export async function moveDealStage(input: {
  deal_id: string;
  stage: string;
  lost_reason?: string | null;
}): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ deal_id: z.uuid(), stage: z.string().min(1).max(60), lost_reason: z.string().max(60).nullish() })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const d = await deal(s, v.deal_id);
    const st = maybe(
      await s.db
        .from("pipeline_stages")
        .select("key, kind, active")
        .eq("company_id", s.companyId)
        .eq("key", v.stage)
        .maybeSingle(),
    );
    if (!st || !st.active) throw new Error("That stage isn't in your pipeline");
    if (st.kind === "handed_off") throw new Error("Use Mark sold on the Job tab: it checks the job-ready checklist first.");
    if (st.kind === "lost" && !v.lost_reason) throw new Error("Pick why it was lost");
    ok(
      await s.db
        .from("deals")
        .update({ stage: v.stage, lost_reason: st.kind === "lost" ? v.lost_reason : null })
        .eq("id", d.id),
    );
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Stage updated" };
  });
}

/** +1 day / +3 days / +1 week from today, keeping the follow-up's clock time (lib/deals/follow-up-bump). */
export async function bumpFollowUp(input: { deal_id: string; days: number }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ deal_id: z.uuid(), days: z.number().int().min(1).max(60) }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const d = await deal(s, v.deal_id);
    const at = bumpTime(d.next_follow_up_at ? new Date(d.next_follow_up_at) : null, new Date(), v.days, s.timezone);
    ok(await s.db.from("deals").update({ next_follow_up_at: at.toISOString() }).eq("id", d.id));
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Follow-up moved" };
  });
}

/** "Pick date": a datetime-local value in the company time zone. */
export async function setFollowUpAt(input: { deal_id: string; at: string }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ deal_id: z.uuid(), at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time") })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const d = await deal(s, v.deal_id);
    const at = datetimeLocalToUtc(v.at, s.timezone);
    ok(await s.db.from("deals").update({ next_follow_up_at: at.toISOString() }).eq("id", d.id));
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Follow-up set" };
  });
}

export async function markVisited(input: { deal_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ deal_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    await completeVisit(s, v.deal_id);
    return { ok: true, message: "Marked as visited" };
  });
}
