"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { DEAL_FOLDERS, type DealFolder } from "@/lib/deals/dealNumber";
import { uploadDealFiles } from "@/lib/storage";
import { formToObject, ok, run, type ActionState } from "@/server/action-utils";
import { dealHref, dealRefFor } from "@/server/queries/deal-ref";

const PHOTO_TAGS = [
  "before", "measurement", "sketch", "appliance_label", "under_sink", "panel",
  "delivery", "progress", "issue", "after", "other",
] as const;

const schema = z.object({
  deal_id: z.uuid(),
  folder: z.enum(DEAL_FOLDERS),
  photo_tag: z.preprocess((v) => (v === "" ? null : v), z.enum(PHOTO_TAGS).nullable().optional()),
  requirement_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().optional()),
  title: z.string().trim().max(160).optional(),
});

/** Add photos/documents to a deal jacket (crew: photos on their own deals only — enforced by RLS). */
export async function addDealFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = schema.parse(formToObject(fd));
    const s = await requireRole("owner", "team", "crew");
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new Error("Pick a file or take a photo first");
    const deal = await dealRefFor(s, { dealId: v.deal_id });
    if (!deal) throw new Error("Deal not found");
    await uploadDealFiles(s.db, deal, files, {
      folder: v.folder as DealFolder,
      photoTag: v.folder === "photos" ? (v.photo_tag ?? null) : null,
      requirementId: v.requirement_id ?? null,
      title: v.title || null,
    });
    revalidatePath(dealHref(deal));
    return { ok: true, message: `${files.length} file${files.length === 1 ? "" : "s"} added` };
  });
}

/** Soft delete only (owners + team): the record and the stored file stay. */
export async function removeDealFile(input: { file_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ file_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team");
    ok(await s.db.from("deal_files").update({ deleted_at: new Date().toISOString() }).eq("id", v.file_id));
    revalidatePath("/deals", "layout");
  });
}
