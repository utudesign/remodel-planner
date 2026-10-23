"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { datetimeLocalToUtc } from "@/lib/dates";
import type { DealFolder } from "@/lib/deals/dealNumber";
import { uploadDealFiles, type DealRef } from "@/lib/storage";
import {
  bookVisitSchema,
  contactSchema,
  dealFileSchema,
  followUpSchema,
  logActivitySchema,
  newDealSchema,
  qualifySchema,
  stageSchema,
} from "@/lib/validation/deal";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";

async function dealRef(s: Session, dealId: string): Promise<DealRef & { contact_id: string | null }> {
  return must(
    await s.db
      .from("deals")
      .select("id, company_id, deal_year, deal_number, contact_id")
      .eq("id", dealId)
      .eq("company_id", s.companyId)
      .single(),
  ) as DealRef & { contact_id: string | null };
}

function revalidateDeal(number?: string) {
  revalidatePath("/deals");
  revalidatePath("/today");
  if (number) revalidatePath(`/deals/${number}`);
}

/** New deal: contact + deal; the database assigns the number (26-1047) and the follow-up (+1 h). */
export async function createDeal(_: ActionState, fd: FormData): Promise<ActionState> {
  let number = "";
  const res = await run(async () => {
    const v = newDealSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const contact = must(
      await s.db
        .from("contacts")
        .insert({
          company_id: s.companyId,
          name: v.name || null,
          phone: v.phone,
          email: v.email ?? null,
          address: v.address,
          city: v.city,
        })
        .select("id")
        .single(),
    );
    const deal = must(
      await s.db
        .from("deals")
        .insert({
          company_id: s.companyId,
          contact_id: contact.id,
          source: v.source,
          scope: v.scope,
          notes: v.notes,
          estimated_value_cents: v.estimated_value,
          owner_id: s.userId,
          title: v.name ? `${v.name.split(/\s+/).pop()} ${v.scope === "cabinets_only" ? "cabinets" : (v.scope ?? "kitchen")}` : null,
        })
        .select("deal_number")
        .single(),
    );
    number = deal.deal_number ?? "";
    revalidateDeal();
  });
  if (res?.ok && number) redirect(`/deals/${number}?new=1`);
  return res;
}

export async function updateQualify(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = qualifySchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    ok(
      await s.db
        .from("deals")
        .update({
          scope: v.scope,
          timeline: v.timeline,
          budget_min_cents: v.budget_min,
          budget_max_cents: v.budget_max,
          decision_maker: v.decision_maker,
          owns_home: v.owns_home,
          year_built: v.year_built,
          knowledge_level: v.knowledge_level,
          estimated_value_cents: v.estimated_value,
          notes: v.notes,
        })
        .eq("id", d.id),
    );
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Saved" };
  });
}

export async function updateContact(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = contactSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    const patch = { name: v.name, phone: v.phone, email: v.email ?? null, address: v.address, city: v.city, zip: v.zip };
    if (d.contact_id) {
      ok(await s.db.from("contacts").update(patch).eq("id", d.contact_id));
    } else {
      const c = must(await s.db.from("contacts").insert({ ...patch, company_id: s.companyId }).select("id").single());
      ok(await s.db.from("deals").update({ contact_id: c.id }).eq("id", d.id));
    }
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Saved" };
  });
}

/** Move to a stage. The database requires a lost reason and resets the follow-up. */
export async function moveStage(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = stageSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    if (v.stage === "handed_off") throw new Error("Use the Hand off button: it checks the hand-off checklist first.");
    ok(await s.db.from("deals").update({ stage: v.stage, lost_reason: v.lost_reason }).eq("id", d.id));
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Stage updated" };
  });
}

/** Log a call/text/message/visit/note. The first reply out stamps first_response_at (database). */
export async function logActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = logActivitySchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    ok(
      await s.db.from("activities").insert({
        company_id: s.companyId,
        deal_id: d.id,
        type: v.type,
        direction: v.type === "note" ? null : (v.direction ?? "out"),
        summary: v.summary ?? "",
        created_by: s.userId,
      }),
    );
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Logged" };
  });
}

