"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import {
  convertLeadSchema,
  milestoneDatesSchema,
  projectHeaderSchema,
} from "@/lib/validation/project";
import { formToObject, maybe, must, ok, run, type ActionState } from "@/server/action-utils";
import { z } from "zod";

const OFFICE = ["admin", "designer"] as const;

function revalidateProject(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/today");
  revalidatePath("/payments");
  revalidatePath("/analytics");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/** "Deposit received" → project + milestones + tasks + payment schedule, atomically (DB function). */
export async function convertLead(_: ActionState, fd: FormData): Promise<ActionState> {
  let projectId = "";
  const res = await run(async () => {
    const v = convertLeadSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    const items = v.payment_template_id
      ? must(
          await s.db
            .from("payment_template_items")
            .select("label, kind, percent_bps, amount_cents, due_trigger, sort_order")
            .eq("template_id", v.payment_template_id),
        )
      : [];
    const schedule = buildPaymentSchedule(
      v.contract_value,
      items.map((i) => ({ ...i, kind: i.kind as "percent" | "fixed" })),
    );
    projectId = must(
      await s.db.rpc("convert_lead_to_project", {
        p_lead_id: v.lead_id,
        p_name: v.name,
        p_contract_value_cents: v.contract_value,
        p_payment_template_id: v.payment_template_id as string,
        p_task_template_id: v.task_template_id as string,
        p_installments: schedule,
        p_deposit_received_on: v.received_on,
        p_deposit_method: v.method,
        p_deposit_check_number: v.check_number ?? "",
        p_planned_start_date: v.planned_start_date ?? undefined,
      }),
    );
    revalidateProject();
    revalidatePath("/leads");
    revalidatePath(`/leads/${v.lead_id}`);
  });
  if (res?.ok && projectId) redirect(`/projects/${projectId}`);
  return res;
}

/** Drag on the projects board. */
export async function moveProject(input: {
  project_id: string;
  milestone_key: string;
}): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ project_id: z.uuid(), milestone_key: z.string().min(1).max(60) })
      .parse(input);
    const s = await requireRole(...OFFICE);
    ok(
      await s.db.rpc("move_project_to_milestone", {
        p_project_id: v.project_id,
        p_milestone_key: v.milestone_key,
      }),
    );
    const m = maybe(
      await s.db
        .from("milestones")
        .select("name")
        .eq("project_id", v.project_id)
        .eq("key", v.milestone_key)
        .maybeSingle(),
    );
    await s.db.from("activities").insert({
      company_id: s.companyId,
      project_id: v.project_id,
      type: "note",
      summary: `Moved to ${m?.name ?? v.milestone_key}`,
      created_by: s.userId,
    });
    revalidateProject(v.project_id);
  });
}

export async function updateMilestoneDates(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = milestoneDatesSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    const m = must(
      await s.db
        .from("milestones")
        .update({ planned_date: v.planned_date, actual_date: v.actual_date })
        .eq("id", v.milestone_id)
        .select("project_id, name")
        .single(),
    );
    await s.db.from("activities").insert({
      company_id: s.companyId,
      project_id: m.project_id,
      type: "note",
      summary: v.actual_date
        ? `${m.name} done (${v.actual_date})`
        : `${m.name} planned for ${v.planned_date ?? "TBD"}`,
      created_by: s.userId,
    });
    revalidateProject(m.project_id);
    return { ok: true, message: "Dates saved" };
  });
}

export async function updateProjectHeader(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = projectHeaderSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    ok(
      await s.db
        .from("projects")
        .update({
          name: v.name,
          contract_value_cents: v.contract_value,
          project_manager_id: v.project_manager_id,
        })
        .eq("id", v.project_id),
    );
    revalidateProject(v.project_id);
    return { ok: true, message: "Saved" };
  });
}

export async function closeProject(input: { project_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ project_id: z.uuid() }).parse(input);
    const s = await requireRole("admin");
    ok(await s.db.rpc("close_project", { p_project_id: v.project_id }));
    revalidateProject(v.project_id);
    return { ok: true, message: "Project closed. Margin locked." };
  });
}

export async function setProjectMembers(input: {
  project_id: string;
  user_ids: string[];
}): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ project_id: z.uuid(), user_ids: z.array(z.uuid()).max(50) }).parse(input);
    const s = await requireRole(...OFFICE);
    ok(await s.db.from("project_members").delete().eq("project_id", v.project_id));
    if (v.user_ids.length) {
      ok(
        await s.db.from("project_members").insert(
          v.user_ids.map((user_id) => ({
            project_id: v.project_id,
            user_id,
            company_id: s.companyId,
          })),
        ),
      );
    }
    revalidateProject(v.project_id);
  });
}
