import { createAdminSupabase } from "@/lib/supabase/admin";
import { dealStoragePath, type DealFolder } from "@/lib/deals/dealNumber";
import type { Db } from "@/lib/supabase/server";

/**
 * Deal files live in the private "deal-files" bucket at {company}/{year}/{deal number}/{folder}/{file}
 * (docs/DEALS.md). Phase 1 uploads go through a server action: the deal_files row is inserted with the
 * user's client first (RLS decides who may add what), then the bytes are stored. Signed client uploads +
 * the offline IndexedDB queue are PROMPT-deals Step 3.
 */
export const BUCKET = "deal-files";
const MAX_PHOTO = 12 * 1024 * 1024;
const MAX_FILE = 25 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const DOC_TYPES = new Set([
  ...PHOTO_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export type DealRef = { id: string; company_id: string; deal_year: number; deal_number: string };

export async function uploadDealFiles(
  db: Db,
  deal: DealRef,
  files: File[],
  opts: { folder: DealFolder; photoTag?: string | null; requirementId?: string | null; title?: string | null },
): Promise<string[]> {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length > 12) throw new Error("Up to 12 files at a time");
  const admin = createAdminSupabase();
  const paths: string[] = [];
  for (const f of real) {
    const photo = opts.folder === "photos";
    if (!(photo ? PHOTO_TYPES : DOC_TYPES).has(f.type)) {
      throw new Error(`${f.name}: ${photo ? "only photos" : "PDF, photo, Word or Excel files"} can go here`);
    }
    if (f.size > (photo ? MAX_PHOTO : MAX_FILE)) throw new Error(`${f.name} is too large`);
    const path = dealStoragePath(deal.company_id, deal.deal_year, deal.deal_number, opts.folder, f.name || "file");
    // Row first: RLS + triggers validate the path, folder and who's allowed (crew: photos on own deals).
    const { error: rowError } = await db.from("deal_files").insert({
      company_id: deal.company_id,
      deal_id: deal.id,
      folder: opts.folder,
      photo_tag: photo ? (opts.photoTag ?? null) : null,
      title: opts.title ?? f.name,
      storage_path: path,
      mime_type: f.type,
      size_bytes: f.size,
      requirement_id: opts.requirementId ?? null,
    });
    if (rowError) throw new Error(rowError.message);
    const { error } = await admin.storage.from(BUCKET).upload(path, f, { contentType: f.type, upsert: false });
    if (error) {
      await admin.from("deal_files").update({ deleted_at: new Date().toISOString() }).eq("storage_path", path);
      throw new Error(`Upload failed: ${error.message}`);
    }
    paths.push(path);
  }
  return paths;
}

/** Short-lived signed URLs for paths the caller has already been allowed to read (via RLS on deal_files). */
export async function signedUrls(paths: string[], companyId: string): Promise<Record<string, string>> {
  const own = paths.filter((p) => p.startsWith(`${companyId}/`));
  if (own.length === 0) return {};
  const { data, error } = await createAdminSupabase().storage.from(BUCKET).createSignedUrls(own, 3600);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
