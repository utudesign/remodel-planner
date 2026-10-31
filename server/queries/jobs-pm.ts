import type { Session } from "@/lib/auth/require-role";
import type { PmTask, SiteRules, TaskStatus } from "@/lib/jobs/pm";
import { must } from "@/server/action-utils";

/**
 * Jobs project management (change request v3 items 13 + 15): every job with its phase tasks, the phase
 * template, trades, people and site rules. RLS decides what comes back (workspaces, 0016).
 */

const TASK_COLS =
  "id, project_id, title, phase_key, trade_key, assignee_id, status, pct, start_on, end_on, start_time, end_time, sort_order, notes";

type TaskRow = {
  id: string;
  project_id: string | null;
  title: string | null;
  phase_key: string | null;
  trade_key: string | null;
  assignee_id: string | null;
  status: string | null;
  pct: number;
  start_on: string | null;
  end_on: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  notes: string | null;
};

export type JobTask = PmTask & { notes: string | null };

function toTask(r: TaskRow): JobTask {
  return {
    id: r.id,
    project_id: r.project_id ?? "",
    title: r.title ?? "",
    phase_key: r.phase_key,
    trade_key: r.trade_key,
    assignee_id: r.assignee_id,
    status: (["todo", "doing", "blocked", "done"].includes(r.status ?? "") ? r.status : "todo") as TaskStatus,
    pct: r.pct ?? 0,
    start_on: r.start_on,
    end_on: r.end_on,
    start_time: r.start_time,
    end_time: r.end_time,
    sort_order: r.sort_order ?? 0,
    notes: r.notes,
  };
}

export function toRules(r: { building_type: string | null; hours: unknown; loud_until: string | null } | null): SiteRules | null {
  if (!r) return null;
  return { building_type: r.building_type, hours: (r.hours ?? {}) as SiteRules["hours"], loud_until: r.loud_until };
}

export async function getPmSetup(s: Session) {
  const [phases, trades, people] = await Promise.all([
    s.db
      .from("job_phase_templates")
      .select("key, label, trade_key, sort_order")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .order("sort_order")
      .then(must),
    s.db.from("trades").select("key, label, sort_order").eq("company_id", s.companyId).eq("active", true).order("sort_order").then(must),
    s.db
      .from("users")
      .select("id, name, role")
      .eq("company_id", s.companyId)
      .eq("active", true)
      .in("role", ["owner", "team", "partner", "crew"])
      .order("name")
      .then(must),
  ]);
  return {
    phases,
    trades,
    people: people.map((p) => ({ id: p.id, name: p.name ?? "No name", role: p.role })),
  };
}

export type BoardJob = {
  projectId: string;
  dealId: string;
  number: string;
  name: string;
  address: string | null;
  scope: string | null;
  tasks: JobTask[];
  rules: SiteRules | null;
};

/** Every open job (not cancelled, not deleted) with its tasks and site rules. */
export async function listPmJobs(s: Session): Promise<BoardJob[]> {
  const rows = must(
    await s.db
      .from("projects")
      .select(
        `id, status, closed_at, deal:deals(id, deal_number, scope, title, cancelled_at, deleted_at, contact:contacts(name, address, city)), tasks(${TASK_COLS})`,
      )
      .eq("company_id", s.companyId)
      .order("created_at", { ascending: false }),
  );
  const live = rows.filter((r) => r.deal && !r.deal.deleted_at && !r.deal.cancelled_at && !r.closed_at);
  const dealIds = live.map((r) => r.deal!.id);
  const rules = dealIds.length
    ? must(await s.db.from("site_rules").select("deal_id, building_type, hours, loud_until").in("deal_id", dealIds))
    : [];
  const rulesOf = new Map(rules.map((r) => [r.deal_id, toRules(r)]));
  return live.map((r) => ({
    projectId: r.id,
    dealId: r.deal!.id,
    number: r.deal!.deal_number ?? "",
    name: r.deal!.contact?.name || r.deal!.title || "No name",
    address: [r.deal!.contact?.address, r.deal!.contact?.city].filter(Boolean).join(", ") || null,
    scope: r.deal!.scope,
    tasks: ((r.tasks ?? []) as TaskRow[]).map(toTask).sort((a, b) => a.sort_order - b.sort_order),
    rules: rulesOf.get(r.deal!.id) ?? null,
  }));
}

/** One job: tasks + their comments (with photo urls resolved by the page). */
export async function getJobPm(s: Session, dealId: string) {
  const project = (
    await s.db.from("projects").select("id").eq("company_id", s.companyId).eq("deal_id", dealId).maybeSingle()
  ).data;
  if (!project) return null;
  const [tasks, comments] = await Promise.all([
    s.db.from("tasks").select(TASK_COLS).eq("project_id", project.id).order("sort_order").then(must),
    s.db
      .from("task_comments")
      .select("id, task_id, body, file_id, author_id, created_at, file:deal_files(storage_path)")
      .in(
        "task_id",
        (await s.db.from("tasks").select("id").eq("project_id", project.id).then(must)).map((t) => t.id),
      )
      .order("created_at")
      .then(must),
  ]);
  return {
    projectId: project.id,
    tasks: (tasks as TaskRow[]).map(toTask),
    comments: comments.map((c) => ({
      id: c.id,
      task_id: c.task_id,
      body: c.body,
      author_id: c.author_id,
      created_at: c.created_at,
      photo_path: c.file?.storage_path ?? null,
    })),
  };
}

export async function getSiteRules(s: Session, dealId: string) {
  return (
    await s.db
      .from("site_rules")
      .select("deal_id, building_type, hours, loud_until, hoa_contact, elevator, parking, debris, gate_code, pets, notes")
      .eq("deal_id", dealId)
      .maybeSingle()
  ).data;
}
