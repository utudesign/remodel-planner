"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { noteWithSinkType, resolveAccessory, SINK_TYPES, SPECIAL_PREFIX } from "@/lib/estimating/builder-steps";
import { likeEscape, parseItemQuery, rankByCode, type FoundItem } from "@/lib/item-search";
import { formToObject, must, maybe, ok, run, type ActionState } from "@/server/action-utils";

async function quoteRef(s: Session, quoteId: string) {
  const q = must(
    await s.db
      .from("quotes")
      .select("id, deal_id, takeoff, status, deal:deals(deal_number)")
      .eq("id", quoteId)
      .eq("company_id", s.companyId)
      .single(),
  );
  return { ...q, number: q.deal?.deal_number ?? "" };
}

function revalidateQuote(number: string, quoteId: string) {
  revalidatePath(`/deals/${number}`);
  revalidatePath(`/deals/${number}/estimate/${quoteId}`);
}

/** Copy a price-list item into an estimate line (cost is copied in, like the template lines). */
async function insertCatalogLine(s: Session, quoteId: string, catalogItemId: string, qty: number, note?: string | null) {
  const ci = must(
    await s.db
      .from("catalog_items")
      .select("*, category:catalog_categories(id, cost_category, default_section_id, default_pick_phase_id)")
      .eq("id", catalogItemId)
      .eq("company_id", s.companyId)
      .single(),
  );
  const { data: last } = await s.db
    .from("quote_line_items")
    .select("sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = must(
    await s.db
      .from("quote_line_items")
      .insert({
        company_id: s.companyId,
        quote_id: quoteId,
        section_id: ci.section_id ?? ci.category!.default_section_id,
        category_id: ci.category_id,
        pick_phase_id: ci.category!.default_pick_phase_id,
        catalog_item_id: ci.id,
        cost_category: ci.cost_category ?? ci.category!.cost_category,
        code: ci.code,
        name: ci.name,
        qty,
        unit: ci.unit,
        unit_cost_cents: ci.unit_cost_cents,
        uses_labor_rate: ci.uses_labor_rate,
        taxable: ci.taxable,
        is_allowance: ci.is_allowance,
        vendor: ci.vendor,
        qty_source: ci.qty_source,
        note: note ?? ci.notes,
        sort_order: (last?.sort_order ?? 0) + 1,
        pricing_mode: ci.pricing_mode,
        unit_price_cents: ci.unit_price_cents,
        list_price_cents: ci.list_price_cents,
        collection_id: ci.collection_id,
      })
      .select("id")
      .single(),
  );
  return { id: row.id, code: ci.code, name: ci.name };
}

/** Set the total qty of one price-list item on an estimate: 0 removes it, else one line with that qty. */
async function setItemTotal(s: Session, quoteId: string, catalogItemId: string, qty: number) {
  const lines = must(
    await s.db.from("quote_line_items").select("id").eq("quote_id", quoteId).eq("catalog_item_id", catalogItemId).order("sort_order"),
  );
  if (qty <= 0) {
    for (const l of lines) ok(await s.db.from("quote_line_items").delete().eq("id", l.id));
    return;
  }
  if (!lines.length) {
    await insertCatalogLine(s, quoteId, catalogItemId, qty);
    return;
  }
  ok(await s.db.from("quote_line_items").update({ qty }).eq("id", lines[0].id));
  for (const l of lines.slice(1)) ok(await s.db.from("quote_line_items").delete().eq("id", l.id));
}

/**
 * "New estimate" (change request v3 item 10): an empty estimate. Brand and color come first, then cabinets
 * from the bulk-add sheet; suggestions are one-tap chips, never pre-filled lines. The deal moves to the
 * Estimate stage when it's earlier in the pipeline (by stage order).
 */