/** "I replied" one-tap from the auto-reply card (Copy / Text it). */
export async function markReplied(input: { deal_id: string; via: "text" | "fb_msg" }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ deal_id: z.uuid(), via: z.enum(["text", "fb_msg"]) }).parse(input);
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    ok(
      await s.db.from("activities").insert({
        company_id: s.companyId,
        deal_id: d.id,
        type: v.via,
        direction: "out",
        summary: "Sent the auto-reply with qualifying questions + booking link",
        created_by: s.userId,
      }),
    );
    revalidateDeal(d.deal_number);
  });
}

export async function setFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = followUpSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    const at = datetimeLocalToUtc(v.at, s.timezone);
    ok(await s.db.from("deals").update({ next_follow_up_at: at.toISOString() }).eq("id", d.id));
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Follow-up set" };
  });
}

export async function bookVisit(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = bookVisitSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    const start = datetimeLocalToUtc(v.starts_at, s.timezone);
    ok(
      await s.db.from("meetings").insert({
        company_id: s.companyId,
        deal_id: d.id,
        kind: "visit",
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + v.minutes * 60_000).toISOString(),
        booked_via: "manual",
        notes: v.notes,
      }),
    );
    const { data: cur } = await s.db.from("deals").select("stage").eq("id", d.id).single();
    if (cur && ["new", "qualified"].includes(cur.stage)) {
      ok(await s.db.from("deals").update({ stage: "visit_booked" }).eq("id", d.id));
    }
    revalidateDeal(d.deal_number);
    return { ok: true, message: "Visit booked" };
  });
}

export async function setMeetingStatus(input: { meeting_id: string; status: "done" | "canceled" }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ meeting_id: z.uuid(), status: z.enum(["done", "canceled"]) }).parse(input);
    const s = await requireRole("owner");
    const m = must(
      await s.db.from("meetings").update({ status: v.status }).eq("id", v.meeting_id).select("deal_id").single(),
    );
    if (v.status === "done") {
      const d = must(await s.db.from("deals").select("stage, deal_number").eq("id", m.deal_id).single());
      if (["new", "qualified", "visit_booked"].includes(d.stage)) {
        ok(await s.db.from("deals").update({ stage: "visit_done" }).eq("id", m.deal_id));
      }
      ok(
        await s.db.from("activities").insert({
          company_id: s.companyId,
          deal_id: m.deal_id,
          type: "visit",
          direction: "out",
          summary: "Site visit done",
          created_by: s.userId,
        }),
      );
      revalidateDeal(d.deal_number ?? undefined);
    } else {
      revalidateDeal();
    }
  });
}

/** Deals are never hard-deleted (numbers are never reused). */
export async function archiveDeal(input: { deal_id: string }): Promise<ActionState> {
  let done = false;
  const res = await run(async () => {
    const v = z.object({ deal_id: z.uuid() }).parse(input);
    const s = await requireRole("owner");
    const d = await dealRef(s, v.deal_id);
    ok(await s.db.from("deals").update({ deleted_at: new Date().toISOString() }).eq("id", d.id));
    revalidateDeal(d.deal_number);
    done = true;
  });
  if (done) redirect("/deals");
  return res;
}

/** Add photos/documents to the jacket (server upload; the offline queue uses signed uploads, Step 3). */
export async function addDealFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = dealFileSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Pick a file or take a photo first");
    const d = await dealRef(s, v.deal_id);
    await uploadDealFiles(s.db, d, files, {
      folder: v.folder as DealFolder,
      photoTag: v.folder === "photos" ? (v.photo_tag ?? null) : null,
      requirementId: v.requirement_id ?? null,
      title: v.title || null,
    });
    revalidateDeal(d.deal_number);
    return { ok: true, message: `${files.length} file${files.length === 1 ? "" : "s"} added` };
  });
}

/** Soft delete only: the record and the stored file stay. */
export async function removeDealFile(input: { file_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ file_id: z.uuid() }).parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from("deal_files").update({ deleted_at: new Date().toISOString() }).eq("id", v.file_id));
    revalidatePath("/deals", "layout");
  });
}
