import { randomUUID } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Photos live in the private "files" bucket under <company_id>/… . The app checks access (RLS on the
 * row that references the path) before it ever hands out a signed URL, so Storage itself needs no policies.
 */
const BUCKET = "files";
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function uploadImages(
  files: File[],
  companyId: string,
  folder: string,
): Promise<string[]> {
  const real = files.filter((f) => f && f.size > 0);
  if (real.length > 6) throw new Error("Up to 6 photos at a time");
  const admin = createAdminSupabase();
  const paths: string[] = [];
  for (const f of real) {
    if (!TYPES.has(f.type)) throw new Error(`${f.name}: only photos can be attached`);
    if (f.size > MAX_BYTES) throw new Error(`${f.name} is too large (max 8 MB)`);
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    const path = `${companyId}/${folder}/${randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, f, { contentType: f.type, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

/** Signed URLs (1 hour) for paths the caller has already been allowed to read. */
export async function signedUrls(
  paths: string[],
  companyId: string,
): Promise<Record<string, string>> {
  const own = paths.filter((p) => p.startsWith(`${companyId}/`));
  if (own.length === 0) return {};
  const { data, error } = await createAdminSupabase()
    .storage.from(BUCKET)
    .createSignedUrls(own, 3600);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}
