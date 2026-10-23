import { PHOTO_TAG_LABEL } from "@/lib/deals/labels";
import { formatDateTime } from "@/lib/dates";

export type PhotoView = { id: string; url: string; tag: string | null; at: string; by: string | null };

/** Photos grouped by tag. Full-screen swipe viewer + date grouping are PROMPT-deals Step 3. */
export function PhotoGrid({ photos, tz }: { photos: PhotoView[]; tz: string }) {
  if (!photos.length) return <p className="text-sm text-muted-foreground">No photos yet.</p>;
  const tags = [...new Set(photos.map((p) => p.tag ?? "other"))];
  return (
    <div className="flex flex-col gap-4">
      {tags.map((t) => (
        <section key={t}>
          <h3 className="mb-1.5 text-sm font-semibold">
            {PHOTO_TAG_LABEL[t] ?? t}{" "}
            <span className="text-xs font-normal text-muted-foreground">{photos.filter((p) => (p.tag ?? "other") === t).length}</span>
          </h3>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {photos
              .filter((p) => (p.tag ?? "other") === t)
              .map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={`${formatDateTime(p.at, tz)}${p.by ? ` · ${p.by}` : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                </a>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
