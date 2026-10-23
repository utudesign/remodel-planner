import { notFound } from "next/navigation";
import type { Session } from "@/lib/auth/require-role";
import { computeFinancials } from "@/lib/margin";
import { must } from "@/server/action-utils";

export type MilestoneRow = {
  id: string;
  key: string;
  name: string;
  sort_order: number;
  planned_date: string | null;
  actual_date: string | null;
};

/** The board column: first milestone not done yet (closed projects → "closed"). */
export function currentMilestone(ms: MilestoneRow[]): MilestoneRow | null {
  return [...ms].sort((a, b) => a.sort_order - b.sort_order).find((m) => !m.actual_date) ?? null;
}

export async function getBoardProjects(s: Session) {
  const rows = must(
    await s.db
      .from("projects")
      .select(
        "id, name, status, contract_value_cents, closed_at, locked_margin_bps, contact:contacts(name, city), milestones(id, key, name, sort_order, planned_date, actual_date), tasks(status, kind)",
      )
      .order("created_at", { ascending: false }),
  );
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    client: p.contact?.name ?? "",
    city: p.contact?.city ?? null,
    contract_value_cents: p.contract_value_cents,
    closed_at: p.closed_at,
    locked_margin_bps: p.locked_margin_bps,
    milestones: p.milestones,
    current: currentMilestone(p.milestones),
    blocked: p.tasks.filter((t) => t.status === "blocked").length,
    openPunch: p.tasks.filter((t) => t.kind === "punch" && t.status !== "done").length,
  }));
}
export type BoardProject = Awaited<ReturnType<typeof getBoardProjects>>[number];

export async function getProjectDetail(s: Session, projectId: string) {
  const project = must(
    await s.db
      .from("projects")
      .select(
        "*, contact:contacts(*), manager:users!projects_project_manager_id_fkey(id, name), lead:leads(id)",
      )
      .eq("id", projectId)
      .maybeSingle(),
  );
  if (!project) notFound();

  const office = s.role !== "field";
  const [milestones, tasks, members, payments, costs, changeOrders] = await Promise.all([
    s.db
      .from("milestones")
      .select("id, key, name, sort_order, planned_date, actual_date")
      .eq("project_id", projectId)
      .order("sort_order"),
    s.db
      .from("tasks")
      .select(
        "id, title, description, status, kind, priority, due_date, trade, sort_order, milestone_id, assignee:users(id, name)",
      )
      .eq("project_id", projectId)
      .order("sort_order"),
    s.db.from("project_members").select("user_id").eq("project_id", projectId),
    office
      ? s.db
          .from("payments")
          .select(
            "id, label, amount_cents, due_trigger, due_date, received_on, method, check_number, status, sort_order",
          )
          .eq("project_id", projectId)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    office
      ? s.db
          .from("costs")
          .select(
            "id, category_id, vendor, description, estimated_amount_cents, actual_amount_cents, paid_on, category:cost_categories(label, sort_order)",
          )
          .eq("project_id", projectId)
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
    office
      ? s.db
          .from("change_orders")
          .select("price_change_cents, cost_change_cents, approved_at")
          .eq("project_id", projectId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const p = must(payments);
  const c = must(costs);
  const co = must(changeOrders);
  const financials = computeFinancials({
    contract_value_cents: project.contract_value_cents,
    change_orders: co,
    costs: c,
    payments: p,
    locked:
      project.status === "closed"
        ? {
            revenue_cents: project.locked_revenue_cents,
            cost_cents: project.locked_cost_cents,
            margin_bps: project.locked_margin_bps,
          }
        : null,
  });

  return {
    project,
    milestones: must(milestones),
    tasks: must(tasks),
    memberIds: must(members).map((m) => m.user_id),
    payments: p,
    costs: c,
    financials,
  };
}
export type ProjectDetail = Awaited<ReturnType<typeof getProjectDetail>>;
