"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import {
  costSchema,
  paymentSchema,
  receivePaymentSchema,
  taskSchema,
} from "@/lib/validation/project";
import { formToObject, maybe, must, ok, run, type ActionState } from "@/server/action-utils";

const OFFICE = ["admin", "designer"] as const;

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/today");
  revalidatePath("/payments");
  revalidatePath("/analytics");
}

// ---------------------------------------------------------------- tasks
export async function saveTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = taskSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    const row = {
      title: v.title,
      description: v.description,
      kind: v.kind,
      status: v.status,
      priority: v.priority,
      milestone_id: v.milestone_id ?? null,
      assignee_id: v.assignee_id ?? null,
      trade: v.trade,
      due_date: v.due_date,
    };
    if (v.task_id) {
      ok(await s.db.from("tasks").update(row).eq("id", v.task_id));
    } else {
      const last = must(
        await s.db
          .from("tasks")
          .select("sort_order")
          .eq("project_id", v.project_id)
          .order("sort_order", { ascending: false })
          .limit(1),
      );
      ok(
        await s.db.from("tasks").insert({
          ...row,
          project_id: v.project_id,
          company_id: s.companyId,
          sort_order: (last[0]?.sort_order ?? 0) + 1,
        }),
      );
    }
    revalidate(v.project_id);
    return { ok: true, message: v.task_id ? "Task saved" : "Task added" };
  });
}

/** Status change from the task board/list. Field users can do this on their own projects (RLS). */
export async function setTaskStatus(input: {
  task_id: string;
  status: string;
}): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ task_id: z.uuid(), status: z.enum(["todo", "doing", "blocked", "done"]) })
      .parse(input);
    const s = await requireRole("admin", "designer", "field");
    const t = must(
      await s.db
        .from("tasks")
        .update({ status: v.status })
        .eq("id", v.task_id)
        .select("project_id, title")
        .single(),
    );
    if (v.status === "done" || v.status === "blocked") {
      // Shows in "Team updates" on Today, so the others see progress without a call.
      await s.db.from("activities").insert({
        company_id: s.companyId,
        project_id: t.project_id,
        type: "note",
        summary: `${v.status === "done" ? "Done" : "Blocked"}: ${t.title}`,
        created_by: s.userId,
      });
    }
    revalidate(t.project_id);
  });
}

export async function deleteTask(input: { task_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ task_id: z.uuid() }).parse(input);
    const s = await requireRole(...OFFICE);
    const t = must(
      await s.db.from("tasks").delete().eq("id", v.task_id).select("project_id").single(),
    );
    revalidate(t.project_id);
  });
}

// ---------------------------------------------------------------- payments
export async function receivePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = receivePaymentSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    const p = must(
      await s.db
        .from("payments")
        .update({
          status: "received",
          received_on: v.received_on,
          method: v.method,
          check_number: v.check_number,
          ...(v.amount ? { amount_cents: v.amount } : {}),
        })
        .eq("id", v.payment_id)
        .select("project_id, label")
        .single(),
    );
    await s.db.from("activities").insert({
      company_id: s.companyId,
      project_id: p.project_id,
      type: "system",
      summary: `Payment received: ${p.label}`,
      created_by: s.userId,
    });
    revalidate(p.project_id);
    return { ok: true, message: "Payment recorded" };
  });
}

export async function undoPayment(input: { payment_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ payment_id: z.uuid() }).parse(input);
    const s = await requireRole(...OFFICE);
    const p = must(
      await s.db
        .from("payments")
        .update({ status: "due", received_on: null, method: null, check_number: null })
        .eq("id", v.payment_id)
        .select("project_id")
        .single(),
    );
    revalidate(p.project_id);
  });
}

export async function savePayment(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = paymentSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    // With a manual due date (no milestone trigger), the installment is due now.
    const status = v.due_trigger ? undefined : "due";
    if (v.payment_id) {
      ok(
        await s.db
          .from("payments")
          .update({
            label: v.label,
            amount_cents: v.amount,
            due_trigger: v.due_trigger,
            due_date: v.due_date,
          })
          .eq("id", v.payment_id)
          .neq("status", "received"),
      );
    } else {
      const last = must(
        await s.db
          .from("payments")
          .select("sort_order")
          .eq("project_id", v.project_id)
          .order("sort_order", { ascending: false })
          .limit(1),
      );
      ok(
        await s.db.from("payments").insert({
          company_id: s.companyId,
          project_id: v.project_id,
          label: v.label,
          amount_cents: v.amount,
          due_trigger: v.due_trigger,
          due_date: v.due_date,
          status: status ?? "pending",
          sort_order: (last[0]?.sort_order ?? 0) + 1,
        }),
      );
    }
    revalidate(v.project_id);
    return { ok: true, message: "Installment saved" };
  });
}

export async function deletePayment(input: { payment_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ payment_id: z.uuid() }).parse(input);
    const s = await requireRole(...OFFICE);
    const p = maybe(
      await s.db
        .from("payments")
        .delete()
        .eq("id", v.payment_id)
        .neq("status", "received")
        .select("project_id")
        .maybeSingle(),
    );
    if (!p) throw new Error("Received payments can't be deleted. Use Undo first.");
    revalidate(p.project_id);
  });
}

// ---------------------------------------------------------------- costs
export async function saveCost(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = costSchema.parse(formToObject(fd));
    const s = await requireRole(...OFFICE);
    const row = {
      category_id: v.category_id,
      vendor: v.vendor,
      description: v.description,
      estimated_amount_cents: v.estimated ?? 0,
      actual_amount_cents: v.actual,
      paid_on: v.paid_on,
    };
    if (v.cost_id) ok(await s.db.from("costs").update(row).eq("id", v.cost_id));
    else
      ok(
        await s.db
          .from("costs")
          .insert({ ...row, project_id: v.project_id, company_id: s.companyId }),
      );
    revalidate(v.project_id);
    return { ok: true, message: "Cost saved" };
  });
}

export async function deleteCost(input: { cost_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ cost_id: z.uuid() }).parse(input);
    const s = await requireRole(...OFFICE);
    const c = must(
      await s.db.from("costs").delete().eq("id", v.cost_id).select("project_id").single(),
    );
    revalidate(c.project_id);
  });
}
