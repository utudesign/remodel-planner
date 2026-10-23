"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_EDGE = 1600;

/** Resize on the phone before upload (spotty signal on site). Falls back to the original file. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Camera/photo picker that posts compressed images under `name` with the surrounding form. */
export function PhotoInput({
  name = "photos",
  label = "Photo",
  className,
}: {
  name?: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, 6);
    setBusy(true);
    const small = await Promise.all(files.map(compress));
    const dt = new DataTransfer();
    small.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews(small.map((f) => URL.createObjectURL(f)));
    setBusy(false);
  }

  function clear() {
    if (ref.current) ref.current.value = "";
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium">
        <Camera className="size-4" /> {busy ? "Preparing…" : label}
        <input
          ref={ref}
          type="file"
          name={name}
          accept="image/*"
          multiple
          className="sr-only"
          onChange={onChange}
        />
      </label>
      {previews.map((u) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={u} src={u} alt="" className="size-11 rounded-md object-cover" />
      ))}
      {previews.length ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Remove photos"
          className="text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
