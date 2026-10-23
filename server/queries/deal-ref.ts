import type { Session } from "@/lib/auth/require-role";
import type { DealRef } from "@/lib/storage";
import { maybe } from "@/server/action-utils";

/** Deal number + ids for storage paths. Works for crew too (via crew_projects, no money). */
export async function dealRefFor(s: Session, by: { dealId?: string | null; projectId?: string | null }): Promise<DealRef | null> {
  if (by.dealId && s.role !== "crew") {
    const d = maybe(
      await s.db.from("deals").select("id, company_id, deal_year, deal_number").eq("id", by.dealId).maybeSingle(),
    );
    if (d) return d;
  }
  let q = s.db.from("crew_projects").select("deal_id, company_id, deal_year, deal_number");
  q = by.projectId ? q.eq("id", by.projectId) : q.eq("deal_id", by.dealId ?? "");
  const p = maybe(await q.maybeSingle());
  if (!p?.deal_id || !p.company_id || p.deal_year === null || !p.deal_number) return null;
  return { id: p.deal_id, company_id: p.company_id, deal_year: p.deal_year, deal_number: p.deal_number };
}

export function dealHref(d: { deal_year: number | null; deal_number: string | null } | null | undefined, tab?: string) {
  if (!d?.deal_year || !d.deal_number) return "/deals";
  return `/deals/${d.deal_year}/${d.deal_number}${tab ? `?tab=${tab}` : ""}`;
}
