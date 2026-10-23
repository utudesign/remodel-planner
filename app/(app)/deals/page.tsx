import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { DealCard } from "@/components/deals/deal-card";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { requireOwner } from "@/lib/auth/require-role";
import { todayIn } from "@/lib/dates";
import { parseDealNumber } from "@/lib/deals/dealNumber";
import { defaultPlanFor, previewFor, type PlanRow } from "@/lib/deals/plans";
import { segmentOf, type Segment } from "@/lib/deals/segments";
import { cn } from "@/lib/utils";
import { getCommissions, getPartnersWithPlans, getStages, listDeals, type DealRow } from "@/server/queries/deals";

export const metadata = { title: "Deals" };

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "selling", label: "Selling" },
  { key: "partner", label: "With partner" },
  { key: "closed", label: "Closed" },
];

/** Search: 26-1047, #26-1047, 261047, 1047 (this year), 26-1047-E2, or name / phone / address. */
function matcher(q: string, currentYear: number) {
  const text = q.trim().toLowerCase();
  const n = parseDealNumber(q);
  const digits = text.replace(/\D/g, "");
  return (d: DealRow) => {
    if (!text) return true;
    if (n) {
      const year = n.year ?? currentYear;
      if (d.deal_year === year && Number(d.deal_number.slice(3)) === n.seq) return true;
    }
    const hay = `${d.contact?.name ?? ""} ${d.title ?? ""} ${d.contact?.address ?? ""} ${d.contact?.city ?? ""}`.toLowerCase();
    if (hay.includes(text)) return true;
    const phone = (d.contact?.phone ?? "").replace(/\D/g, "");
    return digits.length >= 4 && phone.includes(digits);
  };
}

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ seg?: string; q?: string }> }) {
  const { seg: segParam, q = "" } = await searchParams;
  const s = await requireOwner();
  const [stages, deals, commissions, partners] = await Promise.all([
    getStages(s),
    listDeals(s),
    getCommissions(s),
    getPartnersWithPlans(s),
  ]);
  const now = new Date();
  const year = Number(todayIn(s.timezone).slice(0, 4));
  const kind = new Map(stages.map((x) => [x.key, x.kind]));
  const plans = partners.flatMap((p) => (p.active ? (p.plans as PlanRow[]) : []));
  const match = matcher(q, year);

  const bySeg: Record<Segment, DealRow[]> = { selling: [], partner: [], closed: [] };
  for (const d of deals) {
    const c = commissions.get(d.id);
    const seg = segmentOf({
      stageKind: kind.get(d.stage),
      cancelled_at: d.cancelled_at,
      paid_in_full_at: d.paid_in_full_at,
      commissionStatus: c?.commission_status,
      owedCents: c?.owed_cents,
    });
    bySeg[seg].push(d);
  }
  // A search looks across every segment.
  const seg: Segment = q
    ? (SEGMENTS.find((x) => bySeg[x.key].some(match))?.key ?? "selling")
    : (SEGMENTS.find((x) => x.key === segParam)?.key ?? "selling");
  const shown = bySeg[seg].filter(match);

  const card = (d: DealRow) => (
    <DealCard
      key={d.id}
      deal={d}
      stageKind={kind.get(d.stage)}
      commission={commissions.get(d.id)}
      previewCents={previewFor(defaultPlanFor(plans, d.scope), d.estimated_value_cents)}
      now={now}
    />
  );

  return (
    <>
      <PageHeader
        title="Deals"
        actions={
          <Link
            href="/deals/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New deal
          </Link>
        }
      />

      <form className="mb-3" action="/deals" role="search">
        <input type="hidden" name="seg" value={seg} />
        <label className="relative block">
          <span className="sr-only">Search deals</span>
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            defaultValue={q}
            placeholder="26-1047, name, phone, address"
            className="h-11 w-full rounded-xl border-0 bg-card pr-3 pl-9 text-base ring-1 ring-border outline-none focus:ring-2 focus:ring-ring"
            inputMode="search"
            enterKeyHint="search"
          />
        </label>
      </form>

      <nav className="mb-4 grid grid-cols-3 rounded-xl bg-muted p-1 text-sm font-semibold sm:w-[28rem]">
        {SEGMENTS.map((x) => (
          <Link
            key={x.key}
            href={`/deals?seg=${x.key}`}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-lg text-muted-foreground",
              seg === x.key && "bg-card text-foreground shadow-sm",
            )}
          >
            {x.label}
            <span className="text-xs font-normal">{bySeg[x.key].length}</span>
          </Link>
        ))}
      </nav>

      {q ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {shown.length} match{shown.length === 1 ? "" : "es"} for “{q}” ·{" "}
          <Link href={`/deals?seg=${seg}`} className="text-primary underline">
            clear
          </Link>
        </p>
      ) : null}

      {shown.length === 0 ? (
        <EmptyState
          title={q ? "No deal matches" : seg === "selling" ? "No open deals" : seg === "partner" ? "Nothing with a partner" : "Nothing closed yet"}
          description={seg === "selling" && !q ? "Tap + → New deal, or paste a Facebook message." : undefined}
        />
      ) : seg === "selling" && !q ? (
        <div className="flex flex-col gap-5">
          {stages
            .filter((st) => st.kind === "open")
            .map((st) => {
              const items = shown.filter((d) => d.stage === st.key);
              if (!items.length) return null;
              return (
                <section key={st.key}>
                  <h2 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {st.label} <span>{items.length}</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div>
                </section>
              );
            })}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{shown.map(card)}</div>
      )}
    </>
  );
}