export async function newQuickEstimate(_: ActionState, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const v = z.object({ deal_id: z.uuid() }).parse(formToObject(fd));
    const s = await requireRole("owner", "team", "partner");
    const deal = must(
      await s.db.from("deals").select("id, deal_number, stage").eq("id", v.deal_id).eq("company_id", s.companyId).single(),
    );
    // Version numbers are never reused (deleted estimates keep theirs). A second estimate starts with the
    // deal's last brand + color (options usually change cabinets, not the door).
    const { data: top } = await s.db
      .from("quotes")
      .select("version, collection_id, color_code")
      .eq("deal_id", deal.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    // Rates come from Settings (the quotes_defaults trigger, 0002, would fill the same values).
    const rates = maybe(
      await s.db
        .from("estimating_settings")
        .select("target_margin, contingency_rate, tax_rate, labor_rate_cents")
        .eq("company_id", s.companyId)
        .maybeSingle(),
    );
    const q = must(
      await s.db
        .from("quotes")
        .insert({
          company_id: s.companyId,
          deal_id: deal.id,
          version: (top?.version ?? 0) + 1,
          name: "Estimate",
          collection_id: top?.collection_id ?? null,
          color_code: top?.color_code ?? null,
          created_by: s.userId,
          target_margin: rates?.target_margin ?? 0.35,
          contingency_rate: rates?.contingency_rate ?? 0.07,
          tax_rate: rates?.tax_rate ?? 0.06,
          labor_rate_cents: rates?.labor_rate_cents ?? 5500,
        })
        .select("id")
        .single(),
    );
    const stages = must(await s.db.from("pipeline_stages").select("key, kind, sort_order").eq("company_id", s.companyId));
    const cur = stages.find((x) => x.key === deal.stage);
    const est = stages.find((x) => x.key === "estimate");
    if (cur && est && cur.kind === "open" && cur.sort_order < est.sort_order) {
      ok(await s.db.from("deals").update({ stage: est.key }).eq("id", deal.id));
    }
    target = `/deals/${deal.deal_number}/estimate/${q.id}`;
  });
  if (res?.ok && target) redirect(target);
  return res;
}

export async function setLineQty(input: { line_id: string; qty: number }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ line_id: z.uuid(), qty: z.number().min(0).max(10000) }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const line = must(
      await s.db
        .from("quote_line_items")
        .update({ qty: Math.round(v.qty * 100) / 100 })
        .eq("id", v.line_id)
        .eq("company_id", s.companyId)
        .select("quote_id")
        .single(),
    );
    const q = await quoteRef(s, line.quote_id);
    revalidateQuote(q.number, q.id);
  });
}

export async function removeLine(input: { line_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ line_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const line = must(
      await s.db.from("quote_line_items").select("quote_id").eq("id", v.line_id).eq("company_id", s.companyId).single(),
    );
    ok(await s.db.from("quote_line_items").delete().eq("id", v.line_id));
    const q = await quoteRef(s, line.quote_id);
    revalidateQuote(q.number, q.id);
  });
}

/** Add a price-list item to the estimate (adds to the qty when it's already there). */
export async function addCatalogItem(input: { quote_id: string; catalog_item_id: string; qty?: number }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ quote_id: z.uuid(), catalog_item_id: z.uuid(), qty: z.number().min(0.01).max(10000).default(1) })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const existing = maybe(
      await s.db.from("quote_line_items").select("id, qty").eq("quote_id", q.id).eq("catalog_item_id", v.catalog_item_id).limit(1).maybeSingle(),
    );
    let label = "Added";
    if (existing) {
      ok(await s.db.from("quote_line_items").update({ qty: Number(existing.qty) + v.qty }).eq("id", existing.id));
    } else {
      const l = await insertCatalogLine(s, q.id, v.catalog_item_id, v.qty);
      label = `Added ${l.code || l.name}`;
    }
    revalidateQuote(q.number, q.id);
    return { ok: true, message: label };
  });
}

