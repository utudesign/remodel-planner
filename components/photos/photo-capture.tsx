"use client";

import { useState } from "react";
import { Camera, Images, Loader2 } from "lucide-react";
import { exifDateTime } from "@/lib/exif";
import { exifToIso, preparePhoto, queue } from "@/lib/photo-queue";
import { PHOTO_TAGS } from "@/lib/deals/display";
import { cn } from "@/lib/utils";
import { QUEUE_EVENT } from "@/components/photos/photo-queue-runner";

/**
 * Camera + library picker with tag chips. Photos are resized on the phone, saved to the
 * offline queue first, then uploaded in the background (they survive no signal and app restarts).
 */
export function PhotoCapture({
  dealId,
  dealNumber,
  defaultTag = "before",
  requirementId = null,
  tags = PHOTO_TAGS.map((t) => t.key),
  compact = false,
}: {
  dealId: string;
  dealNumber: string;
  defaultTag?: string;
  requirementId?: string | null;
  tags?: readonly string[];
  compact?: boolean;
}) {
  const [tag, setTag] = useState(defaultTag);
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState(0);

  async function add(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setBusy(list.length);
    for (const f of list) {
      const taken = exifToIso(exifDateTime(await f.slice(0, 256 * 1024).arrayBuffer()));
      const p = await preparePhoto(f);
      await queue.put({
        id: crypto.randomUUID(),
        dealId,
        dealNumber,
        folder: "photos",
        tag,
        requirementId,
        name: `${tag}-${(f.name || "photo").replace(/\.\w+$/, "")}.jpg`,
        mime: p.mime,
        size: p.blob.size,
        blob: p.blob,
        takenAt: taken,
        width: p.width,
        height: p.height,
        path: null,
        url: null,
        ticketAt: null,
        uploaded: false,
        attempts: 0,
        error: null,
        createdAt: Date.now(),
      });
      setBusy((n) => n - 1);
      setSaved((n) => n + 1);
    }
    window.dispatchEvent(new Event(QUEUE_EVENT));
    window.dispatchEvent(new Event("photo-queue:kick"));
  }

  const shown = PHOTO_TAGS.filter((t) => tags.includes(t.key));
  return (
    <div className="flex flex-col gap-2.5">
      {shown.length > 1 ? (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Photo tag">
          {shown.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={tag === t.key}
              onClick={() => setTag(t.key)}
              className={cn(
                "h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold",
                tag === t.key ? "bg-foreground text-background" : "bg-card ring-1 ring-border",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-2")}>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground">
          <Camera className="size-5" /> Camera
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { const input = e.currentTarget; void add(input.files).then(() => { input.value = ""; }); }} />
        </label>
        <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary font-semibold">
          <Images className="size-5" /> Library
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { const input = e.currentTarget; void add(input.files).then(() => { input.value = ""; }); }} />
        </label>
      </div>
      {busy > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Saving {busy}…
        </p>
      ) : saved ? (
        <p className="text-sm text-muted-foreground">
          {saved} saved on this phone. They upload by themselves, even after signal drops.
        </p>
      ) : null}
    </div>
  );
}
