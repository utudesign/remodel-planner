"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { applyTakeoff, computeTakeoff, type TakeoffInputs } from "@/lib/estimating/takeoff";
import {
  formFromTakeoff,
  measureFromWalls,
  parseFeetList,
  parseInchList,
  takeoffFromForm,
  takeoffSettings,
} from "@/lib/quick-estimate";
import { likeEscape, parseItemQuery, rankByCode, type FoundItem } from "@/lib/item-search";
import { formToObject, must, maybe, ok, run, type ActionState } from "@/server/action-utils";
import type { Json } from "@/types/db";

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

/** Apply a takeoff: recompute quantities and update only the lines that changed. */
async function applyMeasurements(s: Session, quoteId: string, takeoff: TakeoffInputs) {
  const [settings, lines] = await Promise.all([
    s.db.from("estimating_settings").select("*").eq("company_id", s.companyId).maybeSingle().then(maybe),
    s.db.from("quote_line_items").select("id, qty, qty_source").eq("quote_id", quoteId).then(must),
  ]);
  const result = computeTakeoff(takeoff, takeoffSettings(settings));
  const changes = applyTakeoff(
    lines.map((l) => ({ id: l.id, qty: Number(l.qty), qtySource: l.qty_source })),
    result,
  );
  ok(await s.db.from("quotes").update({ takeoff: takeoff as unknown as NonNullable<Json> }).eq("id", quoteId));
  for (const c of changes) ok(await s.db.from("quote_line_items").update({ qty: c.qty }).eq("id", c.id));
  return result.warnings;
}

/** "New quick estimate": template → lines; a done site visit's walls seed the measurements. */
export async function newQuickEstimate(_: ActionState, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const v = z.object({ deal_id: z.uuid(), template_id: z.uuid() }).parse(formToObject(fd));
    const s = await requireRole("owner", "partner");
    const deal = must(
      await s.db.from("deals").select("id, deal_number").eq("id", v.deal_id).eq("company_id", s.companyId).single(),
    );
    const quoteId = must(
      await s.db.rpc("create_quote_from_template", { p_deal_id: deal.id, p_template_id: v.template_id, p_name: "Quick estimate" }),
    ) as string;
    const visit = maybe(
      await s.db
        .from("site_visits")
        .select("id, walls")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const walls = ((visit?.walls ?? []) as { ft?: number }[]).map((w) => ({ ft: Number(w.ft ?? 0) }));
    if (visit && walls.some((w) => w.ft > 0)) {
      const q = must(await s.db.from("quotes").select("takeoff").eq("id", quoteId).single());
      const base = (q.takeoff ?? {}) as Partial<TakeoffInputs>;
      await applyMeasurements(s, quoteId, takeoffFromForm(measureFromWalls(walls, formFromTakeoff(base)), base));
      ok(await s.db.from("quotes").update({ site_visit_id: visit.id }).eq("id", quoteId));
    }
    if (["new", "qualified", "visit_booked", "visit_done"].includes((await s.db.from("deals").select("stage").eq("id", deal.id).single()).data?.stage ?? "")) {
      ok(await s.db.from("deals").update({ stage: "estimate" }).eq("id", deal.id));
    }
    target = `/deals/${deal.deal_number}/estimate/${quoteId}`;
  });
  if (res?.ok && target) redirect(target);
  return res;
}

const measureSchema = z.object({
  quote_id: z.uuid(),
  walls: z.string().max(200),
  corners: z.coerce.number().int().min(0).max(6),
  openings: z.string().max(200).optional().default(""),
  crown_lf: z.coerce.number().min(0).max(500),
  light_rail_lf: z.coerce.number().min(0).max(500),
  toe_kick_lf: z.coerce.number().min(0).max(500),
  scribe_lf: z.coerce.number().min(0).max(500),
  doors: z.coerce.number().int().min(0).max(200),
  drawers: z.coerce.number().int().min(0).max(200),
  led_ft: z.coerce.number().min(0).max(200),
  countertop_outlets: z.coerce.number().int().min(0).max(30),
  cabinet_lf: z.coerce.number().min(0).max(200),
});

export async function saveMeasurements(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = measureSchema.parse(formToObject(fd));
    const s = await requireRole("owner", "partner");
    const q = await quoteRef(s, v.quote_id);
    const walls = parseFeetList(v.walls);
    if (!walls.length) throw new Error("Enter at least one wall length in feet, like 10, 12");
    const base = (q.takeoff ?? {}) as Partial<TakeoffInputs>;
    const warnings = await applyMeasurements(
      s,
      q.id,
      takeoffFromForm(
        {
          walls_ft: walls,
          corners: v.corners,
          openings_in: parseInchList(v.openings),
          crown_lf: v.crown_lf,
          light_rail_lf: v.light_rail_lf,
          toe_kick_lf: v.toe_kick_lf,
          scribe_lf: v.scribe_lf,
          doors: v.doors,
          drawers: v.drawers,
          led_ft: v.led_ft,
          countertop_outlets: v.countertop_outlets,
          cabinet_lf: v.cabinet_lf || walls.reduce((a, b) => a + b, 0),
        },
        base,
      ),
    );
    revalidateQuote(q.number, q.id);
    return { ok: true, message: warnings.length ? `Saved. ${warnings.join(" ")}` : "Quantities updated" };
  });
}

