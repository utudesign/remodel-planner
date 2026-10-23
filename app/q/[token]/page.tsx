import { notFound } from "next/navigation";
import { PrintButton } from "@/components/public/print-button";
import { formatCents } from "@/lib/money";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata = { title: "Your kitchen estimate" };

/**
 * Client view of an estimate: section totals only (never line prices, costs or a tax line).
 * Labeled as an estimate; the final price and contract come from the licensed partner.
 */
export default async function ClientEstimate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();
  const db = createAdminSupabase();
  const { data: q } = await db
    .from("quotes")
    .select("id, company_id, doc_number, sent_at, status, deal:deals(partner_id, scope, contact:contacts(name, address, city))")
    .eq("client_token", token)
    .maybeSingle();
  if (!q || !q.doc_number || q.status === "superseded") notFound();
  const [{ data: sections }, { data: totals }, { data: owner }, { data: partners }] = await Promise.all([
    db
      .from("quote_section_totals")
      .select("section_id, name, client_description, sort_order, price_cents")
      .eq("quote_id", q.id)
      .order("sort_order"),
    db.from("quote_totals").select("total_price_cents").eq("quote_id", q.id).single(),
    db
      .from("users")
      .select("name, phone, email")
      .eq("company_id", q.company_id)
      .eq("role", "owner")
      .eq("is_default_owner", true)
      .maybeSingle(),
    db.from("partners").select("id, name, license_number, license_class, phone").eq("company_id", q.company_id).eq("active", true).order("created_at"),
  ]);
  const partner = partners?.find((p) => p.id === q.deal?.partner_id) ?? partners?.[0] ?? null;
  const date = q.sent_at ? new Date(q.sent_at) : new Date();
  const valid = new Date(date.getTime() + 30 * 86400_000);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const c = q.deal?.contact;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-4 py-8 print:max-w-none print:px-0 print:py-0">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Estimate {q.doc_number}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Your kitchen estimate</h1>
        <p className="text-muted-foreground">
          {c?.name ? `${c.name} · ` : ""}
          {[c?.address, c?.city].filter(Boolean).join(", ")}
        </p>
        <p className="text-sm text-muted-foreground">
          {fmt(date)} · good until {fmt(valid)}
        </p>
      </header>

      <section className="flex flex-col rounded-2xl bg-card ring-1 ring-border print:ring-0">
        {(sections ?? []).map((s) => (
          <div key={s.section_id} className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-0">
            <div>
              <p className="font-semibold">{s.name}</p>
              {s.client_description ? <p className="text-sm text-muted-foreground">{s.client_description}</p> : null}
            </div>
            <p className="shrink-0 font-semibold tabular-nums">{formatCents(s.price_cents)}</p>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-b-2xl bg-foreground px-4 py-4 text-background print:bg-transparent print:text-foreground">
          <p className="font-semibold">Estimated total</p>
          <p className="text-2xl font-bold tabular-nums">{formatCents(totals?.total_price_cents ?? 0)}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-accent p-4 text-sm text-accent-foreground print:bg-transparent print:p-0">
        <p className="font-semibold">Estimate. Final price and contract from {partner?.name ?? "the contractor"}.</p>
        <p className="mt-1">
          {partner?.license_number
            ? `Licensed Virginia contractor, license ${partner.license_number}${partner.license_class ? ` (Class ${partner.license_class})` : ""}.`
            : "Contractor license number provided with the contract."}{" "}
          Payments are made to {partner?.name ?? "the contractor"} only, after the contract is signed. Includes materials, delivery,
          installation and clean-up as listed; taxes on materials are included in the prices above.
        </p>
      </section>

      {owner ? (
        <footer className="text-sm text-muted-foreground">
          Questions? {owner.name ?? ""}
          {owner.phone ? ` · ${owner.phone}` : ""}
          {owner.email ? ` · ${owner.email}` : ""}
        </footer>
      ) : null}
      <PrintButton />
    </main>
  );
}
