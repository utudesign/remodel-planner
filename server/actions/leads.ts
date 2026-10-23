"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { datetimeLocalToUtc } from "@/lib/dates";
import { suggestNextFollowUp } from "@/lib/follow-up";
import {
  bookMeetingSchema,
  logActivitySchema,
  markLostSchema,
  moveStageSchema,
  newLeadSchema,
  updateLeadSchema,
} from "@/lib/validation/lead";
import { formToObject, maybe, must, ok, run, type ActionState } from "@/server/action-utils";
import { countOutboundSince } from "@/server/queries/leads";
import { getFollowUpRules } from "@/server/queries/settings";

const TEAM_ROLES = ["owner", "team"] as const;

function revalidateLead(leadId?: string) {
  revalidatePath("/leads");
  revalidatePath("/today");
  if (leadId) revalidatePath(`/leads/${leadId}`);
}

export async function createLead(_: ActionState, fd: FormData): Promise<ActionState> {
  let newId = "";
  const res = await run(async () => {
    const v = newLeadSchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    const stage = maybe(
      await s.db.from("pipeline_stages").select("id").eq("key", "new").maybeSingle(),
    );
    if (!stage) throw new Error('No "new" stage configured. Check Settings → Pipeline stages.');
    const contact = must(
      await s.db
        .from("contacts")
        .insert({
          company_id: s.companyId,
          name: v.name,
          phone: v.phone,
          email: v.email || null,
          address: v.address,
          city: v.city,
          zip: v.zip,
        })
        .select("id")
        .single(),
    );
    // owner + next_follow_up_at (now + 1h) are set by the DB (rule 6)
    const lead = must(
      await s.db
        .from("leads")
        .insert({
          company_id: s.companyId,
          contact_id: contact.id,
          stage_id: stage.id,
          source: v.source,
          scope: v.scope ?? null,
          budget_min_cents: v.budget_min,
          budget_max_cents: v.budget_max,
          desired_timeline: v.desired_timeline,
          notes: v.notes,
        })
        .select("id")
        .single(),
    );
    await s.db.from("activities").insert({
      company_id: s.companyId,
      lead_id: lead.id,
      type: "system",
      summary: "Lead created",
      created_by: s.userId,
    });
    newId = lead.id;
    revalidateLead();
  });
  if (res?.ok && newId) redirect(`/leads/${newId}`);
  return res;
}

export async function updateLead(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = updateLeadSchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    ok(
      await s.db
        .from("contacts")
        .update({
          name: v.name,
          phone: v.phone,
          email: v.email || null,
          address: v.address,
          city: v.city,
          zip: v.zip,
        })
        .eq("id", v.contact_id),
    );
    ok(
      await s.db
        .from("leads")
        .update({
          source: v.source,
          scope: v.scope ?? null,
          budget_min_cents: v.budget_min,
          budget_max_cents: v.budget_max,
          desired_timeline: v.desired_timeline,
          notes: v.notes,
          owner_id: v.owner_id,
        })
        .eq("id", v.lead_id),
    );
    revalidateLead(v.lead_id);
    return { ok: true, message: "Saved" };
  });
}

/** Log a call/text/etc. A next follow-up is always required (business rule 1). */
export async function logActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = logActivitySchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    ok(
      await s.db.from("activities").insert({
        company_id: s.companyId,
        lead_id: v.lead_id,
        type: v.type,
        direction: v.type === "note" ? null : (v.direction ?? "out"),
        summary: v.summary ?? "",
        created_by: s.userId,
      }),
    );
    ok(
      await s.db
        .from("leads")
        .update({
          next_follow_up_at: datetimeLocalToUtc(v.next_follow_up_at, s.timezone).toISOString(),
        })
        .eq("id", v.lead_id),
    );
    revalidateLead(v.lead_id);
    return { ok: true, message: "Logged" };
  });
}