/** Door color group: re-prices every cabinet, filler and trim line from the vendor list. */
export async function setColorGroup(input: { quote_id: string; collection_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid(), collection_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "partner");
    const q = await quoteRef(s, v.quote_id);
    const rows = must(await s.db.rpc("set_quote_collection", { p_quote_id: q.id, p_collection_id: v.collection_id }));
    const missing = rows.filter((r) => r.status !== "swapped").map((r) => r.code);
    revalidateQuote(q.number, q.id);
    return missing.length
      ? { ok: true, message: `Not in this color group: ${missing.join(", ")}. Swap or remove them.` }
      : { ok: true, message: `${rows.length} cabinet lines re-priced` };
  });
}

/** Quartz level 1–4: swaps every quartz line, keeping the square feet. */
export async function setQuartzLevel(input: { quote_id: string; catalog_item_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ quote_id: z.uuid(), catalog_item_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "partner");
    const q = await quoteRef(s, v.quote_id);
    const lines = must(await s.db.from("quote_line_items").select("id").eq("quote_id", q.id).like("code", "QZ%"));
    if (!lines.length) throw new Error("This estimate has no quartz line. Add one from the price list.");
    for (const l of lines) ok(await s.db.rpc("swap_line_item", { p_line_id: l.id, p_catalog_item_id: v.catalog_item_id }));
    revalidateQuote(q.number, q.id);
  });
}

export async function setLineQty(input: { line_id: string; qty: number }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ line_id: z.uuid(), qty: z.number().min(0).max(10000) }).parse(input);
    const s = await requireRole("owner", "partner");
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
    const s = await requireRole("owner", "partner");
    const line = must(
      await s.db.from("quote_line_items").select("quote_id").eq("id", v.line_id).eq("company_id", s.companyId).single(),
    );
    ok(await s.db.from("quote_line_items").delete().eq("id", v.line_id));
    const q = await quoteRef(s, line.quote_id);
    revalidateQuote(q.number, q.id);
  });
}

/** Add a price-list item to the estimate (cost is copied in, like the template lines). */
export async function addCatalogItem(input: { quote_id: string; catalog_item_id: string; qty?: number }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ quote_id: z.uuid(), catalog_item_id: z.uuid(), qty: z.number().min(0.01).max(10000).default(1) })
      .parse(input);
    const s = await requireRole("owner", "partner");
    const q = await quoteRef(s, v.quote_id);
    const ci = must(
      await s.db
        .from("catalog_items")
        .select("*, category:catalog_categories(id, cost_category, default_section_id, default_pick_phase_id)")
        .eq("id", v.catalog_item_id)
        .eq("company_id", s.companyId)
        .single(),
    );
    const existing = maybe(
      await s.db.from("quote_line_items").select("id, qty").eq("quote_id", q.id).eq("catalog_item_id", ci.id).limit(1).maybeSingle(),
    );
    if (existing) {
      ok(await s.db.from("quote_line_items").update({ qty: Number(existing.qty) + v.qty }).eq("id", existing.id));
    } else {
      const { data: last } = await s.db
        .from("quote_line_items")
        .select("sort_order")
        .eq("quote_id", q.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      ok(
        await s.db.from("quote_line_items").insert({
          company_id: s.companyId,
          quote_id: q.id,
          section_id: ci.section_id ?? ci.category!.default_section_id,
          category_id: ci.category_id,
          pick_phase_id: ci.category!.default_pick_phase_id,
          catalog_item_id: ci.id,
          cost_category: ci.cost_category ?? ci.category!.cost_category,
          code: ci.code,
          name: ci.name,
          qty: v.qty,
          unit: ci.unit,
          unit_cost_cents: ci.unit_cost_cents,
          uses_labor_rate: ci.uses_labor_rate,
          taxable: ci.taxable,
          is_allowance: ci.is_allowance,
          vendor: ci.vendor,
          qty_source: ci.qty_source,
          note: ci.notes,
          sort_order: (last?.sort_order ?? 0) + 1,
          pricing_mode: ci.pricing_mode,
          unit_price_cents: ci.unit_price_cents,
          list_price_cents: ci.list_price_cents,
          collection_id: ci.collection_id,
        }),
      );
    }
    revalidateQuote(q.number, q.id);
    return { ok: true, message: `Added ${ci.code || ci.name}` };
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
    const s = await requireRole("owner", "partner");
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
    const s = await requireRole("owner", "partner");
    const q = await quoteRef(s, v.quote_id);
    const doc = must(await s.db.rpc("share_quote", { p_quote_id: q.id })) as string;
    const t = must(await s.db.from("quote_totals").select("total_price_cents").eq("quote_id", q.id).single());
    ok(await s.db.from("deals").update({ estimated_value_cents: t.total_price_cents }).eq("id", q.deal_id));
    revalidateQuote(q.number, q.id);
    return { ok: true, message: doc };
  });
}

export async function duplicateQuote(input: { quote_id: string }): Promise<ActionState> {
  let target = "";
  const res = await run(async () => {
    const v = z.object({ quote_id: z.uuid() }).parse(input);
    const s = await requireRole("owner", "partner");
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
  const s = await requireRole("owner", "partner");
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
