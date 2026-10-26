"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { DEAL_FOLDERS, dealStoragePath, type DealFolder } from "@/lib/deals/dealNumber";
import { PHOTO_TAG_KEYS } from "@/lib/deals/display";
import { BUCKET } from "@/lib/storage";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { must, maybe } from "@/server/action-utils";

/**
 * Offline-safe photo uploads (DEALS §4). The phone keeps each photo in IndexedDB until
 * confirmUpload() has created its deal_files row:
 *   1. ticket  → a signed upload URL for {company}/{year}/{deal}/{folder}/{uuid}-{name}
 *   2. PUT the bytes straight to Supabase Storage (no 4.5 MB server limit)
 *   3. confirm → insert the deal_files row as the signed-in user (RLS + path trigger check it)
 * Every step is safe to retry.
 */

const ticketSchema = z.object({
  deal_id: z.uuid(),
  folder: z.enum(DEAL_FOLDERS),
  file_name: z.string().min(1).max(160),
  mime: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]),
  size: z.number().int().positive().max(25 * 1024 * 1024),
});

export type UploadTicket = { ok: true; path: string; url: string } | { ok: false; error: string };

export async function createUploadTicket(input: z.input<typeof ticketSchema>): Promise<UploadTicket> {
  try {
    const v = ticketSchema.parse(input);
    const s = await requireRole("owner", "partner");
    const deal = must(
      await s.db
        .from("deals")
        .select("id, company_id, deal_year, deal_number")
        .eq("id", v.deal_id)
        .eq("company_id", s.companyId)
        .single(),
    );
    const path = dealStoragePath(deal.company_id, deal.deal_year!, deal.deal_number!, v.folder as DealFolder, v.file_name);
    const { data, error } = await createAdminSupabase().storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload" };
    return { ok: true, path, url: data.signedUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start the upload" };
  }
}

const confirmSchema = z.object({
  deal_id: z.uuid(),
  folder: z.enum(DEAL_FOLDERS),
  path: z.string().min(10).max(400),
  mime: z.string().max(80),
  size: z.number().int().positive(),
  title: z.string().max(160).nullable().optional(),
  photo_tag: z.enum(PHOTO_TAG_KEYS).nullable().optional(),
  requirement_id: z.uuid().nullable().optional(),
  taken_at: z.string().max(40).nullable().optional(),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  number: z.string().max(20).optional(),
});

export async function confirmUpload(input: z.input<typeof confirmSchema>): Promise<{ ok: boolean; error?: string }> {
  try {
    const v = confirmSchema.parse(input);
    const s = await requireRole("owner", "partner");
    // Already confirmed on an earlier try (the phone lost signal before hearing back)?
    const existing = maybe(await s.db.from("deal_files").select("id").eq("storage_path", v.path).maybeSingle());
    if (!existing) {
      // The bytes must really be there before the row says so.
      const dir = v.path.split("/").slice(0, -1).join("/");
      const name = v.path.split("/").pop()!;
      const { data: found } = await createAdminSupabase().storage.from(BUCKET).list(dir, { search: name, limit: 1 });
      if (!found?.length) return { ok: false, error: "The photo didn't reach storage yet" };
      const { error } = await s.db.from("deal_files").insert({
        company_id: s.companyId,
        deal_id: v.deal_id,
        folder: v.folder,
        photo_tag: v.folder === "photos" ? (v.photo_tag ?? null) : null,
        title: v.title ?? null,
        storage_path: v.path,
        mime_type: v.mime,
        size_bytes: v.size,
        requirement_id: v.requirement_id ?? null,
        taken_at: v.taken_at ?? null,
        width: v.width ?? null,
        height: v.height ?? null,
      });
      if (error && !/duplicate key/.test(error.message)) return { ok: false, error: error.message };
    }
    if (v.number) revalidatePath(`/deals/${v.number}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the photo" };
  }
}
