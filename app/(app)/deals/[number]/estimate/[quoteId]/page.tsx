import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CustomLineForm, LineRow, ShareBar } from "@/components/estimates/builder";
import {
  AccessoryList,
  BrandColorPicker,
  BulkAdd,
  CountertopStep,
  SpecialWorkForm,
  StepTotal,
  SuggestionChips,
} from "@/components/estimates/steps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/require-role";
import { appUrl } from "@/lib/app-url";
import { formatCents } from "@/lib/money";
import { getDealByNumber } from "@/server/queries/deals";
import { getBuilderData, type BuilderLine } from "@/server/queries/estimate-builder";
import { EstimateActions } from "@/components/estimates/estimate-actions";
import { ItemSearch } from "@/components/estimates/item-search";

export const metadata = { title: "Estimate" };

export default async function QuoteBuilder({
  params,
}: {
  params: Promise<{ number: string; quoteId: string }>;
}) {
  const { number, quoteId } = await params;
  const s = await requireStaff();
  const [deal, data] = await Promise.all([getDealByNumber(s, number), getBuilderData(s, quoteId)]);
  if (!deal || !data || data.quote.deal_id !== deal.id) notFound();
  const { quote, sections, totals, comparison, steps } = data;
  const locked = ["approved", "superseded"].includes(quote.status) || !!quote.archived_at;
  const sum = (ls: BuilderLine[]) => ls.reduce((n, l) => n + l.price_cents, 0);
  const sectionName = new Map(sections.map((x) => [x.id, x.name]));
  const isNew = Object.values(steps).every((ls) => ls.length === 0);
  // Items with their own control (accessory list, countertop extras, sink) aren't listed again.
  const managed = new Set(
    [
      ...data.accessories.map((a) => a.item?.id),
      ...data.countertop.extras.map((x) => x.id),
      ...data.countertop.sinkItems.map((x) => x.id),
    ].filter((x): x is string => !!x),
  );
  const own = (ls: BuilderLine[]) => ls.filter((l) => !l.catalog_item_id || !managed.has(l.catalog_item_id));
  const all = Object.values(steps).flat();
  const linesOf = (ids: (string | undefined)[]) => all.filter((l) => l.catalog_item_id && ids.includes(l.catalog_item_id));
  const accessoryLines = linesOf(data.accessories.map((a) => a.item?.id));
  const counterExtraLines = linesOf([...data.countertop.extras, ...data.countertop.sinkItems].map((x) => x.id));
  // Step totals follow where an item is shown (LED tape is an accessory, the sink is part of the countertop).
  const totals3 = sum(own(steps.cabinets)) + sum(accessoryLines);
  const totals5 = sum(own(steps.countertop)) + sum(counterExtraLines);
  const clientUrl = `${await appUrl()}/q/${quote.client_token}`;
  const margin = Number(totals.gross_margin);
  const profit = Math.round(Number(totals.total_price_cents) * margin);

  return (
    <div className="flex flex-col gap-4 pb-48">
      <div>
        <Link href={`/deals/${deal.deal_number}?tab=estimate`} className="-ml-1 flex h-11 items-center gap-0.5 text-[15px] font-medium text-primary">
          <ChevronLeft className="size-5" /> #{deal.deal_number} {deal.contact?.name ?? ""}
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">Estimate</h1>
            <p className="text-sm text-muted-foreground">
              {quote.doc_number ?? `Draft v${quote.version}`} · {quote.status}
              {locked ? " · locked" : ""}
              {quote.archived_at ? " · archived" : ""}
            </p>
          </div>
          <EstimateActions
            quoteId={quote.id}
            label={quote.doc_number ?? `Draft v${quote.version}`}
            record={!!(quote.sent_at || quote.doc_number || quote.status !== "draft" || deal.sold_at || deal.handed_off_at)}
            archived={!!quote.archived_at}
            redirectTo={`/deals/${deal.deal_number}?tab=estimate`}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brand + color</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandColorPicker
            quoteId={quote.id}
            brands={data.brands}
            brand={data.brand}
            colors={data.colors}
            colorCode={quote.color_code}
            collectionId={quote.collection_id}
            locked={locked}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>3. Cabinets</CardTitle>
          <StepTotal cents={totals3} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!locked ? <BulkAdd key={quote.collection_id ?? "none"} quoteId={quote.id} groups={data.groups} disabled={!quote.collection_id} /> : null}
          {!quote.collection_id && !locked ? (
            <p className="text-sm text-muted-foreground">Pick the brand and color first: cabinet prices come from that color.</p>
          ) : null}
          <Lines lines={own(steps.cabinets)} locked={locked} empty="No cabinets yet." />
          <div>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Accessories</h3>
            <AccessoryList quoteId={quote.id} rows={data.accessories} locked={locked} />
          </div>
          {!locked ? (
            <details className="rounded-xl bg-secondary/60 p-3">
              <summary className="flex h-11 cursor-pointer items-center text-sm font-semibold">Add item (any code, or a custom item)</summary>
              <div className="mt-2 flex flex-col gap-4">
                <ItemSearch quoteId={quote.id} />
                <CustomLineForm quoteId={quote.id} />
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>4. Labor</CardTitle>
          <StepTotal cents={sum(steps.labor)} />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Lines lines={steps.labor} locked={locked} empty="No labor yet." />
          <SuggestionChips
            quoteId={quote.id}
            locked={locked}
            items={data.laborItems.filter((i) => i.qty === 0).map((i) => ({ id: i.id, label: `${i.name} (${i.unit})` }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>5. Countertop</CardTitle>
          <StepTotal cents={totals5} />
        </CardHeader>
        <CardContent>
          <CountertopStep
            key={`${data.countertop.line?.id ?? "none"}:${data.countertop.line?.sqft ?? 0}:${data.countertop.line?.item_id ?? ""}:${data.countertop.line?.note ?? ""}`}
            quoteId={quote.id}
            levels={data.countertop.levels}
            extras={data.countertop.extras}
            sinkItems={data.countertop.sinkItems}
            line={data.countertop.line}
            locked={locked}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>6. Special work</CardTitle>
          <StepTotal cents={sum(steps.special)} />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Lines lines={steps.special} locked={locked} empty="Electrical, gas, plumbing, flooring or other work, each with its price." />
          {!locked ? <SpecialWorkForm quoteId={quote.id} types={data.specialTypes} /> : null}
        </CardContent>
      </Card>

      {own(steps.other).length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Other items</CardTitle>
            <StepTotal cents={sum(own(steps.other))} />
          </CardHeader>
          <CardContent>
            {[...new Set(own(steps.other).map((l) => l.section_id))].map((sid) => (
              <section key={sid}>
                <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{sectionName.get(sid) ?? ""}</h3>
                <Lines lines={own(steps.other).filter((l) => l.section_id === sid)} locked={locked} />
              </section>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {isNew && !locked ? (
        <p className="text-center text-xs text-muted-foreground">
          The client view shows section totals only, exactly as before.
        </p>
      ) : null}

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
              <p className="text-xs text-background/70">Gross profit</p>
              <p className="text-xl font-bold text-[#8fd3b0] tabular-nums">{formatCents(profit)}</p>
            </div>
          </div>
          <ShareBar quoteId={quote.id} clientUrl={clientUrl} docNumber={quote.doc_number} locked={locked} />
        </div>
      </div>
    </div>
  );
}

function Lines({ lines, locked, empty }: { lines: BuilderLine[]; locked: boolean; empty?: string }) {
  if (!lines.length) return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
  return (
    <ul>
      {lines.map((l) => (
        <LineRow key={`${l.id}-${l.qty}`} line={l} locked={locked} />
      ))}
    </ul>
  );
}
