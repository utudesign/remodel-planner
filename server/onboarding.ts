import sheets from "@/supabase/seed/timberpeak-msrp-sheets.json";
import { parsePriceList, toImportPayload, type SheetRows } from "@/lib/estimating/vendorImport";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/server";
import type { Json } from "@/types/db";

/**
 * First sign-in of a new rep: create the company + owner row (bootstrap_owner seeds stages,
 * estimating, jacket + hand-off checklists, RenoDesign + placeholder plans), then import the
 * TimberPeak list (4 color groups, cost = MSRP × 0.33) the same way scripts/price-list-to-sql.ts does,
 * and the Skyline (Spring Forest) list.
 *
 * ALLOWED_OWNER_EMAILS (comma-separated) limits who can open an account. Unset = anyone who can
 * sign in to Clerk (fine while Clerk sign-ups are restricted; see docs/DEPLOY.md).
 */
export async function bootstrapOwner(input: {
  clerkUserId: string;
  name: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const allowed = (process.env.ALLOWED_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(input.email.toLowerCase())) {
    return { ok: false, reason: "This app is private. Ask the owner for an invite link." };
  }
  const db = createAdminSupabase();
  const { data, error } = await db
    .rpc("bootstrap_owner", {
      p_clerk_user_id: input.clerkUserId,
      p_name: input.name,
      p_email: input.email,
    })
    .single();
  if (error || !data) throw new Error(`Could not set up your account: ${error?.message ?? "no data"}`);
  if (data.created) {
    await importTimberPeak(data.company_id);
    // Skyline is big (3.5k items); if it fails here the owner loads it from Settings → Price lists.
    try {
      await importSkyline(data.company_id);
    } catch (e) {
      console.error("Skyline import at sign-up failed; load it from Settings", e);
    }
  }
  return { ok: true };
}

export async function importTimberPeak(companyId: string) {
  const { collections } = parsePriceList(sheets as SheetRows[], {
    vendor: "TimberPeak",
    costMultiplier: 0.33,
  });
  const { error } = await createAdminSupabase().rpc("import_price_list", {
    p_company_id: companyId,
    p_vendor: "TimberPeak",
    p_list_name: "TimberPeak MSRP 2026",
    p_cost_multiplier: 0.33,
    p_effective_date: "2026-10-23",
    p_source_file: "timberpeak-msrp-sheets.json",
    p_collections: toImportPayload(collections),
  });
  if (error) throw new Error(`Price list import failed: ${error.message}`);
  // TimberPeak has no color names: one color per code in each color group (0019).
  await createAdminSupabase().rpc("sync_collection_colors", { p_company_id: companyId });
}

/**
 * Skyline = the Spring Forest 2026 price lists (change request v3 batch C): 17 color groups, 32 named
 * colors with swatches, cost = list × 0.35. The payload is built from the vendor files by
 * scripts/skyline/*.py (docs/DECISIONS.md). Re-running it updates prices in place.
 * Pass a signed-in client (owner) from Settings; the admin client is used at first sign-in.
 */
export async function importSkyline(companyId: string, db: Db = createAdminSupabase()) {
  const p = (await import("@/supabase/seed/skyline-springforest-2026.json")).default as SkylinePayload;
  const { error } = await db.rpc("import_price_list", {
    p_company_id: companyId,
    p_vendor: p.vendor,
    p_list_name: p.list_name,
    p_cost_multiplier: p.cost_multiplier,
    p_effective_date: p.effective_date,
    p_source_file: p.source_file,
    p_collections: p.collections as unknown as Json,
  });
  if (error) throw new Error(`Skyline price list import failed: ${error.message}`);
  const colors = await db.rpc("import_brand_colors", {
    p_company_id: companyId,
    p_list_name: p.list_name,
    p_colors: p.colors as unknown as Json,
  });
  if (colors.error) throw new Error(`Skyline colors import failed: ${colors.error.message}`);
  const items = p.collections.reduce((n, c) => n + c.items.length, 0);
  return { groups: p.collections.length, colors: p.colors.length, items };
}

type SkylinePayload = {
  vendor: string;
  list_name: string;
  cost_multiplier: number;
  effective_date: string;
  source_file: string;
  collections: { name: string; colors: string[]; sort_order: number; items: unknown[] }[];
  colors: { code: string; name: string; line: string; collection: string; sort_order: number; swatch_url: string }[];
};

/** Invited teammate (More → Team) signing in for the first time: creates their team login (0015). */
export async function acceptTeamInvite(input: { clerkUserId: string; name: string; email: string }): Promise<boolean> {
  if (!input.email) return false;
  const { data, error } = await createAdminSupabase().rpc("accept_team_invite", {
    p_clerk_user_id: input.clerkUserId,
    p_email: input.email,
    p_name: input.name,
  });
  if (error) throw new Error(`Could not accept the invite: ${error.message}`);
  return !!data;
}
