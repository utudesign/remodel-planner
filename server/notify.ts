import { after } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { flushNotifications } from "@/server/push";

/**
 * In-app notification, pushed right after the response. Goes to the admin(s) of the deal's
 * workspace (0016: Crystal for her workspace); without a workspace, to the company owner(s).
 */
export async function notifyOwners(
  companyId: string,
  n: { kind: "new_lead" | "booking" | "partner_update" | "commission"; title: string; body?: string; url: string; dealId?: string },
  workspaceId?: string | null,
) {
  const db = createAdminSupabase();
  const base = db.from("users").select("id").eq("company_id", companyId).eq("active", true);
  const { data: owners } = await (workspaceId
    ? base.eq("workspace_id", workspaceId).eq("workspace_admin", true)
    : base.eq("role", "owner"));
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