/** Drag on the board / stage picker. Won and Lost have their own flows. */
export async function moveLeadStage(input: {
  lead_id: string;
  stage_id: string;
}): Promise<ActionState> {
  return run(async () => {
    const v = moveStageSchema.parse(input);
    const s = await requireRole(...TEAM_ROLES);
    const stage = must(
      await s.db.from("pipeline_stages").select("id, key, label").eq("id", v.stage_id).single(),
    );
    if (stage.key === "won") {
      throw new Error(
        "A lead is won when the deposit arrives. Open the lead and use “Deposit received”.",
      );
    }
    if (stage.key === "lost") throw new Error("Use “Mark lost” so a reason is recorded.");

    const rules = await getFollowUpRules(s, stage.id);
    const next = suggestNextFollowUp({
      rules,
      stageEnteredAt: new Date(),
      attempt: 0,
      tz: s.timezone,
    });
    ok(
      await s.db
        .from("leads")
        .update({ stage_id: stage.id, next_follow_up_at: next.toISOString() })
        .eq("id", v.lead_id),
    );
    revalidateLead(v.lead_id);
    return { ok: true, message: `Moved to ${stage.label}` };
  });
}

export async function markLost(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = markLostSchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    const lost = must(await s.db.from("pipeline_stages").select("id").eq("key", "lost").single());
    ok(
      await s.db
        .from("leads")
        .update({ stage_id: lost.id, lost_reason_id: v.lost_reason_id, lost_note: v.lost_note })
        .eq("id", v.lead_id),
    );
    revalidateLead(v.lead_id);
    return { ok: true, message: "Marked lost" };
  });
}

export async function reopenLead(input: { lead_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = moveStageSchema.pick({ lead_id: true }).parse(input);
    const s = await requireRole(...TEAM_ROLES);
    const contacted = must(
      await s.db.from("pipeline_stages").select("id").eq("key", "contacted").single(),
    );
    return moveLeadStage({ lead_id: v.lead_id, stage_id: contacted.id });
  });
}

export async function bookMeeting(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = bookMeetingSchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    const at = datetimeLocalToUtc(v.scheduled_at, s.timezone);
    ok(
      await s.db.from("meetings").insert({
        company_id: s.companyId,
        lead_id: v.lead_id,
        type: v.type,
        scheduled_at: at.toISOString(),
        notes: v.notes,
        assignee_id: s.userId,
      }),
    );
    ok(
      await s.db.from("activities").insert({
        company_id: s.companyId,
        lead_id: v.lead_id,
        type: "meeting",
        summary: `Meeting booked (${v.type.replace("_", " ")})`,
        created_by: s.userId,
      }),
    );
    if (v.move_to_booked === "on") {
      const booked = maybe(
        await s.db
          .from("pipeline_stages")
          .select("id, key")
          .eq("key", "meeting_booked")
          .maybeSingle(),
      );
      if (booked) {
        // Follow up 24h before the meeting (playbook §1 Step 2), or now + 1h if it's sooner.
        const remind = new Date(Math.max(at.getTime() - 24 * 3600_000, Date.now() + 3600_000));
        ok(
          await s.db
            .from("leads")
            .update({ stage_id: booked.id, next_follow_up_at: remind.toISOString() })
            .eq("id", v.lead_id),
        );
      }
    }
    revalidateLead(v.lead_id);
    return { ok: true, message: "Meeting booked" };
  });
}

export async function setMeetingStatus(input: { meeting_id: string; status: "done" | "canceled" }) {
  return run(async () => {
    const s = await requireRole(...TEAM_ROLES);
    const m = must(
      await s.db
        .from("meetings")
        .update({ status: input.status })
        .eq("id", input.meeting_id)
        .select("lead_id")
        .single(),
    );
    revalidateLead(m.lead_id ?? undefined);
  });
}

/** Suggested next follow-up for the "Log" form (attempt = outbound touches in this stage). */
export async function suggestFollowUpFor(leadId: string): Promise<string> {
  const s = await requireRole(...TEAM_ROLES);
  const lead = must(
    await s.db.from("leads").select("stage_id, stage_entered_at").eq("id", leadId).single(),
  );
  const [rules, attempt] = await Promise.all([
    getFollowUpRules(s, lead.stage_id),
    countOutboundSince(s, leadId, lead.stage_entered_at),
  ]);
  // +1: the touch being logged now counts.
  return suggestNextFollowUp({
    rules,
    stageEnteredAt: new Date(lead.stage_entered_at),
    attempt: attempt + 1,
    tz: s.timezone,
  }).toISOString();
}
