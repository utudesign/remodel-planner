import type { Session } from "@/lib/auth/require-role";
import { must, maybe } from "@/server/action-utils";

export async function listQuotes(s: Session, dealId: string) {
  const [quotes, totals] = await Promise.all([
    s.db
      .from("quotes")
      .select("id, version, name, status, doc_number, sent_at, created_at, client_token")
      .eq("deal_id", dealId)
      .order("version", { ascending: false })
      .then(must),
    s.db.from("quote_totals").select("quote_id, total_price_cents, gross_margin, line_count").eq("deal_id", dealId).then(must),
  ]);
  const t = new Map(totals.map((x) => [x.quote_id, x]));
  return quotes.map((q) => ({ ...q, totals: t.get(q.id) ?? null }));
}

export async function getTemplates(s: Session) {
  return must(
    await s.db
      .from("quote_templates")
      .select("id, name, description, default_takeoff")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("name"),
  );
}

export type QuoteLine = {
  id: string;
  section_id: string;
  category_id: string | null;
  catalog_item_id: string | null;
  code: string;
  name: string;
  qty: number;
  unit: string;
  unit_cost_cents: number;
  price_cents: number;
  ext_cost_cents: number;
  qty_source: string | null;
  pricing_mode: string;
  sort_order: number;
};

export async function getQuote(s: Session, quoteId: string) {
  const quote = maybe(
    await s.db
      .from("quotes")
      .select(
        "id, deal_id, version, name, status, doc_number, takeoff, collection_id, target_margin, contingency_rate, tax_rate, labor_rate_cents, client_token, sent_at, site_visit_id",
      )
      .eq("id", quoteId)
      .eq("company_id", s.companyId)
      .maybeSingle(),
  );
  if (!quote) return null;
  const [lines, sections, totals, sectionTotals, comparison, collections, quartz, settings] = await Promise.all([
    s.db
      .from("quote_line_items_priced")
      .select("id, section_id, category_id, catalog_item_id, code, name, qty, unit, unit_cost_cents, price_cents, ext_cost_cents, qty_source, pricing_mode, sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order")
      .then(must),
    s.db.from("quote_sections").select("id, name, sort_order").eq("company_id", s.companyId).order("sort_order").then(must),
    s.db.from("quote_totals").select("*").eq("quote_id", quoteId).single().then(must),
    s.db.from("quote_section_totals").select("section_id, name, client_description, sort_order, price_cents").eq("quote_id", quoteId).order("sort_order").then(must),
    s.db.from("quote_comparison_totals").select("*").eq("quote_id", quoteId).then(must),
    s.db.from("catalog_collections").select("id, name, colors, sort_order").eq("company_id", s.companyId).eq("active", true).order("sort_order").then(must),
    s.db
      .from("catalog_items")
      .select("id, code, name, unit_price_cents")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .like("code", "QZ%")
      .order("code")
      .then(must),
    s.db.from("estimating_settings").select("*").eq("company_id", s.companyId).maybeSingle().then(maybe),
  ]);
  return {
    quote,
    lines: lines as unknown as QuoteLine[],
    sections,
    totals,
    sectionTotals,
    comparison: comparison[0] ?? null,
    collections,
    quartz,
    settings,
  };
}

export async function searchCatalog(s: Session, q: string, collectionId: string | null) {
  const term = q.trim().replace(/[%,()]/g, " ").trim();
  if (term.length < 2) return [];
  let query = s.db
    .from("catalog_items")
    .select("id, code, name, unit, unit_cost_cents, unit_price_cents, pricing_mode, price_source, collection_id, category:catalog_categories(name)")
    .eq("company_id", s.companyId)
    .eq("active", true)
    .or(`code.ilike.${term}%,name.ilike.%${term}%`)
    .order("code")
    .limit(40);
  if (collectionId) query = query.or(`collection_id.is.null,collection_id.eq.${collectionId}`);
  else query = query.is("collection_id", null);
  return must(await query);
}
