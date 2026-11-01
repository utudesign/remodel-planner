"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { classifyFile } from "@/lib/files/types";
import { uploadDealFiles } from "@/lib/storage";
import { must, ok, run, type ActionState } from "@/server/action-utils";

/**
 * Jobs project management (change request v3 items 13 + 15). Owner + team; crew comes in batch F1.
 * RLS (can_see_project / can_see_deal, 0016) limits every query to jobs this person may see.
 */
const staff = () => requireRole("owner", "team", "partner");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const optional = <T extends z.ZodTypeAny>(t: T) => z.preprocess((x) => (x === "" ? null : x), t.nullable());

async function taskRef(s: Session, taskId: string) {
  const t = must(
    await s.db
      .from("tasks")
      .select("id, project_id, sort_order, phase_key, project:projects(id, deal:deals(id, company_id, deal_year, deal_number))")
      .eq("id", taskId)
      .eq("company_id", s.companyId)
      .single(),
  );
  return { ...t, number: t.project?.deal?.deal_number ?? null };
}

async function projectRef(s: Session, projectId: string) {
  const p = must(
    await s.db
      .from("projects")
      .select("id, deal:deals(id, deal_number)")
      .eq("id", projectId)
      .eq("company_id", s.companyId)
      .single(),
  );
  return { id: p.id, number: p.deal?.deal_number ?? null };
}

function refresh(number: string | null) {
  revalidatePath("/jobs");
  revalidatePath("/today");
  if (number) revalidatePath(`/deals/${number}`);
}

const taskPatch = z
  .object({
    id: z.uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    assignee_id: z.uuid().nullable().optional(),
    trade_key: z.string().regex(/^[a-z0-9_]{2,30}$/).nullable().optional(),
    phase_key: z.string().regex(/^[a-z0-9_]{2,40}$/).nullable().optional(),
    status: z.enum(["todo", "doing", "blocked", "done"]).optional(),
    pct: z.number().int().min(0).max(100).optional(),
    start_on: ymd.nullable().optional(),
    end_on: ymd.nullable().optional(),
    start_time: hhmm.nullable().optional(),
    end_time: hhmm.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((v) => !v.start_on || !v.end_on || v.end_on >= v.start_on, { message: "End date is before the start date" });

/** Any task field: assignee, trade, phase, status, %, dates, times, notes. The database keeps % and status in step. */
export async function updateTask(input: z.input<typeof taskPatch>): Promise<ActionState> {
  return run(async () => {
    const v = taskPatch.parse(input);
    const s = await staff();
    const t = await taskRef(s, v.id);
    const { id: _id, ...patch } = v;
    void _id;
    if (patch.assignee_id) {
      must(await s.db.from("users").select("id").eq("id", patch.assignee_id).eq("company_id", s.companyId).single());
    }
    ok(await s.db.from("tasks").update(patch).eq("id", t.id));
    refresh(t.number);
  });
}

/** Add a task to a job (optionally inside a phase, placed at the end of it). */
export async function addPmTask(input: { project_id: string; title: string; phase_key?: string | null }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        project_id: z.uuid(),
        title: z.string().trim().min(1, "say what needs doing").max(200),
        phase_key: z.string().regex(/^[a-z0-9_]{2,40}$/).nullable().optional(),
      })
      .parse(input);
    const s = await staff();
    const p = await projectRef(s, v.project_id);
    const tasks = must(await s.db.from("tasks").select("sort_order, phase_key, trade_key, start_on, end_on").eq("project_id", p.id));
    const inPhase = tasks.filter((t) => v.phase_key && t.phase_key === v.phase_key);
    const after = inPhase.length ? Math.max(...inPhase.map((t) => t.sort_order)) : Math.max(0, ...tasks.map((t) => t.sort_order));
    // Shift the tasks after it by one so the new task sits at the end of its phase.
    for (const t of must(await s.db.from("tasks").select("id, sort_order").eq("project_id", p.id).gt("sort_order", after))) {
      ok(await s.db.from("tasks").update({ sort_order: t.sort_order + 1 }).eq("id", t.id));
    }
    ok(
      await s.db.from("tasks").insert({
        project_id: p.id,
        company_id: s.companyId,
        title: v.title,
        phase_key: v.phase_key ?? null,
        trade_key: inPhase[0]?.trade_key ?? null,
        start_on: inPhase[0]?.start_on ?? null,
        end_on: inPhase[0]?.end_on ?? null,
        status: "todo",
        sort_order: after + 1,
      }),
    );
    refresh(p.number);
    return { ok: true, message: "Task added" };
  });
}

