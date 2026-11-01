import type { Session } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";
import { signedUrls } from "@/lib/storage";

/**
 * Worker + customer reads (v3 F1, 0022). Only the money-free views: job_worker_* for crew,
 * job_customer_* for customers. The views filter to the signed-in person's own jobs.
 */

export type WorkerJob = {
  project_id: string;
  deal_id: string;
  deal_number: string;
  deal_year: number;
  name: string;
  client_name: string | null;
  client_phone: string | null;
  address: string | null;
  city: string | null;
  zip: string | null;
  start_date: string | null;
  pct: number;
  current_phase: string | null;
  manager_name: string | null;
};

export type WorkerTask = {
  id: string;
  project_id: string;
  title: string;
  phase_key: string | null;
  status: "todo" | "doing" | "blocked" | "done";
  pct: number;
  start_on: string | null;
  end_on: string | null;
  start_time: string | null;
  end_time: string | null;
  sort_order: number;
  notes: string | null;
  assignee_name: string | null;
  mine: boolean;
};

const st = (v: string | null): WorkerTask["status"] =>
  v === "doing" || v === "blocked" || v === "done" ? v : "todo";

function toJob(r: Record<string, unknown>): WorkerJob {
  return {
    project_id: String(r.project_id),
    deal_id: String(r.deal_id),
    deal_number: String(r.deal_number ?? ""),
    deal_year: Number(r.deal_year ?? 0),
    name: String(r.name ?? "Job"),
    client_name: (r.client_name as string) ?? null,
    client_phone: (r.client_phone as string) ?? null,
    address: (r.address as string) ?? null,
    city: (r.city as string) ?? null,
    zip: (r.zip as string) ?? null,
    start_date: (r.start_date as string) ?? null,
    pct: Number(r.pct ?? 0),
    current_phase: (r.current_phase as string) ?? null,
    manager_name: (r.manager_name as string) ?? null,
  };
}

function toTask(r: Record<string, unknown>): WorkerTask {
  return {
    id: String(r.id),
    project_id: String(r.project_id),
    title: String(r.title ?? ""),
    phase_key: (r.phase_key as string) ?? null,
    status: st((r.status as string) ?? null),
    pct: Number(r.pct ?? 0),
    start_on: (r.start_on as string) ?? null,
    end_on: (r.end_on as string) ?? null,
    start_time: (r.start_time as string) ?? null,
    end_time: (r.end_time as string) ?? null,
    sort_order: Number(r.sort_order ?? 0),
    notes: (r.notes as string) ?? null,
    assignee_name: (r.assignee_name as string) ?? null,
    mine: Boolean(r.mine),
  };
}

export async function listWorkerJobs(s: Session) {
  const [jobs, tasks, phases] = await Promise.all([
    s.db.from("job_worker_view").select("*").order("start_date", { nullsFirst: false }).then(must),
    s.db.from("job_worker_tasks").select("*").order("sort_order").then(must),
    s.db.from("job_phase_templates").select("key, label, sort_order").eq("company_id", s.companyId).then(must),
  ]);
  return { jobs: jobs.map(toJob), tasks: tasks.map(toTask), phases };
}

export async function getWorkerJob(s: Session, projectId: string) {
  const [job, tasks, visit, phases] = await Promise.all([
    s.db.from("job_worker_view").select("*").eq("project_id", projectId).maybeSingle().then(must),
    s.db.from("job_worker_tasks").select("*").eq("project_id", projectId).order("sort_order").then(must),
    s.db.from("job_worker_visit").select("*").eq("project_id", projectId).order("visited_at", { ascending: false }).limit(1).then(must),
    s.db.from("job_phase_templates").select("key, label, sort_order").eq("company_id", s.companyId).then(must),
  ]);
  if (!job) return null;
  const j = toJob(job);
  const taskIds = tasks.map((t) => String(t.id));
  const [rules, comments, photos] = await Promise.all([
    s.db
      .from("site_rules")
      .select("building_type, hours, loud_until, hoa_contact, elevator, parking, debris, gate_code, pets, notes")
      .eq("deal_id", j.deal_id)
      .maybeSingle()
      .then(must),
    taskIds.length
      ? s.db
          .from("task_comments")
          .select("id, task_id, body, created_at, author:users(name), file:deal_files(storage_path)")
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
          .limit(60)
          .then(must)
      : Promise.resolve([]),
    s.db
      .from("deal_files")
      .select("id, storage_path, photo_tag, title, created_at")
      .eq("deal_id", j.deal_id)
      .eq("folder", "photos")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(24)
      .then(must),
  ]);
  const paths = [
    ...photos.map((p) => p.storage_path),
    ...comments.map((c) => (c.file as { storage_path: string } | null)?.storage_path).filter((p): p is string => !!p),
  ];
  const urls = await signedUrls(paths, s.companyId);
  return {
    job: j,
    tasks: tasks.map(toTask),
    visit: visit[0] ?? null,
    phases,
    rules,
    comments: comments.map((c) => ({
      id: c.id,
      task_id: c.task_id,
      body: c.body,
      created_at: c.created_at,
      author: (c.author as { name: string | null } | null)?.name ?? null,
      photo: urls[(c.file as { storage_path: string } | null)?.storage_path ?? ""] ?? null,
    })),
    photos: photos.map((p) => ({ id: p.id, url: urls[p.storage_path] ?? null, tag: p.photo_tag, title: p.title })),
  };
}

export async function getCustomerJobs(s: Session) {
  const [jobs, tasks, payments] = await Promise.all([
    s.db.from("job_customer_view").select("*").order("start_date", { ascending: false }).then(must),
    s.db.from("job_customer_tasks").select("*").order("sort_order").then(must),
    s.db.from("job_customer_payments").select("*").order("sort_order").then(must),
  ]);
  return { jobs, tasks, payments };
}
