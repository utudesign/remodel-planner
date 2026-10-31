import type { Session } from "@/lib/auth/require-role";
import { resolveAccessory, splitSteps, type StepKey } from "@/lib/estimating/builder-steps";
import { must } from "@/server/action-utils";
import { getQuote } from "@/server/queries/estimates";

/**
 * Everything the estimate builder shows (change request v3 items 9 + 10):
 * brands (price-list vendors) with their colors, the cabinet groups for bulk add, the accessory list
 * resolved for this estimate's brand, labor items, countertop items, special-work types, and the
 * saved lines split by step. Prices come from the database views (quote_line_items_priced, quote_totals).
 */
export async function getBuilderData(s: Session, quoteId: string) {
  const base = await getQuote(s, quoteId);
  if (!base) return null;
  const { quote } = base;

  const [lists, colors, collections, groups, accessories, specialTypes, categories, priced, generic] = await Promise.all([
    s.db.from("price_lists").select("id, vendor, name").eq("company_id", s.companyId).order("vendor").then(must),
    s.db
      .from("catalog_colors")
      .select("id, price_list_id, collection_id, code, name, line, swatch_url, sort_order")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("sort_order")
      .then(must),
    s.db.from("catalog_collections").select("id, price_list_id, name").eq("company_id", s.companyId).then(must),
    s.db
      .from("cabinet_groups")
      .select("key, label, sort_order")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("sort_order")
      .then(must),
    s.db
      .from("estimate_accessories")
      .select("id, key, label, vendor, code, item_name, sort_order, suggested")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("sort_order")
      .then(must),
    s.db
      .from("estimate_special_types")
      .select("key, label, sort_order")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("sort_order")
      .then(must),
    s.db.from("catalog_categories").select("id, name, cost_category").eq("company_id", s.companyId).then(must),
    s.db
      .from("quote_line_items_priced")
      .select("id, code, name, qty, unit, section_id, catalog_item_id, collection_id, cost_category, note, price_cents, sort_order")
      .eq("quote_id", quote.id)
      .order("sort_order")
      .then(must),
    // Generic (no color group) price-book items: labor, countertop, sink, lights …
    s.db
      .from("catalog_items")
      .select("id, code, name, unit, category_id, unit_cost_cents, unit_price_cents, pricing_mode, uses_labor_rate")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .is("collection_id", null)
      .order("name")
      .then(must),
  ]);

  // Brand = the vendor of the estimate's color group (TimberPeak, Skyline …).
  const listOf = new Map(collections.map((c) => [c.id, c.price_list_id]));
  const currentListId = quote.collection_id ? (listOf.get(quote.collection_id) ?? null) : null;
  const brandOfList = new Map(lists.map((l) => [l.id, l.vendor]));
  const brand = currentListId ? (brandOfList.get(currentListId) ?? null) : null;
  const brands = [...new Set(lists.filter((l) => colors.some((c) => c.price_list_id === l.id)).map((l) => l.vendor))];

  // Accessories for this brand: brand rows win over "every brand" rows with the same key.
  const forBrand = new Map<string, (typeof accessories)[number]>();
  for (const a of accessories) {
    if (a.vendor && a.vendor !== brand) continue;
    const cur = forBrand.get(a.key);
    if (!cur || (!cur.vendor && a.vendor)) forBrand.set(a.key, a);
  }
  const codes = [...new Set([...forBrand.values()].map((a) => a.code).filter((c): c is string => !!c))];
  const codeItems = codes.length
    ? must(
        await s.db
          .from("catalog_items")
          .select("id, code, name, unit, collection_id")
          .eq("company_id", s.companyId)
          .eq("active", true)
          .in("code", codes)
          .or(quote.collection_id ? `collection_id.is.null,collection_id.eq.${quote.collection_id}` : "collection_id.is.null"),
      )
    : [];
  const pool = [...codeItems, ...generic.map((g) => ({ id: g.id, code: g.code, name: g.name, unit: g.unit, collection_id: null }))];
  const qtyOf = (itemId: string) =>
    priced.filter((l) => l.catalog_item_id === itemId).reduce((n, l) => n + Number(l.qty ?? 0), 0);
  const accessoryRows = [...forBrand.values()]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => {
      const item = resolveAccessory(a, quote.collection_id, pool);
      return {
        id: a.id,
        key: a.key,
        label: a.label,
        suggested: a.suggested,
        item: item ? { id: item.id, code: item.code, name: item.name, unit: item.unit } : null,
        qty: item ? qtyOf(item.id) : 0,
      };
    });

  const catName = new Map(categories.map((c) => [c.id, c]));
  const laborItems = generic
    .filter((g) => catName.get(g.category_id)?.cost_category === "labor")
    .map((g) => ({ id: g.id, name: g.name, unit: g.unit, qty: qtyOf(g.id) }));
  const countertopSection = base.sections.find((x) => x.sort_order === 2)?.id ?? null;
  const cabinetrySection = base.sections.find((x) => x.sort_order === 1)?.id ?? null;
  const countertopCats = new Set(categories.filter((c) => c.name === "Countertop").map((c) => c.id));
  const counterItems = generic.filter((g) => countertopCats.has(g.category_id));
  const levels = counterItems
    .filter((g) => /sq\s*ft/i.test(g.unit))
    .map((g) => ({ id: g.id, code: g.code, name: g.name, price_cents: g.unit_price_cents }));
  const extras = counterItems
    .filter((g) => !/sq\s*ft/i.test(g.unit))
    .map((g) => ({ id: g.id, name: g.name, unit: g.unit, qty: qtyOf(g.id) }));
  const sinkCats = new Set(categories.filter((c) => c.name === "Sink & plumbing").map((c) => c.id));
  const sinkItems = generic
    .filter((g) => sinkCats.has(g.category_id) && /\bsink\b/i.test(g.name) && !/cord|disposal|base/i.test(g.name))
    .map((g) => ({ id: g.id, name: g.name, qty: qtyOf(g.id) }));

  const levelIds = new Set(levels.map((l) => l.id));
  const levelLine = priced.find((l) => l.catalog_item_id && levelIds.has(l.catalog_item_id)) ?? null;

  const steps: Record<StepKey, BuilderLine[]> = splitSteps(
    priced.map(
      (l): BuilderLine => ({
        id: l.id ?? "",
        code: l.code ?? "",
        name: l.name ?? "",
        qty: Number(l.qty ?? 0),
        unit: l.unit ?? "ea",
        section_id: l.section_id ?? "",
        catalog_item_id: l.catalog_item_id,
        collection_id: l.collection_id,
        cost_category: l.cost_category,
        note: l.note,
        price_cents: Number(l.price_cents ?? 0),
      }),
    ),
    { cabinetry: cabinetrySection, countertop: countertopSection },
  );

  return {
    ...base,
    brand,
    brands,
    colors: colors.map((c) => ({ ...c, vendor: brandOfList.get(c.price_list_id) ?? "" })),
    groups,
    accessories: accessoryRows,
    laborItems,
    countertop: {
      levels,
      extras,
      sinkItems,
      line: levelLine?.id
        ? { id: levelLine.id, item_id: levelLine.catalog_item_id, sqft: Number(levelLine.qty ?? 0), note: levelLine.note }
        : null,
    },
    specialTypes,
    steps,
  };
}

export type BuilderLine = {
  id: string;
  code: string;
  name: string;
  qty: number;
  unit: string;
  section_id: string;
  catalog_item_id: string | null;
  collection_id: string | null;
  cost_category: string | null;
  note: string | null;
  price_cents: number;
};

export type BuilderData = NonNullable<Awaited<ReturnType<typeof getBuilderData>>>;

/** Bulk-add sheet: the color group's items in one cabinet group (Wall, Base, …), cheapest list first per code. */
export async function getGroupItems(s: Session, collectionId: string, groupKey: string) {
  return must(
    await s.db
      .from("catalog_items_grouped")
      .select("id, code, name, list_price_cents, group_key")
      .eq("company_id", s.companyId)
      .eq("collection_id", collectionId)
      .eq("group_key", groupKey)
      .eq("active", true)
      .order("code")
      .limit(600),
  );
}
