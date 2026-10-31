"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { classifyFile } from "@/lib/files/types";
import { uploadDealFiles } from "@/lib/storage";
import { must, ok, run, type ActionState } from "@/server/action-utils";
import { flushNotifications } from "@/server/push";

/**
 * The 60-second daily report (v3 F3). FormData: project_id, payload (JSON: progress, issues, tomorrow, note),
 * photo_0..photo_9 for the issues. Photos are stored on the job's deal first; then submit_daily_report()
 * (0023) updates the tasks, saves the report + issues and tells the office in one transaction.
 */
const payloadSchema = z.object({
  progress: z.array(z.object({ task_id: z.uuid(), pct: z.number().int().min(0).max(100) })).max(60),
  issues: z
    .array(
      z.object({
        type: z.string().regex(/^[a-z0-9_]{2,40}$/),
        note: z.string().trim().max(1000),
        needs_reorder: z.boolean(),
        photo: z.number().int().min(0).max(9).nullable(),
      }),
    )
    .max(10),
  tomorrow: z.string().trim().max(1000),
  note: z.string().trim().max(2000).optional().default(""),
});

export async function submitDailyReport(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const projectId = z.uuid().parse(fd.get("project_id"));
    const v = payloadSchema.parse(JSON.parse(String(fd.get("payload") ?? "{}")));
    const s = await requireRole("crew", "owner", "team", "partner");
    for (const i of v.issues) if (!i.note && i.photo === null) throw new Error("Each issue needs a note or a photo");

    let fileIds: (string | null)[] = v.issues.map(() => null);
    if (v.issues.some((i) => i.photo !== null)) {
      const job =
        s.role === "crew"
          ? must(await s.db.from("job_worker_view").select("deal_id, deal_year, deal_number").eq("project_id", projectId).single())
          : must(
              await s.db
                .from("projects")
                .select("deal:deals(id, deal_year, deal_number)")
                .eq("id", projectId)
                .eq("company_id", s.companyId)
                .single(),
            ).deal;
      const deal =
        job && "deal_id" in job
          ? { id: job.deal_id!, deal_year: job.deal_year!, deal_number: job.deal_number! }
          : (job as { id: string; deal_year: number; deal_number: string } | null);
      if (!deal) throw new Error("This job has no deal");
      fileIds = [];
      for (const i of v.issues) {
        const f = i.photo === null ? null : fd.get(`photo_${i.photo}`);
        if (!(f instanceof File) || f.size === 0) {
          fileIds.push(null);
          continue;
        }
        if (classifyFile(f.name, f.type).kind !== "photo") throw new Error("Photos only (JPEG, PNG, HEIC)");
        const [path] = await uploadDealFiles(
          s.db,
          { id: deal.id, company_id: s.companyId, deal_year: deal.deal_year, deal_number: deal.deal_number },
          [f],
          { folder: "photos", photoTag: "issue", title: i.note.slice(0, 80) || "Issue photo" },
        );
        fileIds.push(must(await s.db.from("deal_files").select("id").eq("storage_path", path).single()).id);
      }
    }
    ok(
      await s.db.rpc("submit_daily_report", {
        p_project: projectId,
        p_progress: v.progress,
        p_issues: v.issues.map((i, k) => ({ type: i.type, note: i.note, needs_reorder: i.needs_reorder, file_id: fileIds[k] })),
        p_tomorrow: v.tomorrow || null,
        p_note: v.note || undefined,
      }),
    );
    after(() => flushNotifications(s.companyId).catch(() => undefined));
    revalidatePath("/work", "layout");
    revalidatePath("/today");
    return { ok: true, message: "Report sent. Thanks!" };
  });
}

export async function resolveIssue(input: { id: string; resolved: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), resolved: z.boolean() }).parse(input);
    const s = await requireRole("owner", "team", "partner");
    ok(
      await s.db
        .from("daily_report_issues")
        .update({ resolved_at: v.resolved ? new Date().toISOString() : null })
        .eq("id", v.id)
        .eq("company_id", s.companyId),
    );
    revalidatePath("/deals", "layout");
    revalidatePath("/today");
  });
}