/** Custom line (anything not in the price list): name, my cost, qty. */
export async function addCustomLine(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        quote_id: z.uuid(),
        name: z.string().trim().min(1, "is required").max(160),
        cost: z.string().regex(/^\$?\d+(\.\d{1,2})?$/, "enter a dollar amount like 125.50"),
        qty: z.coerce.number().min(0.01).max(10000).default(1),
      })
      .parse(formToObject(fd));
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const other = must(
      await s.db
        .from("catalog_categories")
        .select("id, cost_category, default_section_id, default_pick_phase_id")
        .eq("company_id", s.companyId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .single(),
    );
    ok(
      await s.db.from("quote_line_items").insert({
        company_id: s.companyId,
        quote_id: q.id,
        section_id: other.default_section_id,
        category_id: other.id,
        cost_category: "other",
        name: v.name,
        qty: v.qty,
        unit_cost_cents: Math.round(Number(v.cost.replace("$", "")) * 100),
        sort_order: 999,
      }),
    );
    revalidateQuote(q.number, q.id);
    return { ok: true, message: "Added" };
  });
}

/** Number the estimate (26-1047-E1), mark it sent, and keep the deal's value in sync. */
export async function shareQuote(input: { quote_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const doc = must(await s.db.rpc("share_quote", { p_quote_id: q.id })) as string;
    const t = must(await s.db.from("quote_totals").select("total_price_cents").eq("quote_id", q.id).single());
    ok(await s.db.from("deals").update({ estimated_value_cents: t.total_price_cents }).eq("id", q.deal_id));
    revalidateQuote(q.number, q.id);
    return { ok: true, message: doc };
  });
}

/**
 * v3 item 6. Drafts are soft-deleted (deleted_at); anything sent to the client or on a sold deal is
 * only archived. The database refuses the wrong one (0017 quotes_delete_archive_guard), so this can't drift.
 */
export async function deleteQuote(input: { quote_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    ok(await s.db.from("quotes").update({ deleted_at: new Date().toISOString() }).eq("id", q.id));
    revalidatePath(`/deals/${q.number}`);
    return { ok: true, message: "Estimate deleted" };
  });
}

export async function setQuoteArchived(input: { quote_id: string; archived: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid(), archived: z.boolean() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    ok(
      await s.db
        .from("quotes")
        .update({ archived_at: v.archived ? new Date().toISOString() : null })
        .eq("id", q.id),
    );
    revalidateQuote(q.number, q.id);
    return { ok: true, message: v.archived ? "Archived" : "Restored" };
  });
}

export async function duplicateQuote(input: { quote_id: string }): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const v = z.object({ quote_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const id = must(await s.db.rpc("duplicate_quote", { p_quote_id: q.id })) as string;
    target = `/deals/${q.number}/estimate/${id}`;
  });
  if (res?.ok && target) redirect(target);
  return res;
}

/**
 * Live add-by-code search for the quick estimate (components/estimates/item-search.tsx).
 * Code prefix first ("B36" → B36, B36FH); names only when no code starts with the term.
 * Limited to the estimate's collection + generic items, like the old search.
 */
export async function findCatalogItems(input: { quote_id: string; q: string }): Promise<FoundItem[]> {
  const v = z.object({ quote_id: z.uuid(), q: z.string().max(80) }).parse(input);
  const { term } = parseItemQuery(v.q);
  if (term.length < 1) return [];
  const s = await requireRole("owner", "team", "partner");
  const quote = must(
    await s.db.from("quotes").select("collection_id").eq("id", v.quote_id).eq("company_id", s.companyId).single(),
  );
  const cid = quote.collection_id;
  const scoped = <T extends { or: (f: string) => T; is: (c: string, v: null) => T }>(qb: T) =>
    cid ? qb.or(`collection_id.is.null,collection_id.eq.${cid}`) : qb.is("collection_id", null);
  const cols = "id, code, name, unit, collection_id, unit_cost_cents, unit_price_cents, pricing_mode";
  type Row = { id: string; code: string; name: string; unit: string; collection_id: string | null; unit_cost_cents: number; unit_price_cents: number | null; pricing_mode: string };
  const toFound = (r: Row): FoundItem => ({
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    collection_id: r.collection_id,
    fixed: r.pricing_mode === "fixed",
    price_cents: Number(r.pricing_mode === "fixed" ? (r.unit_price_cents ?? 0) : r.unit_cost_cents),
  });
  const pattern = likeEscape(term);
  const codeRows = must(
    await scoped(
      s.db.from("catalog_items").select(cols).eq("company_id", s.companyId).eq("active", true).ilike("code", `${pattern}%`),
    )
      .order("code")
      .limit(60),
  ) as Row[];
  const ranked = rankByCode(codeRows.map(toFound), term, cid);
  if (ranked.length || term.length < 2) return ranked;
  const nameRows = must(
    await scoped(
      s.db.from("catalog_items").select(cols).eq("company_id", s.companyId).eq("active", true).ilike("name", `%${pattern}%`),
    )
      .order("code")
      .limit(6),
  ) as Row[];
  return nameRows.map(toFound);
}

