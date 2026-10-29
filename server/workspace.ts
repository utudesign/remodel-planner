import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Scheduled visits that block a booking slot (0016): only the deal's own workspace's calendar,
 * so Crystal's clients and Tugu's clients book independently. Service role (public pages).
 */
export async function busyMeetings(companyId: string, workspaceId: string | null, now: Date) {
  const db = createAdminSupabase();
  let q = db
    .from("meetings")
    .select("starts_at, ends_at, deal:deals!inner(workspace_id)")
    .eq("company_id", companyId)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 86400_000).toISOString());
  if (workspaceId) q = q.eq("deal.workspace_id", workspaceId);
  const { data } = await q;
  return (data ?? []).map((m) => ({ starts_at: m.starts_at, ends_at: m.ends_at }));
}

/** First name of whoever greets the client: the given user, else the company's default owner. */
export async function hostFirstName(companyId: string, userId: string | null | undefined) {
  const db = createAdminSupabase();
  const base = db.from("users").select("name").eq("company_id", companyId);
  const { data } = await (userId ? base.eq("id", userId) : base.eq("role", "owner").eq("is_default_owner", true)).maybeSingle();
  return (data?.name ?? "").split(/\s+/)[0];
}
