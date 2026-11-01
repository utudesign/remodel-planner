"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { retagPhoto } from "@/server/actions/photos";

export type GalleryPhoto = { id: string; tag: string; title: string | null; thumb: string | null; full: string | null; takenAt: string | null };

/**
 * Photos tab (v3 D): filter chips with counts, grid of 400 px thumbnails, tap → viewer with the full photo,
 * swipe-style prev/next and a category picker to re-tag.
 */
export function PhotoGallery({
  photos,
  categories,
  dealNumber,
}: {
  photos: GalleryPhoto[];
  categories: { key: string; label: string }[];
  dealNumber: string;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const label = new Map(categories.map((c) => [c.key, c.label]));
  const counts = new Map<string, number>();
  for (const p of photos) counts.set(p.tag, (counts.get(p.tag) ?? 0) + 1);
  const chips = [
    ...categories.filter((c) => counts.get(c.key)),
    // a photo whose category was turned off still shows up under its old name
    ...[...counts.keys()].filter((k) => !label.has(k)).map((k) => ({ key: k, label: k })),
  ];
  const shown = filter ? photos.filter((p) => p.tag === filter) : photos;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter photos">
        <Chip active={!filter} onClick={() => setFilter(null)} label="All" count={photos.length} />
        {chips.map((c) => (
          <Chip key={c.key} active={filter === c.key} onClick={() => setFilter(filter === c.key ? null : c.key)} label={c.label} count={counts.get(c.key) ?? 0} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {shown.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(i)}
            className="relative aspect-square overflow-hidden rounded-lg bg-muted"
            aria-label={`${label.get(p.tag) ?? p.tag} photo${p.title ? `: ${p.title}` : ""}`}
          >
            {p.thumb || p.full ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb ?? p.full ?? ""} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              <span className="p-1 text-[10px] text-muted-foreground">{p.title ?? "photo"}</span>
            )}
            {!filter ? (
              <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{label.get(p.tag) ?? p.tag}</span>
            ) : null}
          </button>
        ))}
      </div>
      {open !== null && shown[open] ? (
        <Viewer
          photo={shown[open]}
          categories={categories}
          dealNumber={dealNumber}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < shown.length - 1 ? () => setOpen(open + 1) : undefined}
          position={`${open + 1} / ${shown.length}`}
        />
      ) : null}
    </div>
  );
}

function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold", active ? "bg-foreground text-background" : "bg-card ring-1 ring-border")}
    >
      {label}
      <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{count}</span>
    </button>
  );
}

function Viewer({
  photo,
  categories,
  dealNumber,
  onClose,
  onPrev,
  onNext,
  position,
}: {
  photo: GalleryPhoto;
  categories: { key: string; label: string }[];
  dealNumber: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  position: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between gap-2 px-2 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center">
          <X className="size-6" />
        </button>
        <span className="text-sm tabular-nums opacity-80">{position}</span>
        {photo.full ? (
          <a href={photo.full} target="_blank" rel="noreferrer" aria-label="Open full size" className="flex size-11 items-center justify-center">
            <ExternalLink className="size-5" />
          </a>
        ) : (
          <span className="size-11" />
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {photo.full || photo.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.full ?? photo.thumb ?? ""} alt={photo.title ?? ""} className="max-h-full max-w-full object-contain" />
        ) : null}
        {onPrev ? (
          <button type="button" onClick={onPrev} aria-label="Previous" className="absolute top-1/2 left-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40">
            <ChevronLeft className="size-6" />
          </button>
        ) : null}
        {onNext ? (
          <button type="button" onClick={onNext} aria-label="Next" className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40">
            <ChevronRight className="size-6" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),12px)]">
        {photo.title ? <p className="truncate text-sm opacity-80">{photo.title}</p> : null}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Category">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={photo.tag === c.key}
              disabled={pending}
              onClick={() =>
                c.key !== photo.tag &&
                start(async () => {
                  setError(null);
                  const r = await retagPhoto({ id: photo.id, tag: c.key, number: dealNumber });
                  if (!r.ok) setError(r.error ?? "Couldn't change it");
                  router.refresh();
                })
              }
              className={cn("h-9 shrink-0 rounded-full px-3.5 text-sm font-semibold", photo.tag === c.key ? "bg-white text-black" : "bg-white/15")}
            >
              {c.label}
            </button>
          ))}
          {pending ? <Loader2 className="size-5 shrink-0 animate-spin self-center" /> : null}
        </div>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
