import { notFound } from "next/navigation";
import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export type BoardLead = {
  id: string;
  stage_id: string;
  name: string;
  phone: string | null;
  scope: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  next_follow_up_at: string | null;
  stage_entered_at: string;
  owner: { id: string; name: string } | null;
  source: string;
  created_at: string;
  first_response_at: string | null;
  waiting_for_live: boolean;
};

export async function getBoardLeads(s: Session): Promise<BoardLead[]> {
  const rows = must(
    await s.db
      .from("leads")
      .select(
        "id, stage_id, scope, budget_min_cents, budget_max_cents, next_follow_up_at, stage_entered_at, source, created_at, first_response_at, waiting_for_live, contact:contacts(name, phone), owner:users(id, name)",
      )
      .order("next_follow_up_at", { ascending: true, nullsFirst: true }),
  );
  return rows.map((r) => ({
    id: r.id,
    stage_id: r.stage_id,
    name: r.contact?.name ?? "—",
    phone: r.contact?.phone ?? null,
    scope: r.scope,
    budget_min_cents: r.budget_min_cents,
    budget_max_cents: r.budget_max_cents,
    next_follow_up_at: r.next_follow_up_at,
    stage_entered_at: r.stage_entered_at,
    owner: r.owner,
    source: r.source,
    created_at: r.created_at,
    first_response_at: r.first_response_at,
    waiting_for_live: r.waiting_for_live,
  }));
}

export async function getLeadDetail(s: Session, leadId: string) {
  const lead = must(
    await s.db
      .from("leads")
      .select(
        "*, contact:contacts(*), stage:pipeline_stages(id, key, label), owner:users(id, name), lost_reason:lost_reasons(label), project:projects(id, name)",
      )
      .eq("id", leadId)
      .maybeSingle(),
  );
  if (!lead) notFound();

  const [activities, meetings] = await Promise.all([
    s.db
      .from("activities")
      .select("id, type, direction, summary, occurred_at, author:users(name)")
      .eq("lead_id", leadId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    s.db
      .from("meetings")
      .select("id, type, scheduled_at, status, notes")
      .eq("lead_id", leadId)
      .order("scheduled_at", { ascending: false }),
  ]);
  return { lead, activities: must(activities), meetings: must(meetings) };
}

/** Outbound touches since the lead entered its current stage → which follow-up rule is next. */
export async function countOutboundSince(s: Session, leadId: string, since: string) {
  const { count, error } = await s.db
    .from("activities")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .eq("direction", "out")
    .gte("occurred_at", since);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
