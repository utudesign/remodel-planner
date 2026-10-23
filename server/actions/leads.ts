"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
import { routeNewLead, nextSendTime } from "@/lib/routing";
import { uploadImages } from "@/lib/storage";
import { flushNotifications } from "@/server/push";
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
    // Routing (FIELD-AND-OFFICE §3): whoever is live gets it; else default owner + "waiting for live shift".
    const [windows, members] = await Promise.all([
      must(await s.db.from("work_windows").select("user_id, weekday, start_time, end_time, kind")),
      must(await s.db.from("users").select("id, role, active, is_default_owner")),
    ]);
    const route = routeNewLead({ windows, members, tz: s.timezone });
    // next_follow_up_at (now + 1h, rule 6) is set by the DB.
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
          owner_id: route.ownerId,
          waiting_for_live: route.waitingForLive,
        })
        .select("id")
        .single(),
    );
    const photos = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    if (photos.length) {
      const paths = await uploadImages(photos, s.companyId, `leads/${lead.id}`);
      ok(
        await s.db.from("files").insert(
          paths.map((path) => ({ company_id: s.companyId, lead_id: lead.id, kind: "photo", path, uploaded_by: s.userId })),
        ),
      );
    }
    newId = lead.id;
    after(() => flushNotifications(s.companyId));
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


// ---------------------------------------------------------------- reassign (one tap)
export async function reassignLead(input: { lead_id: string; owner_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ lead_id: z.uuid(), owner_id: z.uuid() }).parse(input);
    const s = await requireRole(...TEAM_ROLES);
    ok(await s.db.from("leads").update({ owner_id: v.owner_id }).eq("id", v.lead_id));
    after(() => flushNotifications(s.companyId));
    revalidateLead(v.lead_id);
  });
}

// ---------------------------------------------------------------- scheduled client messages
const scheduleSchema = z.object({
  lead_id: z.uuid(),
  channel: z.enum(["sms", "email", "call_reminder"]),
  body: z.string().trim().min(1, "write the message").max(1600),
  send_at: z.string().optional(), // datetime-local; empty = now, or 8:00 AM if it's quiet hours
});

/** Phase 1: a reminder at send time (no SMS provider yet). Quiet hours push it to the morning. */
export async function scheduleMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = scheduleSchema.parse(formToObject(fd));
    const s = await requireRole(...TEAM_ROLES);
    const wanted = v.send_at ? datetimeLocalToUtc(v.send_at, s.timezone) : new Date();
    const sendAt = nextSendTime(wanted, s.rules, s.timezone);
    ok(
      await s.db.from("scheduled_messages").insert({
        company_id: s.companyId,
        lead_id: v.lead_id,
        channel: v.channel,
        body: v.body,
        send_at: sendAt.toISOString(),
        created_by: s.userId,
      }),
    );
    revalidateLead(v.lead_id);
    revalidatePath("/command");
    const moved = sendAt.getTime() - wanted.getTime() > 60_000;
    return { ok: true, message: moved ? "Quiet hours — saved for the morning" : "Saved" };
  });
}

export async function markMessageSent(input: { message_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ message_id: z.uuid() }).parse(input);
    const s = await requireRole(...TEAM_ROLES);
    const m = must(
      await s.db
        .from("scheduled_messages")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", v.message_id)
        .select("lead_id, channel, body")
        .single(),
    );
    if (m.lead_id && m.channel !== "call_reminder") {
      ok(
        await s.db.from("activities").insert({
          company_id: s.companyId,
          lead_id: m.lead_id,
          type: m.channel === "sms" ? "text" : "email",
          direction: "out",
          summary: m.body.slice(0, 200),
          created_by: s.userId,
        }),
      );
    }
    revalidateLead(m.lead_id ?? undefined);
    revalidatePath("/command");
  });
}
