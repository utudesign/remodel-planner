import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  ChoiceRow,
  CustomLineForm,
  LineRow,
  MeasureCard,
  ShareBar,
} from "@/components/estimates/builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/app-url";
import { defaultPlanFor, previewFor, type PlanRow } from "@/lib/deals/plans";
import type { TakeoffInputs } from "@/lib/estimating/takeoff";
import { formatCents, formatCentsWhole } from "@/lib/money";
import { formFromTakeoff } from "@/lib/quick-estimate";
import { getDealByNumber, getPartnersWithPlans } from "@/server/queries/deals";
import { getQuote } from "@/server/queries/estimates";
import { ItemSearch } from "@/components/estimates/item-search";

export const metadata = { title: "Quick estimate" };

export default async function QuoteBuilder({
  params,
}: {
  params: Promise<{ number: string; quoteId: string }>;
}) {
  const { number, quoteId } = await params;
  const s = await requireStaff();
  const [deal, data, partners] = await Promise.all([getDealByNumber(s, number), getQuote(s, quoteId), getPartnersWithPlans(s)]);
  if (!deal || !data || data.quote.deal_id !== deal.id) notFound();
  const { quote, lines, sections, totals, sectionTotals, comparison, collections, quartz } = data;
  const locked = ["approved", "superseded"].includes(quote.status);
  const plans = partners.flatMap((p) => (p.plans as PlanRow[]).filter((x) => x.active));
  const plan = plans.find((p) => p.id === deal.commission_plan_id) ?? defaultPlanFor(plans, deal.scope);
  const pays = previewFor(plan, totals.total_price_cents);
  const currentQuartz = lines.find((l) => l.code.startsWith("QZ"))?.catalog_item_id ?? null;
  const clientUrl = `${await appUrl()}/q/${quote.client_token}`;
  const margin = Number(totals.gross_margin);

  return (
    <div className="flex flex-col gap-4 pb-48">
      <div>
        <Link href={`/deals/${deal.deal_number}?tab=estimate`} className="-ml-1 flex h-11 items-center gap-0.5 text-[15px] font-medium text-primary">
          <ChevronLeft className="size-5" /> #{deal.deal_number} {deal.contact?.name ?? ""}
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Quick estimate</h1>
        <p className="text-sm text-muted-foreground">
          {quote.doc_number ?? `Draft v${quote.version}`} · {quote.status}
          {locked ? " · locked" : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Measure</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasureCard quoteId={quote.id} m={formFromTakeoff((quote.takeoff ?? {}) as Partial<TakeoffInputs>)} locked={locked} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. TimberPeak color group</CardTitle>
        </CardHeader>
        <CardContent>
          {collections.length ? (
            <ChoiceRow
              quoteId={quote.id}
              kind="color"
              current={quote.collection_id}
              locked={locked}
              options={collections.map((c, i) => ({ id: c.id, label: `G${i + 1}`, hint: c.colors.slice(0, 2).join("/") }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No vendor price list imported yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Quartz level</CardTitle>
        </CardHeader>
        <CardContent>
          <ChoiceRow
            quoteId={quote.id}
            kind="quartz"
            current={currentQuartz}
            locked={locked}
            options={quartz.map((z) => ({
              id: z.id,
              label: z.code.replace("QZ", "L"),
              hint: z.unit_price_cents ? `$${Math.round(z.unit_price_cents / 100)}/sf` : undefined,
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Items</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!locked ? <ItemSearch quoteId={quote.id} /> : null}

          {sections.map((sec) => {
            const items = lines.filter((l) => l.section_id === sec.id);
            if (!items.length) return null;
            const st = sectionTotals.find((x) => x.section_id === sec.id);
            return (
              <section key={sec.id}>
                <h3 className="flex justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {sec.name} <span className="tabular-nums">{st ? formatCentsWhole(st.price_cents) : ""}</span>
                </h3>
                <ul>
                  {items.map((l) => (
                    <LineRow key={`${l.id}-${l.qty}`} line={{ ...l, qty: Number(l.qty) }} locked={locked} />
                  ))}
                </ul>
              </section>
            );
          })}
          {!locked ? <CustomLineForm quoteId={quote.id} /> : null}
        </CardContent>
      </Card>

      {comparison ? (
        <Card>
          <CardHeader>
            <CardTitle>Buying the same materials at {comparison.source_name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="flex justify-between">
              <span>Materials ({comparison.covered_lines} items)</span>
              <span className="font-semibold tabular-nums">{formatCents(comparison.retailer_materials_cents)}</span>
            </p>
            <p className="text-muted-foreground">
              Not included there: countertops, installation, plumber, electrician, permit
              {comparison.uncovered_lines ? ` (${comparison.uncovered_lines} lines)` : ""}.
              {comparison.substitute_lines ? ` ${comparison.substitute_lines} items are the closest available substitute.` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Prices read from homedepot.com{comparison.oldest_price_date ? ` (oldest ${comparison.oldest_price_date})` : ""}. Never say “X% cheaper”.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 rounded-t-3xl bg-foreground px-5 pt-4 pb-4 text-background lg:bottom-0 lg:left-[232px]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-background/70">Client price · {Math.round(margin * 1000) / 10}% margin</p>
              <p className="text-[28px] leading-tight font-bold tabular-nums">{formatCents(totals.total_price_cents)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-background/70">This pays you</p>
              <p className="text-xl font-bold text-[#8fd3b0] tabular-nums">{pays !== null ? formatCents(pays) : "—"}</p>
            </div>
          </div>
          <ShareBar quoteId={quote.id} clientUrl={clientUrl} docNumber={quote.doc_number} locked={locked} />
        </div>
      </div>
    </div>
  );
}