// ---------------------------------------------------------------------------------------------
// Estimate builder (change request v3 items 9 + 10): brand → color → cabinets → labor → countertop → special work
// ---------------------------------------------------------------------------------------------

/** Accessory list rows for the estimate's brand (brand rows win over "every brand" rows). */
async function brandAccessories(s: Session, quoteId: string) {
  const quote = must(await s.db.from("quotes").select("collection_id").eq("id", quoteId).single());
  let brand: string | null = null;
  if (quote.collection_id) {
    const c = must(
      await s.db.from("catalog_collections").select("price_list:price_lists(vendor)").eq("id", quote.collection_id).single(),
    );
    brand = c.price_list?.vendor ?? null;
  }
  const rows = must(
    await s.db.from("estimate_accessories").select("id, key, vendor, code, item_name").eq("company_id", s.companyId).eq("active", true),
  );
  const byKey = new Map<string, (typeof rows)[number]>();
  for (const a of rows) {
    if (a.vendor && a.vendor !== brand) continue;
    const cur = byKey.get(a.key);
    if (!cur || (!cur.vendor && a.vendor)) byKey.set(a.key, a);
  }
  const accs = [...byKey.values()];
  const codes = accs.map((a) => a.code).filter((c): c is string => !!c);
  const names = accs.map((a) => a.item_name).filter((n): n is string => !!n);
  const items = [
    ...(codes.length
      ? must(
          await s.db
            .from("catalog_items")
            .select("id, code, name, collection_id")
            .eq("company_id", s.companyId)
            .eq("active", true)
            .in("code", codes)
            .or(quote.collection_id ? `collection_id.is.null,collection_id.eq.${quote.collection_id}` : "collection_id.is.null"),
        )
      : []),
    ...(names.length
      ? must(
          await s.db
            .from("catalog_items")
            .select("id, code, name, collection_id")
            .eq("company_id", s.companyId)
            .eq("active", true)
            .is("collection_id", null)
            .in("name", names),
        )
      : []),
  ];
  return accs.map((a) => ({ ...a, item: resolveAccessory(a, quote.collection_id, items) }));
}

/**
 * Pick the door color. The estimate moves to that color's price group: every cabinet line with the same code is
 * re-priced (set_quote_collection, 0002), and accessory lines follow the brand (Skyline F342 ↔ TimberPeak WF342).
 */
export async function pickColor(input: { quote_id: string; color_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid(), color_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const color = must(
      await s.db.from("catalog_colors").select("code, name, collection_id").eq("id", v.color_id).eq("company_id", s.companyId).single(),
    );
    // Accessory quantities before the switch, by accessory key.
    const before = await brandAccessories(s, q.id);
    const lines = must(await s.db.from("quote_line_items").select("catalog_item_id, qty").eq("quote_id", q.id));
    const qtyBefore = new Map(
      before.map((a) => [
        a.key,
        { itemId: a.item?.id ?? null, qty: lines.filter((l) => a.item && l.catalog_item_id === a.item.id).reduce((n, l) => n + Number(l.qty), 0) },
      ]),
    );
    const rows = must(await s.db.rpc("set_quote_collection", { p_quote_id: q.id, p_collection_id: color.collection_id }));
    ok(await s.db.from("quotes").update({ color_code: color.code }).eq("id", q.id));
    for (const a of await brandAccessories(s, q.id)) {
      const old = qtyBefore.get(a.key);
      if (!old || !old.qty || !old.itemId || !a.item || old.itemId === a.item.id) continue;
      await setItemTotal(s, q.id, old.itemId, 0);
      await setItemTotal(s, q.id, a.item.id, old.qty);
    }
    revalidateQuote(q.number, q.id);
    const missing = [...new Set(rows.filter((r) => r.status !== "swapped").map((r) => r.code))];
    return missing.length
      ? { ok: true, message: `${color.name}. Not made in this color: ${missing.join(", ")}. Swap or remove them.` }
      : { ok: true, message: color.name };
  });
}

