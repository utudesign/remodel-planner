"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Loader2, Paperclip } from "lucide-react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/shared/form";
import { NativeSelect } from "@/components/ui/native-select";
import { DEFAULT_PHOTO_CATEGORIES } from "@/lib/deals/display";
import { classifyFile, DOC_ACCEPT, FILES_ONLY_MESSAGE } from "@/lib/files/types";
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
  categories,
  defaultTag = "before",
  compact = false,
  allowPhotos,
}: {
  dealId: string;
  folder: string;
  requirementId?: string;
  label: string;
  showTag?: boolean;
  categories?: readonly { key: string; label: string }[];
  defaultTag?: string;
  compact?: boolean;
  /** Files tab: documents only. Checklist "Add": photos too (they're filed in Photos). Default: photos folder only. */
  allowPhotos?: boolean;
}) {
  const [state, action] = useActionState(addDealFiles, null);
  const form = useRef<HTMLFormElement>(null);
  const [preparing, setPreparing] = useState(false);
  const photo = folder === "photos";
  const photosOk = photo || !!allowPhotos;
  const [pickError, setPickError] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []).slice(0, 8);
    if (!files.length) return;
    // v3 item 8: check before uploading; the server and the database check again.
    const wrong = files.filter((f) => {
      const k = classifyFile(f.name, f.type).kind;
      return photo ? k !== "photo" : k === "bad" || (k === "photo" && !photosOk);
    });
    if (wrong.length) {
      setPickError(
        `${wrong.map((f) => f.name).join(", ")}: ${
          photo ? "only photos can go here" : photosOk ? FILES_ONLY_MESSAGE + " or photos" : FILES_ONLY_MESSAGE + ". Photos go on the Photos tab"
        }`,
      );
      input.value = "";
      return;
    }
    setPickError(null);
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
            {(categories ?? DEFAULT_PHOTO_CATEGORIES).map((t) => (
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
            accept={photo ? "image/*" : photosOk ? `image/*,${DOC_ACCEPT}` : DOC_ACCEPT}
            {...(photo ? { capture: "environment" as const } : {})}
            className="sr-only"
            onChange={onChange}
          />
        </label>
        <Busy label={label} />
      </div>
      {pickError ? <p className="text-sm text-destructive">{pickError}</p> : <FormMessage state={state} />}
    </form>
  );
}
