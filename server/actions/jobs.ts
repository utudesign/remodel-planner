"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { milestoneDealPatch } from "@/lib/jobs";
import { parseDollarsToCents } from "@/lib/money";
import { localToUtc, todayIn } from "@/lib/dates";
import { must, ok, run, type ActionState } from "@/server/action-utils";

/** Jobs (0013): the rep and Crystal both work them. */
const staff = () => requireRole("owner", "partner");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "pick a date");

async function dealOfProject(s: Session, projectId: string) {
  return must(
    await s.db
      .from("projects")
      .select("id, deal:deals(id, deal_number, job_status, deposit_received_at, paid_in_full_at, job_completed_at)")
      .eq("id", projectId)
      .eq("company_id", s.companyId)
      .single(),
  );
}

function done(number: string | null | undefined) {
  revalidatePath("/jobs");
  revalidatePath("/kpis");
  revalidatePath("/today");
  if (number) revalidatePath(`/deals/${number}`);
}

export async function startJob(input: { deal_id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ deal_id: z.uuid() }).parse(input);
    const s = await staff();
    const { error } = await s.db.rpc("start_job", { p_deal: v.deal_id });
    if (error) throw new Error(error.message);
    const { data } = await s.db.from("deals").select("deal_number").eq("id", v.deal_id).single();
    done(data?.deal_number);
    return { ok: true, message: "Job started" };
  });
}

/**
 * Plan or tick a milestone. Ticking the ones that mean something to the deal (signed, deposit,
 * ordered, installing, walkthrough, paid in full) also updates the deal's job fields, which
 * drive the commission (0006).
 */
export async function setMilestone(input: { id: string; planned_on?: string | null; done?: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), planned_on: ymd.nullable().optional(), done: z.boolean().optional() })
      .parse(input);
    const s = await staff();
    const m = must(
      await s.db.from("job_milestones").select("id, key, project_id, done_on").eq("id", v.id).eq("company_id", s.companyId).single(),
    );
    const today = todayIn(s.timezone);
    const patch: { planned_on?: string | null; done_on?: string | null } = {};
    if (v.planned_on !== undefined) patch.planned_on = v.planned_on;
    if (v.done !== undefined) patch.done_on = v.done ? (m.done_on ?? today) : null;
    ok(await s.db.from("job_milestones").update(patch).eq("id", m.id));

    const p = await dealOfProject(s, m.project_id);
    if (v.done && p.deal) {
      const at = localToUtc(today, "12:00", s.timezone).toISOString();
      const dealPatch = milestoneDealPatch(m.key, p.deal, at);
      if (Object.keys(dealPatch).length) ok(await s.db.from("deals").update(dealPatch).eq("id", p.deal.id));
    }
    done(p.deal?.deal_number);
  });
}

/** Push every open milestone from this one on by N days (delivery slipped, etc.). */
export async function shiftMilestones(input: { id: string; days: number }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), days: z.number().int().min(-120).max(120) }).parse(input);
    const s = await staff();
    const m = must(
      await s.db.from("job_milestones").select("project_id, sort_order").eq("id", v.id).eq("company_id", s.companyId).single(),
    );
    const later = must(
      await s.db
        .from("job_milestones")
        .select("id, planned_on")
        .eq("project_id", m.project_id)
        .gte("sort_order", m.sort_order)
        .is("done_on", null),
    );
    for (const x of later) {
      if (!x.planned_on) continue;
      const d = new Date(`${x.planned_on}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + v.days);
      ok(await s.db.from("job_milestones").update({ planned_on: d.toISOString().slice(0, 10) }).eq("id", x.id));
    }
    const p = await dealOfProject(s, m.project_id);
    done(p.deal?.deal_number);
    return { ok: true, message: `Moved ${later.length} dates ${v.days > 0 ? "later" : "earlier"} by ${Math.abs(v.days)} days` };
  });
}

export async function addTask(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        project_id: z.uuid(),
        title: z.string().trim().min(1, "say what needs doing").max(200),
        due_date: z.preprocess((x) => (x === "" ? null : x), ymd.nullable()),
        assignee_id: z.preprocess((x) => (x === "" ? null : x), z.uuid().nullable()),
      })
      .parse(Object.fromEntries(fd));
    const s = await staff();
    const p = await dealOfProject(s, v.project_id);
    ok(await s.db.from("tasks").insert({ project_id: p.id, title: v.title, due_date: v.due_date, assignee_id: v.assignee_id, status: "todo" }));
    done(p.deal?.deal_number);
    return { ok: true, message: "Task added" };
  });
}

export async function setTask(input: { id: string; done?: boolean; remove?: boolean }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid(), done: z.boolean().optional(), remove: z.boolean().optional() }).parse(input);
    const s = await staff();
    const t = must(await s.db.from("tasks").select("id, project_id").eq("id", v.id).single());
    const p = await dealOfProject(s, t.project_id!);
    if (v.remove) ok(await s.db.from("tasks").delete().eq("id", t.id));
    else ok(await s.db.from("tasks").update({ status: v.done ? "done" : "todo" }).eq("id", t.id));
    done(p.deal?.deal_number);
  });
}

export async function addCost(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        project_id: z.uuid(),
        category: z.string().regex(/^[a-z0-9_]{2,40}$/, "pick a category"),
        vendor: z.string().trim().max(120).optional().default(""),
        amount: z.string().transform((x, ctx) => {
          try {
            const c = parseDollarsToCents(x);
            if (!c || c <= 0) throw new Error("enter the amount");
            return c;
          } catch (e) {
            ctx.addIssue({ code: "custom", message: (e as Error).message });
            return z.NEVER;
          }
        }),
        paid_on: z.preprocess((x) => (x === "" ? null : x), ymd.nullable()),
      })
      .parse(Object.fromEntries(fd));
    const s = await staff();
    const p = await dealOfProject(s, v.project_id);
    ok(
      await s.db.from("costs").insert({
        project_id: p.id,
        category: v.category,
        vendor: v.vendor || null,
        actual_amount: v.amount,
        paid_at: v.paid_on ? localToUtc(v.paid_on, "12:00", s.timezone).toISOString() : null,
      }),
    );
    done(p.deal?.deal_number);
    return { ok: true, message: "Cost added" };
  });
}

export async function removeCost(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await staff();
    const c = must(await s.db.from("costs").select("id, project_id").eq("id", v.id).single());
    const p = await dealOfProject(s, c.project_id);
    ok(await s.db.from("costs").delete().eq("id", c.id));
    done(p.deal?.deal_number);
  });
}