/** Bulk add: several cabinets at once, with quantities (adds to lines that are already there). */
export async function addCatalogItems(input: { quote_id: string; items: { id: string; qty: number }[] }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        quote_id: z.uuid(),
        items: z.array(z.object({ id: z.uuid(), qty: z.number().int().min(1).max(200) })).min(1).max(100),
      })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const ids = v.items.map((i) => i.id);
    // Only items from this company, and from the estimate's color group or no color group.
    const allowed = must(
      await s.db.from("catalog_items").select("id, collection_id").eq("company_id", s.companyId).in("id", ids),
    );
    const quote = must(await s.db.from("quotes").select("collection_id").eq("id", q.id).single());
    const bad = allowed.filter((a) => a.collection_id && a.collection_id !== quote.collection_id);
    if (bad.length || allowed.length !== new Set(ids).size) throw new Error("Pick the color first, then add its cabinets");
    const existing = must(await s.db.from("quote_line_items").select("id, qty, catalog_item_id").eq("quote_id", q.id).in("catalog_item_id", ids));
    let n = 0;
    for (const it of v.items) {
      const cur = existing.find((e) => e.catalog_item_id === it.id);
      if (cur) ok(await s.db.from("quote_line_items").update({ qty: Number(cur.qty) + it.qty }).eq("id", cur.id));
      else await insertCatalogLine(s, q.id, it.id, it.qty);
      n += it.qty;
    }
    revalidateQuote(q.number, q.id);
    return { ok: true, message: `Added ${n} item${n === 1 ? "" : "s"}` };
  });
}

/** Accessory list, labor chips, countertop extras, sink: set one item's total qty (0 removes it). */
export async function setItemQty(input: { quote_id: string; catalog_item_id: string; qty: number }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ quote_id: z.uuid(), catalog_item_id: z.uuid(), qty: z.number().min(0).max(10000) })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    must(await s.db.from("catalog_items").select("id").eq("id", v.catalog_item_id).eq("company_id", s.companyId).single());
    await setItemTotal(s, q.id, v.catalog_item_id, Math.round(v.qty * 100) / 100);
    revalidateQuote(q.number, q.id);
  });
}

/** Countertop: material/level (a per-sq-ft price-book item), square feet, and the sink type (kept on the line). */
export async function setCountertop(input: {
  quote_id: string;
  level_id: string;
  sqft: number;
  sink_type: string | null;
}): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        quote_id: z.uuid(),
        level_id: z.uuid(),
        sqft: z.number().min(0).max(2000),
        sink_type: z.enum(SINK_TYPES).nullable(),
      })
      .parse(input);
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const level = must(
      await s.db
        .from("catalog_items")
        .select("id, unit, category:catalog_categories(name)")
        .eq("id", v.level_id)
        .eq("company_id", s.companyId)
        .single(),
    );
    if (level.category?.name !== "Countertop" || !/sq\s*ft/i.test(level.unit)) throw new Error("Pick a countertop level");
    // The estimate's current countertop line (any per-sq-ft countertop item).
    const levels = must(
      await s.db
        .from("catalog_items")
        .select("id, unit, category:catalog_categories!inner(name)")
        .eq("company_id", s.companyId)
        .eq("category.name", "Countertop"),
    ).filter((i) => /sq\s*ft/i.test(i.unit));
    const cur = maybe(
      await s.db
        .from("quote_line_items")
        .select("id, catalog_item_id, note")
        .eq("quote_id", q.id)
        .in("catalog_item_id", levels.map((l) => l.id))
        .order("sort_order")
        .limit(1)
        .maybeSingle(),
    );
    if (v.sqft <= 0) {
      if (cur) ok(await s.db.from("quote_line_items").delete().eq("id", cur.id));
    } else if (cur) {
      if (cur.catalog_item_id !== level.id) ok(await s.db.rpc("swap_line_item", { p_line_id: cur.id, p_catalog_item_id: level.id }));
      ok(
        await s.db
          .from("quote_line_items")
          .update({ qty: Math.round(v.sqft * 10) / 10, note: noteWithSinkType(cur.note, v.sink_type) })
          .eq("id", cur.id),
      );
    } else {
      await insertCatalogLine(s, q.id, level.id, Math.round(v.sqft * 10) / 10, noteWithSinkType(null, v.sink_type));
    }
    revalidateQuote(q.number, q.id);
    return { ok: true, message: "Countertop saved" };
  });
}

