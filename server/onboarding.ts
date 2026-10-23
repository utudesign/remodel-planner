import sheets from "@/supabase/seed/timberpeak-msrp-sheets.json";
import { parsePriceList, toImportPayload, type SheetRows } from "@/lib/estimating/vendorImport";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * First sign-in of a new rep: create the company + owner row (bootstrap_owner seeds stages,
 * estimating, jacket + hand-off checklists, RenoDesign + placeholder plans), then import the
 * TimberPeak list (4 color groups, cost = MSRP × 0.33) the same way scripts/price-list-to-sql.ts does.
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
  if (data.created) await importTimberPeak(data.company_id);
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
}
