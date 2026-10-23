"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { localToUtc, todayIn } from "@/lib/dates";
import { nextSendTime } from "@/lib/routing";
import { CHECKLISTS, nextMorning } from "@/lib/shift";
import { formToObject, maybe, must, ok, run, type ActionState } from "@/server/action-utils";

const kind = z.enum(["live", "back_office"]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function upsertHandoff(
  s: Awaited<ReturnType<typeof requireRole>>,
  shiftKind: "live" | "back_office",
  shiftDate: string,
  patch: {
    checklist?: Record<string, boolean>;
    body?: string;
    posted_at?: string;
    publish_at?: string;
  },
) {
  const existing = maybe(
    await s.db
      .from("shift_handoffs")
      .select("id, checklist")
      .eq("user_id", s.userId)
      .eq("shift_kind", shiftKind)
      .eq("shift_date", shiftDate)
      .maybeSingle(),
  );
  if (existing) {
    ok(await s.db.from("shift_handoffs").update(patch).eq("id", existing.id));
    return existing;
  }
  return must(
    await s.db
      .from("shift_handoffs")
      .insert({
        company_id: s.companyId,
        user_id: s.userId,
        shift_kind: shiftKind,
        shift_date: shiftDate,
        ...patch,
      })
      .select("id, checklist")
      .single(),
  );
}

export async function toggleChecklist(input: {
  kind: string;
  date: string;
  key: string;
  done: boolean;
}): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ kind, date, key: z.string().max(40), done: z.boolean() }).parse(input);
    if (!CHECKLISTS[v.kind].some((i) => i.key === v.key)) throw new Error("Unknown checklist item");
    const s = await requireRole("owner", "team");
    const row = await upsertHandoff(s, v.kind, v.date, {});
    const checklist = { ...((row.checklist as Record<string, boolean>) ?? {}), [v.key]: v.done };
    await upsertHandoff(s, v.kind, v.date, { checklist });
    revalidatePath("/command");
  });
}

/** Post the handoff. Back-office briefs publish at 7:00 AM ET and stay pinned for 24h (trigger). */
export async function postHandoff(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ kind, date, body: z.string().trim().min(3, "write a short handoff").max(4000) })
      .parse(formToObject(fd));
    const s = await requireRole("owner", "team");
    const now = new Date();
    const publishAt = v.kind === "back_office" ? nextMorning(now, s.timezone) : now;
    const title = v.kind === "back_office" ? "Night shift" : "Live shift";
    await upsertHandoff(s, v.kind, v.date, {
      body: `${title} (${new Date(`${v.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })})\n${v.body}`,
      posted_at: now.toISOString(),
      publish_at: publishAt.toISOString(),
    });
    revalidatePath("/command");
    revalidatePath("/today");
    return {
      ok: true,
      message:
        v.kind === "back_office"
          ? "Posted. It appears in everyone's feed at 7:00 AM ET."
          : "Posted to the team feed.",
    };
  });
}

/** Tomorrow's visit: schedule the confirmation text for 9:00 AM ET (FIELD-AND-OFFICE §7 #4). */
export async function confirmMeeting(input: { meeting_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ meeting_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team");
    const m = must(
      await s.db
        .from("meetings")
        .select("id, scheduled_at, lead_id, lead:leads(contact:contacts(name))")
        .eq("id", v.meeting_id)
        .single(),
    );
    const when = new Date(m.scheduled_at).toLocaleString("en-US", {
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      timeZone: s.timezone,
    });
    const first = (m.lead?.contact?.name ?? "").split(" ")[0];
    // 9:00 AM ET today, or right away if that's already passed (and it isn't quiet hours).
    const nine = localToUtc(todayIn(s.timezone), "09:00", s.timezone);
    const at = nextSendTime(nine > new Date() ? nine : new Date(), s.rules, s.timezone);
    if (m.lead_id) {
      ok(
        await s.db.from("scheduled_messages").insert({
          company_id: s.companyId,
          lead_id: m.lead_id,
          channel: "sms",
          body: `Hi ${first}, this is RenoDesign confirming your in-home visit ${when}. Reply YES to confirm or call us to reschedule.`,
          send_at: at.toISOString(),
          created_by: s.userId,
        }),
      );
    }
    ok(
      await s.db
        .from("meetings")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("id", v.meeting_id),
    );
    revalidatePath("/command");
    return { ok: true, message: "Confirmation queued" };
  });
}