export async function deleteTask(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await staff();
    const t = await taskRef(s, v.id);
    ok(await s.db.from("tasks").delete().eq("id", t.id));
    refresh(t.number);
  });
}

/** Move a task one place up or down (swaps order with its neighbour). */
export async function moveTask(input: { id: string; dir: "up" | "down" }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), dir: z.enum(["up", "down"]) }).parse(input);
    const s = await staff();
    const t = await taskRef(s, v.id);
    const all = must(await s.db.from("tasks").select("id, sort_order, phase_key").eq("project_id", t.project_id!).order("sort_order"));
    const i = all.findIndex((x) => x.id === t.id);
    const j = v.dir === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return;
    const a = all[i];
    const b = all[j];
    const [sa, sb] = a.sort_order === b.sort_order ? [b.sort_order + (v.dir === "up" ? -1 : 1), a.sort_order] : [b.sort_order, a.sort_order];
    ok(await s.db.from("tasks").update({ sort_order: sa, phase_key: b.phase_key }).eq("id", a.id));
    ok(await s.db.from("tasks").update({ sort_order: sb }).eq("id", b.id));
    refresh(t.number);
  });
}

/** Board drag: the job is now in this phase (earlier phases done, this one doing). */
export async function moveJobToPhase(input: { project_id: string; phase_key: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ project_id: z.uuid(), phase_key: z.string().regex(/^[a-z0-9_]{2,40}$/) }).parse(input);
    const s = await staff();
    const p = await projectRef(s, v.project_id);
    ok(await s.db.rpc("move_job_to_phase", { p_project: p.id, p_phase: v.phase_key }));
    refresh(p.number);
  });
}

/** Comment on a task, optionally with a photo (filed in the deal's Photos as progress / issue). */
export async function addTaskComment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        task_id: z.uuid(),
        body: z.string().trim().max(2000).optional().default(""),
        tag: z.enum(["progress", "issue"]).default("progress"),
      })
      .parse({ task_id: fd.get("task_id"), body: fd.get("body") ?? "", tag: fd.get("tag") || "progress" });
    const s = await staff();
    const t = await taskRef(s, v.task_id);
    const photo = fd.get("photo");
    let fileId: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      if (classifyFile(photo.name, photo.type).kind !== "photo") throw new Error("Photos only (JPEG, PNG, HEIC)");
      const deal = t.project?.deal;
      if (!deal) throw new Error("This job has no deal");
      const [path] = await uploadDealFiles(
        s.db,
        { id: deal.id, company_id: deal.company_id, deal_year: deal.deal_year!, deal_number: deal.deal_number! },
        [photo],
        { folder: "photos", photoTag: v.tag === "issue" ? "issue" : "completion", title: v.body.slice(0, 80) || "Task photo" },
      );
      fileId = must(await s.db.from("deal_files").select("id").eq("storage_path", path).single()).id;
    }
    if (!v.body && !fileId) throw new Error("Write something or add a photo");
    ok(await s.db.from("task_comments").insert({ company_id: s.companyId, task_id: t.id, body: v.body, file_id: fileId }));
    refresh(t.number);
    return { ok: true, message: "Added" };
  });
}

const rulesSchema = z.object({
  deal_id: z.uuid(),
  building_type: z.enum(["house", "condo", "townhouse", "apartment", "other"]).nullable(),
  hours: z.record(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]), z.object({ start: hhmm, end: hhmm }).refine((h) => h.end > h.start, "End before start")),
  loud_until: hhmm.nullable(),
  hoa_contact: optional(z.string().trim().max(300)),
  elevator: optional(z.string().trim().max(300)),
  parking: optional(z.string().trim().max(300)),
  debris: optional(z.string().trim().max(300)),
  gate_code: optional(z.string().trim().max(100)),
  pets: optional(z.string().trim().max(300)),
  notes: optional(z.string().trim().max(1000)),
});

/** Site rules (item 15): one row per deal; its job and the workers read the same row. */
export async function saveSiteRules(input: z.input<typeof rulesSchema>): Promise<ActionState> {
  return run(async () => {
    const v = rulesSchema.parse(input);
    const s = await staff();
    const d = must(await s.db.from("deals").select("id, deal_number").eq("id", v.deal_id).eq("company_id", s.companyId).single());
    ok(await s.db.from("site_rules").upsert({ ...v, company_id: s.companyId }, { onConflict: "deal_id" }));
    refresh(d.deal_number);
    return { ok: true, message: "Site rules saved" };
  });
}
