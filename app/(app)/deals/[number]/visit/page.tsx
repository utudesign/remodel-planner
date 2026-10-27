import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PhotoCapture } from "@/components/photos/photo-capture";
import { VisitForm } from "@/components/visits/visit-form";
import { requireStaff } from "@/lib/auth/require-role";
import { addressForMaps } from "@/lib/address";
import { cn } from "@/lib/utils";
import { maybe } from "@/server/action-utils";
import { getChecklist, getDealByNumber, getDealFiles } from "@/server/queries/deals";

export const metadata = { title: "Site visit" };

/** What production needs from the visit: ticks itself from photo tags. */
const REQUIRED = [
  { tag: "before", label: "Every wall, ceiling and floor", min: 4 },
  { tag: "panel", label: "Electrical panel", min: 1 },
  { tag: "under_sink", label: "Under the sink", min: 1 },
  { tag: "appliance_label", label: "Appliance labels", min: 1 },
  { tag: "sketch", label: "Sketch with measurements", min: 1 },
] as const;

export default async function SiteVisitPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const s = await requireStaff();
  const deal = await getDealByNumber(s, number);
  if (!deal) notFound();
  const [files, checklist, visit] = await Promise.all([
    getDealFiles(s, deal.id),
    getChecklist(s, deal.id, "before_handoff"),
    s.db
      .from("site_visits")
      .select("walls, ceiling_in, appliances, notes, status, ballpark_low_cents, ballpark_high_cents")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(maybe),
  ]);
  const count = (tag: string) => files.filter((f) => f.folder === "photos" && f.photo_tag === tag).length;
  const photoReq = checklist.find((i) => i.folder === "photos")?.requirement_id ?? null;
  const sketchReq = checklist.find((i) => /measure/i.test(i.label))?.requirement_id ?? null;

  return (
    <div className="flex flex-col gap-5 pb-56">
      <div>
        <Link href={`/deals/${deal.deal_number}`} className="-ml-1 flex h-11 items-center gap-0.5 text-[15px] font-medium text-primary">
          <ChevronLeft className="size-5" /> #{deal.deal_number} {deal.contact?.name ?? ""}
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Site visit</h1>
        <p className="text-sm text-muted-foreground">{addressForMaps(deal.contact?.address, deal.contact?.city, deal.contact?.zip)}</p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
        <h2 className="font-semibold">Photos production needs</h2>
        <ul className="flex flex-col gap-3">
          {REQUIRED.map((r) => {
            const n = count(r.tag);
            const done = n >= r.min;
            return (
              <li key={r.tag} className="flex flex-col gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      done ? "bg-primary text-primary-foreground" : "ring-2 ring-input",
                    )}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="flex-1 text-[15px] font-medium">{r.label}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {n}
                    {r.min > 1 ? `/${r.min}` : ""}
                  </span>
                </div>
                <PhotoCapture
                  dealId={deal.id}
                  dealNumber={deal.deal_number}
                  defaultTag={r.tag}
                  tags={[r.tag]}
                  requirementId={r.tag === "sketch" ? sketchReq : photoReq}
                  compact
                />
              </li>
            );
          })}
        </ul>
      </section>

      <VisitForm
        dealId={deal.id}
        initial={{
          walls: ((visit?.walls ?? []) as { name: string; ft: number }[]) ?? [],
          ceiling_in: visit?.ceiling_in ?? null,
          appliances: ((visit?.appliances ?? []) as { kind: string; model: string; reuse: boolean }[]) ?? [],
          year_built: deal.year_built,
          notes: visit?.notes ?? "",
          low: visit?.ballpark_low_cents ?? null,
          high: visit?.ballpark_high_cents ?? null,
          done: visit?.status === "done",
        }}
      />
    </div>
  );
}
