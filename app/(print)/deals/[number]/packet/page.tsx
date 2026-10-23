import { notFound } from "next/navigation";
import { PrintButton } from "@/components/public/print-button";
import { requireOwner } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { scopeInfo, sourceLabel, timelineLabel } from "@/lib/deals/display";
import { formatBudget, formatCents } from "@/lib/money";
import { signedUrls } from "@/lib/storage";
import { maybe } from "@/server/action-utils";
import { getDealByNumber, getDealFiles } from "@/server/queries/deals";
import { listQuotes } from "@/server/queries/estimates";

export const metadata = { title: "Hand-off packet" };

/** The hand-off packet as one printable page: customer, scope, budget, notes, measurements, estimate, photos. */
export default async function Packet({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const s = await requireOwner();
  const deal = await getDealByNumber(s, number);
  if (!deal) notFound();
  const [files, quotes, visit] = await Promise.all([
    getDealFiles(s, deal.id),
    listQuotes(s, deal.id),
    s.db
      .from("site_visits")
      .select("walls, ceiling_in, appliances, notes, ballpark_low_cents, ballpark_high_cents, visited_at")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(maybe),
  ]);
  const photos = files.filter((f) => f.folder === "photos" && f.mime_type.startsWith("image/"));
  const urls = await signedUrls(photos.map((f) => f.storage_path), s.companyId);
  const quote = quotes.find((q) => q.doc_number) ?? quotes[0];
  const sections = quote
    ? ((await s.db.from("quote_section_totals").select("name, price_cents, sort_order").eq("quote_id", quote.id).order("sort_order")).data ?? [])
    : [];
  const c = deal.contact;
  const walls = (visit?.walls ?? []) as { name: string; ft: number }[];
  const apps = (visit?.appliances ?? []) as { kind: string; model: string; reuse: boolean }[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6 text-[13px] leading-relaxed print:p-0">
      <header className="flex items-start justify-between border-b pb-3">
        <div>
          <p className="text-xs font-semibold tracking-wide uppercase">Hand-off packet</p>
          <h1 className="text-2xl font-bold">
            #{deal.deal_number} {c?.name ?? ""} · {scopeInfo(deal.scope)?.label ?? "Kitchen"}
          </h1>
          <p>
            {[c?.address, c?.city, c?.zip].filter(Boolean).join(", ")} · {c?.phone ?? ""} {c?.email ? `· ${c.email}` : ""}
          </p>
        </div>
        <p className="text-right text-xs">
          From {s.name}
          <br />
          {formatDateTime(new Date(), s.timezone)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1">
        <p>
          <b>Source:</b> {sourceLabel(deal.source)}
        </p>
        <p>
          <b>Timeline:</b> {timelineLabel(deal.timeline) ?? "—"}
        </p>
        <p>
          <b>Budget:</b> {formatBudget(deal.budget_min_cents, deal.budget_max_cents)}
        </p>
        <p>
          <b>Decision maker:</b> {deal.decision_maker ?? "—"}
        </p>
        <p>
          <b>Owns the home:</b> {deal.owns_home === null ? "—" : deal.owns_home ? "yes" : "no (renter)"}
        </p>
        <p>
          <b>Year built:</b> {deal.year_built ?? "—"}
          {deal.year_built && deal.year_built < 1978 ? " — pre-1978, lead-safe rules" : ""}
        </p>
      </section>

      {deal.notes ? (
        <section>
          <h2 className="font-bold">Notes</h2>
          <p className="whitespace-pre-wrap">{deal.notes}</p>
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="font-bold">Measurements</h2>
          {walls.length ? (
            <ul>
              {walls.map((w) => (
                <li key={w.name}>
                  Wall {w.name}: {w.ft} ft
                </li>
              ))}
              {visit?.ceiling_in ? <li>Ceiling: {visit.ceiling_in} in</li> : null}
            </ul>
          ) : (
            <p>See sketch photos.</p>
          )}
          {visit?.notes ? <p className="mt-1 whitespace-pre-wrap">{visit.notes}</p> : null}
        </div>
        <div>
          <h2 className="font-bold">Appliances</h2>
          {apps.length ? (
            <ul>
              {apps.map((a, i) => (
                <li key={i}>
                  {a.kind}: {a.reuse ? "reuse existing" : a.model || "new, model TBD"}
                </li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </div>
      </section>

      {quote ? (
        <section>
          <h2 className="font-bold">
            My estimate {quote.doc_number ?? `v${quote.version}`} (what the client saw)
          </h2>
          <table className="w-full">
            <tbody>
              {sections.map((x) => (
                <tr key={x.name} className="border-b">
                  <td className="py-0.5">{x.name}</td>
                  <td className="py-0.5 text-right tabular-nums">{formatCents(x.price_cents)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-1 font-bold">Total</td>
                <td className="py-1 text-right font-bold tabular-nums">{formatCents(quote.totals?.total_price_cents ?? 0)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ) : null}

      <section>
        <h2 className="font-bold">Photos ({photos.length})</h2>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((f) =>
            urls[f.storage_path] ? (
              <figure key={f.id} className="break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[f.storage_path]} alt={f.title ?? ""} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="text-[10px]">{f.photo_tag ?? ""}</figcaption>
              </figure>
            ) : null,
          )}
        </div>
      </section>
      <PrintButton />
    </main>
  );
}
