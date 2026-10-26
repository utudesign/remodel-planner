import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

/** One deal's job: project, milestones, tasks, costs + what's needed to show profit. */
export async function getJob(s: Session, dealId: string) {
  const { data: project } = await s.db
    .from("projects")
    .select("id, name, status, created_at")
    .eq("company_id", s.companyId)
    .eq("deal_id", dealId)
    .maybeSingle();
  if (!project) return null;
  const [milestones, tasks, costs, categories, people] = await Promise.all([
    s.db
      .from("job_milestones")
      .select("id, key, label, sort_order, planned_on, done_on")
      .eq("project_id", project.id)
      .order("sort_order")
      .then(must),
    s.db.from("tasks").select("id, title, status, due_date, assignee_id, created_at").eq("project_id", project.id).order("created_at").then(must),
    s.db.from("costs").select("id, category, vendor, actual_amount, paid_at").eq("project_id", project.id).then(must),
    s.db.from("job_cost_categories").select("key, label").eq("company_id", s.companyId).eq("active", true).order("sort_order").then(must),
    s.db.from("users").select("id, name, role").eq("company_id", s.companyId).eq("active", true).in("role", ["owner", "partner"]).then(must),
  ]);
  return { project, milestones, tasks, costs, categories, people };
}

export type JobListRow = {
  dealId: string;
  number: string;
  name: string;
  scope: string | null;
  origin: string;
  value: number;
  done: number;
  total: number;
  next: { label: string; planned_on: string | null } | null;
  late: number;
  startedOn: string;
  lastPlanned: string | null;
};

/** Every job, for the Jobs timeline page. */
export async function listJobs(s: Session): Promise<JobListRow[]> {
  const rows = must(
    await s.db
      .from("projects")
      .select(
        "id, created_at, deal:deals(id, deal_number, scope, origin, sold_price_cents, change_orders_cents, cancelled_at, deleted_at, title, contact:contacts(name)), milestones:job_milestones(label, sort_order, planned_on, done_on)",
      )
      .eq("company_id", s.companyId)
      .order("created_at", { ascending: false }),
  );
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter((r) => r.deal && !r.deal.deleted_at && !r.deal.cancelled_at)
    .map((r) => {
      const ms = [...(r.milestones ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      const open = ms.filter((m) => !m.done_on);
      const next = open[0] ?? null;
      const planned = ms.map((m) => m.planned_on).filter(Boolean) as string[];
      return {
        dealId: r.deal!.id,
        number: r.deal!.deal_number ?? "",
        name: r.deal!.contact?.name || r.deal!.title || "No name",
        scope: r.deal!.scope,
        origin: r.deal!.origin,
        value: (r.deal!.sold_price_cents ?? 0) + (r.deal!.change_orders_cents ?? 0),
        done: ms.length - open.length,
        total: ms.length,
        next: next ? { label: next.label, planned_on: next.planned_on } : null,
        late: open.filter((m) => m.planned_on && m.planned_on < today).length,
        startedOn: r.created_at.slice(0, 10),
        lastPlanned: planned.length ? planned.sort().at(-1)! : null,
      };
    });
}