/**
 * Special work (electrical, gas, plumbing, flooring, other): one line with the client price. Your cost is
 * optional; without it the line is costed at the target margin so profit isn't overstated.
 */
export async function addSpecialWork(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const money = z
      .string()
      .trim()
      .regex(/^\$?\d{1,7}(\.\d{1,2})?$/, "enter a dollar amount like 1250");
    const v = z
      .object({
        quote_id: z.uuid(),
        type: z.string().regex(/^[a-z0-9_]{2,30}$/),
        description: z.string().trim().max(160).optional().default(""),
        price: money,
        cost: z.preprocess((x) => (x === "" ? undefined : x), money.optional()),
      })
      .parse(formToObject(fd));
    const s = await requireRole("owner", "team", "partner");
    const q = await quoteRef(s, v.quote_id);
    const type = must(
      await s.db
        .from("estimate_special_types")
        .select("key, label, section_sort")
        .eq("company_id", s.companyId)
        .eq("key", v.type)
        .single(),
    );
    const sections = must(await s.db.from("quote_sections").select("id, sort_order").eq("company_id", s.companyId).order("sort_order"));
    const section = sections.find((x) => x.sort_order === type.section_sort) ?? sections[sections.length - 1];
    if (!section) throw new Error("No estimate sections are set up");
    const sub = maybe(
      await s.db
        .from("catalog_categories")
        .select("id")
        .eq("company_id", s.companyId)
        .eq("cost_category", "subcontractor")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const settings = maybe(await s.db.from("estimating_settings").select("target_margin").eq("company_id", s.companyId).maybeSingle());
    const cents = (x: string) => Math.round(Number(x.replace("$", "")) * 100);
    const price = cents(v.price);
    const cost = v.cost !== undefined ? cents(v.cost) : Math.round(price * (1 - Number(settings?.target_margin ?? 0.35)));
    ok(
      await s.db.from("quote_line_items").insert({
        company_id: s.companyId,
        quote_id: q.id,
        section_id: section.id,
        category_id: sub?.id ?? null,
        cost_category: "subcontractor",
        code: `${SPECIAL_PREFIX}${type.key}`,
        name: v.description ? `${type.label}: ${v.description}` : type.label,
        qty: 1,
        unit: "job",
        unit_cost_cents: cost,
        pricing_mode: "fixed",
        unit_price_cents: price,
        taxable: false,
        sort_order: 900,
      }),
    );
    revalidateQuote(q.number, q.id);
    return { ok: true, message: `${type.label} added` };
  });
}

/** Bulk-add sheet: the estimate's color-group items in one cabinet group (Wall, Base, …). */
export async function listGroupItems(input: { quote_id: string; group: string }) {
  const v = z.object({ quote_id: z.uuid(), group: z.string().regex(/^[a-z0-9_]{2,30}$/) }).parse(input);
  const s = await requireRole("owner", "team", "partner");
  const quote = must(await s.db.from("quotes").select("collection_id").eq("id", v.quote_id).eq("company_id", s.companyId).single());
  if (!quote.collection_id) return [];
  return must(
    await s.db
      .from("catalog_items_grouped")
      .select("id, code, name, list_price_cents")
      .eq("company_id", s.companyId)
      .eq("collection_id", quote.collection_id)
      .eq("group_key", v.group)
      .eq("active", true)
      .order("code")
      .limit(600),
  ).map((r) => ({ id: r.id!, code: r.code ?? "", name: r.name ?? "", list_price_cents: Number(r.list_price_cents ?? 0) }));
}
