"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDealFiles } from "@/server/actions/deal-files";

const MAX_EDGE = 2560;

/** Resize photos on the phone (DEALS.md §4: 2560px, JPEG ~0.82). Re-encoding also drops EXIF/GPS. */
async function prepare(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/**
 * One-tap upload into a deal folder (optionally satisfying a checklist requirement).
 * Phase 1: uploads immediately; the offline queue is PROMPT-deals Step 3.
 */
export function UploadButton({
  dealId,
  folder,
  photoTag,
  requirementId,
  label,
  camera,
  className,
}: {
  dealId: string;
  folder: string;
  photoTag?: string;
  requirementId?: string;
  label: string;
  camera?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    start(async () => {
      const fd = new FormData();
      fd.set("deal_id", dealId);
      fd.set("folder", folder);
      if (photoTag) fd.set("photo_tag", photoTag);
      if (requirementId) fd.set("requirement_id", requirementId);
      for (const f of await Promise.all(files.map(prepare))) fd.append("files", f);
      const r = await addDealFiles(null, fd);
      setMsg({ ok: !!r?.ok, text: r?.ok ? (r.message ?? "Added") : (r?.error ?? "Upload failed") });
      if (ref.current) ref.current.value = "";
    });
  }

  const Icon = camera ? Camera : Paperclip;
  return (
    <span className={cn("inline-flex flex-col gap-1", className)}>
      <label
        className={cn(
          "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border bg-card px-3 text-sm font-medium",
          pending && "pointer-events-none opacity-60",
        )}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
        {pending ? "Uploading…" : label}
        <input
          ref={ref}
          type="file"
          className="sr-only"
          multiple
          accept={folder === "photos" ? "image/*" : "image/*,application/pdf,.doc,.docx,.xls,.xlsx"}
          capture={camera ? "environment" : undefined}
          onChange={onChange}
        />
      </label>
      {msg ? <span className={msg.ok ? "text-xs text-success" : "text-xs text-destructive"}>{msg.text}</span> : null}
    </span>
  );
}
