/**
 * Which files go where (change request v3, item 8; database: 0017 deal_file_type_ok()).
 *   Photos tab → images (JPEG, PNG, WebP, HEIC)
 *   Files tab  → PDF and Word only (.pdf, .doc, .docx), type and extension must agree
 * An image picked on the Files tab is filed in Photos (it still counts for its checklist item).
 * Shared by the file pickers, the server actions and the tests, so the rules can't drift apart.
 */

export const PHOTO_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const DOC_MIME_BY_EXT = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** `accept` for the Files tab picker. */
export const DOC_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ...Object.values(DOC_MIME_BY_EXT),
].join(",");

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_DOC_BYTES = 25 * 1024 * 1024;

export type FileKind = "photo" | "doc" | "bad";

function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** iOS sometimes sends HEIC photos with an empty type; trust the extension for images only. */
const PHOTO_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

export function classifyFile(name: string, type: string): { kind: FileKind; mime: string } {
  const t = (type || "").toLowerCase();
  const e = ext(name);
  if ((PHOTO_MIME as readonly string[]).includes(t)) return { kind: "photo", mime: t };
  if (!t && PHOTO_EXT[e]) return { kind: "photo", mime: PHOTO_EXT[e] };
  const docMime = DOC_MIME_BY_EXT[e as keyof typeof DOC_MIME_BY_EXT];
  // Word files sometimes arrive as application/octet-stream; the extension then decides.
  if (docMime && (t === docMime || t === "" || t === "application/octet-stream")) return { kind: "doc", mime: docMime };
  return { kind: "bad", mime: t };
}

export const FILES_ONLY_MESSAGE = "Files take PDF or Word only (.pdf, .doc, .docx)";

/** Photo tag for an image filed from a non-photo checklist item (design = sketch, other = appliance label). */
export function tagForRequirementFolder(folder: string | null | undefined): string {
  if (folder === "design") return "sketch";
  if (folder === "other") return "appliance_label";
  return "other";
}
