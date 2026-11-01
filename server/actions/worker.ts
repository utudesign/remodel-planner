"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { classifyFile } from "@/lib/files/types";
import { uploadDealFiles } from "@/lib/storage";
import { must, ok, run, type ActionState } from "@/server/action-utils";

/**
 * Worker actions (v3 F1). Crew change only % / status of their own tasks (0022 worker_update_task)
 * and add comments + photos on their jobs. The database refuses anything else.
 */

export async function setMyTask(input: { id: string; pct?: number; status?: "todo" | "doing" | "blocked" | "done" }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), pct: z.number().int().min(0).max(100).optional(), status: z.enum(["todo", "doing", "blocked", "done"]).optional() })
      .parse(input);
    const s = await requireRole("crew");
    ok(await s.db.rpc("worker_update_task", { p_task: v.id, p_pct: v.pct, p_status: v.status }));
    revalidatePath("/work", "layout");
  });
}

export async function addWorkerComment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        task_id: z.uuid(),
        project_id: z.uuid(),
        body: z.string().trim().max(2000).optional().default(""),
        tag: z.enum(["progress", "issue"]).default("progress"),
      })
      .parse({ task_id: fd.get("task_id"), project_id: fd.get("project_id"), body: fd.get("body") ?? "", tag: fd.get("tag") || "progress" });
    const s = await requireRole("crew");
    const job = must(
      await s.db.from("job_worker_view").select("deal_id, deal_year, deal_number").eq("project_id", v.project_id).single(),
    );
    // the task must be on this job (the database checks it's one of my jobs)
    must(await s.db.from("job_worker_tasks").select("id").eq("id", v.task_id).eq("project_id", v.project_id).single());
    const photo = fd.get("photo");
    let fileId: string | null = null;
    if (photo instanceof File && photo.size > 0) {
      if (classifyFile(photo.name, photo.type).kind !== "photo") throw new Error("Photos only (JPEG, PNG, HEIC)");
      const [path] = await uploadDealFiles(
        s.db,
        { id: job.deal_id!, company_id: s.companyId, deal_year: job.deal_year!, deal_number: job.deal_number! },
        [photo],
        { folder: "photos", photoTag: v.tag === "issue" ? "issue" : "completion", title: v.body.slice(0, 80) || "Job photo" },
      );
      fileId = must(await s.db.from("deal_files").select("id").eq("storage_path", path).single()).id;
    }
    if (!v.body && !fileId) throw new Error("Write something or add a photo");
    ok(await s.db.from("task_comments").insert({ company_id: s.companyId, task_id: v.task_id, body: v.body, file_id: fileId }));
    revalidatePath(`/work/${v.project_id}`);
    return { ok: true, message: "Sent to the office" };
  });
}
