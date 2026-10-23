"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Loader2, Paperclip } from "lucide-react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/shared/form";
import { NativeSelect } from "@/components/ui/native-select";
import { PHOTO_TAGS } from "@/lib/deals/display";
import { cn } from "@/lib/utils";
import { addDealFiles } from "@/server/actions/deals";

const MAX_EDGE = 2560;

/** Resize to 2560 px JPEG on the phone (DEALS §4) so uploads fit on weak signal. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function Busy({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return pending ? (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Uploading…
    </span>
  ) : (
    <span className="sr-only">{label}</span>
  );
}

/** Camera / file picker that uploads as soon as files are chosen. */
export function UploadButton({
  dealId,
  folder,
  requirementId,
  label,
  showTag = false,
  defaultTag = "before",
  compact = false,
}: {
  dealId: string;
  folder: string;
  requirementId?: string;
  label: string;
  showTag?: boolean;
  defaultTag?: string;
  compact?: boolean;
}) {
  const [state, action] = useActionState(addDealFiles, null);
  const form = useRef<HTMLFormElement>(null);
  const [preparing, setPreparing] = useState(false);
  const photo = folder === "photos";

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, 8);
    if (!files.length) return;
    setPreparing(true);
    const small = await Promise.all(files.map(compress));
    const dt = new DataTransfer();
    small.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    setPreparing(false);
    form.current?.requestSubmit();
  }

  const Icon = photo ? Camera : Paperclip;
  return (
    <form ref={form} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="folder" value={folder} />
      {requirementId ? <input type="hidden" name="requirement_id" value={requirementId} /> : null}
      <div className="flex flex-wrap items-center gap-2">
        {showTag ? (
          <NativeSelect name="photo_tag" defaultValue={defaultTag} aria-label="Photo tag" className="w-auto">
            {PHOTO_TAGS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        ) : photo ? (
          <input type="hidden" name="photo_tag" value={defaultTag} />
        ) : null}
        <label
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold",
            compact ? "h-10 bg-accent px-3.5 text-sm text-accent-foreground" : "h-11 bg-primary px-4 text-sm text-primary-foreground",
          )}
        >
          <Icon className="size-4" /> {preparing ? "Preparing…" : label}
          <input
            type="file"
            name="files"
            multiple
            accept={photo ? "image/*" : "image/*,application/pdf,.doc,.docx,.xls,.xlsx"}
            {...(photo ? { capture: "environment" as const } : {})}
            className="sr-only"
            onChange={onChange}
          />
        </label>
        <Busy label={label} />
      </div>
      <FormMessage state={state} />
    </form>
  );
}
