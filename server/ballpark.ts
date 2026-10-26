import { ballpark, type BallparkLine, type RoughInputs } from "@/lib/estimating/ballpark";
import type { TakeoffInputs } from "@/lib/estimating/takeoff";
import { assumptions, formFromTakeoff, measureFromWalls, takeoffFromForm, takeoffSettings } from "@/lib/quick-estimate";
import type { Db } from "@/lib/supabase/server";
import { must, maybe } from "@/server/action-utils";

/** Rough price range from the first template, resized by the walls measured (ballpark.ts). */
export async function kitchenRange(db: Db, companyId: string, walls: { ft: number }[]) {
  const tpl = maybe(
    await db
      .from("quote_templates")
      .select("id, default_takeoff")
      .eq("company_id", companyId)
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  );
  if (!tpl || !walls.some((w) => w.ft > 0)) return null;
  const [items, settings] = await Promise.all([
    db
      .from("quote_template_items")
      .select("qty, item:catalog_items(unit_cost_cents, uses_labor_rate, taxable, pricing_mode, unit_price_cents, qty_source, category:catalog_categories(name))")
      .eq("template_id", tpl.id)
      .then(must),
    db.from("estimating_settings").select("*").eq("company_id", companyId).maybeSingle().then(maybe),
  ]);
  const lines: BallparkLine[] = items
    .filter((i) => i.item)
    .map((i) => ({
      qty: Number(i.qty),
      unitCostCents: Number(i.item!.unit_cost_cents),
      usesLaborRate: i.item!.uses_labor_rate,
      marginOverride: null,
      taxable: i.item!.taxable,
      pricingMode: i.item!.pricing_mode as "margin" | "fixed",
      unitPriceCents: i.item!.unit_price_cents,
      qtySource: i.item!.qty_source,
      scalesWithCabinets: i.item!.category?.name === "Cabinets",
    }));
  const base = (tpl.default_takeoff ?? {}) as Partial<TakeoffInputs>;
  const templateTakeoff = takeoffFromForm(formFromTakeoff(base), base) as RoughInputs;
  const rough = takeoffFromForm(measureFromWalls(walls, formFromTakeoff(base)), base) as RoughInputs;
  const r = ballpark(
    lines,
    templateTakeoff,
    rough,
    assumptions({
      target_margin: Number(settings?.target_margin ?? 0.35),
      contingency_rate: Number(settings?.contingency_rate ?? 0.07),
      tax_rate: Number(settings?.tax_rate ?? 0.06),
      labor_rate_cents: Number(settings?.labor_rate_cents ?? 5500),
    }),
    takeoffSettings(settings),
    {
      lowPct: Number(settings?.ballpark_low_pct ?? 0.05),
      highPct: Number(settings?.ballpark_high_pct ?? 0.15),
      roundToCents: Number(settings?.ballpark_round_cents ?? 50000),
    },
  );
  return r;
}

