import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { JobForm } from "@/components/handoff/handoff-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/auth/require-role";
import { FOLDER_LABELS } from "@/lib/deals/display";
import type { DealFolder } from "@/lib/deals/dealNumber";
import { formatCents } from "@/lib/money";
import { signedUrls } from "@/lib/storage";
import { maybe, must } from "@/server/action-utils";

export const metadata = { title: "Job" };

/** Partner's deal page: customer, hand-off files, measurements, job progress, commission. No estimates or notes. */
export default async function PartnerDeal({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const s = await getSession();
  const deal = maybe(
    await s.db
      .from("deals")
      .select(
        "id, deal_number, scope, year_built, job_status, sold_price_cents, change_orders_cents, deposit_received_at, paid_in_full_at, job_completed_at, partner_note, contact:contacts(name, phone, email, address, city, zip)",
      )
      .eq("deal_number", number)
      .not("handed_off_at", "is", null)
      .maybeSingle(),
  );
  if (!deal) notFound();
  const [files, visit, commission] = await Promise.all([
    s.db
      .from("deal_files")
      .select("id, folder, photo_tag, title, storage_path, mime_type")
      .eq("deal_id", deal.id)
      .is("deleted_at", null)
      .order("created_at")
      .then(must),
    s.db.from("site_visits").select("walls, ceiling_in, appliances, notes").eq("deal_id", deal.id).order("created_at", { ascending: false }).limit(1).maybeSingle().then(maybe),
    s.db.from("deal_commissions").select("plan_name, expected_cents, earned_cents, paid_cents, owed_cents").eq("deal_id", deal.id).maybeSingle().then(maybe),
  ]);
  const urls = await signedUrls(files.map((f) => f.storage_path), s.companyId);
  const photos = files.filter((f) => f.folder === "photos" && f.mime_type.startsWith("image/"));
  const docs = files.filter((f) => f.folder !== "photos");
  const c = deal.contact;
  const walls = (visit?.walls ?? []) as { name: string; ft: number }[];
  const apps = (visit?.appliances ?? []) as { kind: string; model: string; reuse: boolean }[];
  const address = [c?.address, c?.city, c?.zip].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <Link href="/p" className="-ml-1 flex h-11 items-center gap-0.5 text-[15px] font-medium text-primary">
        <ChevronLeft className="size-5" /> My jobs
      </Link>
      <div>
        <p className="text-xs font-bold text-muted-foreground">#{deal.deal_number}</p>
        <h1 className="text-2xl font-bold tracking-tight">{c?.name ?? "Customer"}</h1>
        <p className="text-sm text-muted-foreground">
          {address}
          {c?.phone ? ` · ` : ""}
          {c?.phone ? <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="text-primary underline">{c.phone}</a> : null}
        </p>
        {deal.year_built && deal.year_built < 1978 ? (
          <p className="mt-2 rounded-xl bg-warning/15 p-2 text-sm font-medium">Built {deal.year_built}: pre-1978, lead-safe rules apply.</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job progress</CardTitle>
        </CardHeader>
        <CardContent>
          <JobForm dealId={deal.id} v={deal} tz={s.timezone} />
        </CardContent>
      </Card>

      {walls.length || apps.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Measurements + appliances</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {walls.map((w) => (
              <p key={w.name}>
                Wall {w.name}: {w.ft} ft
              </p>
            ))}
            {visit?.ceiling_in ? <p>Ceiling: {visit.ceiling_in} in</p> : null}
            {apps.map((a, i) => (
              <p key={i}>
                {a.kind}: {a.reuse ? "reuse existing" : a.model || "new, model TBD"}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {photos.length ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Photos · {photos.length}</h2>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.map((f) =>
              urls[f.storage_path] ? (
                <a key={f.id} href={urls[f.storage_path]} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[f.storage_path]} alt={f.photo_tag ?? "photo"} loading="lazy" className="size-full object-cover" />
                </a>
              ) : null,
            )}
          </div>
        </section>
      ) : null}

      {docs.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {docs.map((f) => (
                <li key={f.id} className="flex min-h-11 items-center justify-between gap-2 border-b border-border/60 last:border-0">
                  <a href={urls[f.storage_path]} target="_blank" rel="noreferrer" className="truncate text-primary underline">
                    {f.title ?? "File"}
                  </a>
                  <span className="text-xs text-muted-foreground">{FOLDER_LABELS[f.folder as DealFolder] ?? f.folder}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {commission ? (
        <Card>
          <CardHeader>
            <CardTitle>Commission ({commission.plan_name})</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Expected {formatCents(commission.expected_cents)} · earned {formatCents(commission.earned_cents)} · paid{" "}
            {formatCents(commission.paid_cents)} · owed {formatCents(commission.owed_cents)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
