import { notFound } from "next/navigation";
import type { Session } from "@/lib/auth/require-role";
import { computeFinancials } from "@/lib/margin";
import { maybe, must } from "@/server/action-utils";

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

type BoardRow = {
  id: string;
  name: string;
  status: string;
  contract_value_cents: number | null;
  closed_at: string | null;
  locked_margin_bps: number | null;
  client: string;
  city: string | null;
  manager: { id: string; name: string } | null;
  milestones: MilestoneRow[];
  tasks: { status: string; kind: string }[];
  balanceDueCents: number | null;
  deal_year: number | null;
  deal_number: string | null;
};

/** Team: full rows incl. money. Crew: crew_projects view (no money) + separate reads. */
async function boardRows(s: Session): Promise<BoardRow[]> {
  if (s.role !== "crew") {
    const rows = must(
      await s.db
        .from("projects")
        .select(
          "id, name, status, contract_value_cents, closed_at, locked_margin_bps, deal:deals(deal_year, deal_number), contact:contacts(name, city), manager:users!projects_project_manager_id_fkey(id, name), milestones(id, key, name, sort_order, planned_date, actual_date), tasks(status, kind), payments(amount_cents, status), change_orders(price_change_cents, approved_at)",
        )
        .order("created_at", { ascending: false }),
    );
    return rows.map((p) => {
      const revenue =
        p.contract_value_cents +
        p.change_orders.filter((c) => c.approved_at).reduce((t, c) => t + c.price_change_cents, 0);
      const collected = p.payments
        .filter((x) => x.status === "received")
        .reduce((t, x) => t + x.amount_cents, 0);
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        contract_value_cents: p.contract_value_cents,
        closed_at: p.closed_at,
        locked_margin_bps: p.locked_margin_bps,
        client: p.contact?.name ?? "",
        city: p.contact?.city ?? null,
        manager: p.manager,
        milestones: p.milestones,
        tasks: p.tasks,
        balanceDueCents: revenue - collected,
        deal_year: p.deal?.deal_year ?? null,
        deal_number: p.deal?.deal_number ?? null,
      };
    });
  }
  const jobs = must(
    await s.db
      .from("crew_projects")
      .select("id, name, status, contact_id, project_manager_id, closed_at, deal_year, deal_number")
      .order("created_at", { ascending: false }),
  );
  const ids = jobs.map((j) => j.id!);
  const [ms, ts, contacts, team] = await Promise.all([
    s.db
      .from("milestones")
      .select("id, project_id, key, name, sort_order, planned_date, actual_date")
      .in("project_id", ids),
    s.db.from("tasks").select("project_id, status, kind").in("project_id", ids),
    s.db
      .from("contacts")
      .select("id, name, city")
      .in(
        "id",
        jobs.map((j) => j.contact_id!),
      ),
    s.db.from("users").select("id, name"),
  ]);
  const m = must(ms),
    t = must(ts),
    c = must(contacts),
    u = must(team);
  return jobs.map((j) => {
    const contact = c.find((x) => x.id === j.contact_id);
    const pm = u.find((x) => x.id === j.project_manager_id);
    return {
      id: j.id!,
      name: j.name!,
      status: j.status!,
      contract_value_cents: null,
      closed_at: j.closed_at,
      locked_margin_bps: null,
      client: contact?.name ?? "",
      city: contact?.city ?? null,
      manager: pm ? { id: pm.id, name: pm.name } : null,
      milestones: m.filter((x) => x.project_id === j.id),
      tasks: t.filter((x) => x.project_id === j.id),
      balanceDueCents: null,
      deal_year: j.deal_year,
      deal_number: j.deal_number,
    };
  });
}

export async function getBoardProjects(s: Session) {
  const rows = await boardRows(s);
  return rows.map((p) => ({
    ...p,
    current: currentMilestone(p.milestones),
    blocked: p.tasks.filter((t) => t.status === "blocked").length,
    openPunch: p.tasks.filter((t) => t.kind === "punch" && t.status !== "done").length,
  }));
}
export type BoardProject = Awaited<ReturnType<typeof getBoardProjects>>[number];

export async function getProjectDetail(s: Session, projectId: string) {
  const project =
    s.role === "crew" ? await crewProject(s, projectId) : await teamProject(s, projectId);
  if (!project) notFound();

  const office = s.role !== "crew";
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
async function teamProject(s: Session, projectId: string) {
  return maybe(
    await s.db
      .from("projects")
      .select(
        "*, contact:contacts(*), manager:users!projects_project_manager_id_fkey(id, name), deal:deals(id, deal_year, deal_number)",
      )
      .eq("id", projectId)
      .maybeSingle(),
  );
}

/** Crew shape: same keys the page reads, money fields zeroed (never sent to the browser). */
async function crewProject(s: Session, projectId: string) {
  const j = maybe(
    await s.db
      .from("crew_projects")
      .select("id, name, status, contact_id, project_manager_id, closed_at")
      .eq("id", projectId)
      .maybeSingle(),
  );
  if (!j) return null;
  const [contact, manager] = await Promise.all([
    maybe(await s.db.from("contacts").select("*").eq("id", j.contact_id!).maybeSingle()),
    j.project_manager_id
      ? maybe(
          await s.db.from("users").select("id, name").eq("id", j.project_manager_id).maybeSingle(),
        )
      : Promise.resolve(null),
  ]);
  return {
    id: j.id!,
    name: j.name!,
    status: j.status!,
    project_manager_id: j.project_manager_id,
    closed_at: j.closed_at,
    contract_value_cents: 0,
    locked_revenue_cents: null,
    locked_cost_cents: null,
    locked_margin_bps: null,
    contact,
    manager,
    deal: null as { id: string; deal_year: number; deal_number: string } | null,
  };
}

export type ProjectDetail = Awaited<ReturnType<typeof getProjectDetail>>;
