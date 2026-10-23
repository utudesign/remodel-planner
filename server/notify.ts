import { after } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { flushNotifications } from "@/server/push";

/** In-app notification for the company's owner(s), pushed right after the response. */
export async function notifyOwners(
  companyId: string,
  n: { kind: "new_lead" | "booking" | "partner_update" | "commission"; title: string; body?: string; url: string; dealId?: string },
) {
  const db = createAdminSupabase();
  const { data: owners } = await db
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .eq("active", true);
  if (!owners?.length) return;
  await db.from("notifications").insert(
    owners.map((o) => ({
      company_id: companyId,
      user_id: o.id,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      url: n.url,
      deal_id: n.dealId ?? null,
    })),
  );
  after(() => flushNotifications(companyId));
}
