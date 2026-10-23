"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/require-role";
import {
  companySchema,
  followUpRulesSchema,
  lookupRowsSchema,
  memberSchema,
  paymentTemplateSchema,
  slugify,
  taskTemplateSchema,
} from "@/lib/validation/settings";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";
import { z } from "zod";

/** Stages the app's logic depends on (lead creation, reopen, booking, convert, lost). */
const SYSTEM_STAGES = ["new", "contacted", "meeting_booked", "won", "lost"];

function done(path: string, message = "Saved"): ActionState {
  revalidatePath(path);
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Stages, lost reasons, cost categories: label / order / active. Keys are stable once created. */
export async function saveLookupRows(
  input: z.input<typeof lookupRowsSchema>,
): Promise<ActionState> {
  return run(async () => {
    const v = lookupRowsSchema.parse(input);
    const s = await requireRole("owner");
    const existing = must(await s.db.from(v.table).select("id, key"));
    const keys = new Set(existing.map((r) => r.key));
    const keyById = new Map(existing.map((r) => [r.id, r.key]));
    for (const r of v.rows) {
      if (
        v.table === "pipeline_stages" &&
        r.id &&
        !r.active &&
        SYSTEM_STAGES.includes(keyById.get(r.id) ?? "")
      ) {
        throw new Error(
          `"${r.label}" is a built-in stage the app relies on. Rename it instead of hiding it.`,
        );
      }
      if (r.id) {
        ok(
          await s.db
            .from(v.table)
            .update({ label: r.label, sort_order: r.sort_order, active: r.active })
            .eq("id", r.id),
        );
      } else {
        let key = slugify(r.label);
        while (keys.has(key)) key = `${key}_${Math.floor(Math.random() * 1000)}`;
        keys.add(key);
        ok(
          await s.db.from(v.table).insert({
            company_id: s.companyId,
            key,
            label: r.label,
            sort_order: r.sort_order,
            active: r.active,
          }),
        );
      }
    }
    return done("/settings");
  });
}

export async function saveFollowUpRules(
  input: z.input<typeof followUpRulesSchema>,
): Promise<ActionState> {
  return run(async () => {
    const v = followUpRulesSchema.parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from("follow_up_rules").delete().eq("stage_id", v.stage_id));
    if (v.rules.length) {
      ok(
        await s.db.from("follow_up_rules").insert(
          v.rules.map((r, i) => ({
            ...r,
            sequence: i + 1,
            stage_id: v.stage_id,
            company_id: s.companyId,
          })),
        ),
      );
    }
    return done("/settings/pipeline");
  });
}

export async function savePaymentTemplate(
  input: z.input<typeof paymentTemplateSchema>,
): Promise<ActionState> {
  return run(async () => {
    const v = paymentTemplateSchema.parse(input);
    const s = await requireRole("owner");
    let templateId = v.id;
    if (templateId) {
      ok(
        await s.db
          .from("payment_templates")
          .update({ name: v.name, active: v.active })
          .eq("id", templateId),
      );
      ok(await s.db.from("payment_template_items").delete().eq("template_id", templateId));
    } else {
      templateId = must(
        await s.db
          .from("payment_templates")
          .insert({ company_id: s.companyId, name: v.name, active: v.active, sort_order: 99 })
          .select("id")
          .single(),
      ).id;
    }
    ok(
      await s.db.from("payment_template_items").insert(
        v.items.map((i, idx) => ({
          company_id: s.companyId,
          template_id: templateId!,
          label: i.label,
          kind: i.kind,
          percent_bps: i.kind === "percent" ? i.percent_bps : null,
          amount_cents: i.kind === "fixed" ? i.amount_cents : null,
          due_trigger: idx === 0 ? "deposit_received" : i.due_trigger,
          sort_order: idx + 1,
        })),
      ),
    );
    return done("/settings/templates");
  });
}

export async function saveTaskTemplate(
  input: z.input<typeof taskTemplateSchema>,
): Promise<ActionState> {
  return run(async () => {
    const v = taskTemplateSchema.parse(input);
    const s = await requireRole("owner");
    let templateId = v.id;
    if (v.is_default)
      ok(
        await s.db
          .from("task_templates")
          .update({ is_default: false })
          .eq("company_id", s.companyId),
      );
    if (templateId) {
      ok(
        await s.db
          .from("task_templates")
          .update({ name: v.name, is_default: v.is_default, active: v.active })
          .eq("id", templateId),
      );
      ok(await s.db.from("task_template_items").delete().eq("template_id", templateId));
    } else {
      templateId = must(
        await s.db
          .from("task_templates")
          .insert({
            company_id: s.companyId,
            name: v.name,
            is_default: v.is_default,
            active: v.active,
          })
          .select("id")
          .single(),
      ).id;
    }
    if (v.items.length) {
      ok(
        await s.db.from("task_template_items").insert(
          v.items.map((i, idx) => ({
            ...i,
            company_id: s.companyId,
            template_id: templateId!,
            sort_order: idx + 1,
          })),
        ),
      );
    }
    return done("/settings/templates");
  });
}

export async function saveMember(input: z.input<typeof memberSchema>): Promise<ActionState> {
  return run(async () => {
    const v = memberSchema.parse(input);
    const s = await requireRole("owner");
    if (v.user_id === s.userId && (v.role !== "owner" || !v.active)) {
      throw new Error("You can't remove your own owner access. Ask the other owner.");
    }
    if (v.is_default_owner) {
      ok(
        await s.db
          .from("users")
          .update({ is_default_owner: false })
          .eq("company_id", s.companyId)
          .neq("id", v.user_id),
      );
    }
    ok(
      await s.db
        .from("users")
        .update({
          role: v.role,
          active: v.active,
          is_default_owner: v.is_default_owner,
          phone: v.phone,
        })
        .eq("id", v.user_id),
    );
    return done("/settings/team");
  });
}

export async function saveCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = companySchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const current = must(
      await s.db.from("companies").select("settings_json").eq("id", s.companyId).single(),
    );
    ok(
      await s.db
        .from("companies")
        .update({
          name: v.name,
          settings_json: {
            ...((current.settings_json as Record<string, unknown>) ?? {}),
            target_margin_bps: Math.round(v.target_margin_pct * 100),
          },
        })
        .eq("id", s.companyId),
    );
    return done("/settings");
  });
}

// ---------------------------------------------------------------- routing, quiet hours, alerts
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "use HH:MM");

const windowsSchema = z.object({
  user_id: z.uuid(),
  windows: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        start_time: hhmm,
        end_time: hhmm,
        kind: z.enum(["live", "back_office", "field"]),
      }),
    )
    .max(40)
    .refine(
      (ws) => ws.every((w) => w.start_time !== w.end_time),
      "start and end can't be the same",
    ),
});

export async function saveWorkWindows(input: z.input<typeof windowsSchema>): Promise<ActionState> {
  return run(async () => {
    const v = windowsSchema.parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from("work_windows").delete().eq("user_id", v.user_id));
    if (v.windows.length) {
      ok(
        await s.db
          .from("work_windows")
          .insert(v.windows.map((w) => ({ ...w, user_id: v.user_id, company_id: s.companyId }))),
      );
    }
    return done("/settings/routing");
  });
}

const rulesSchema = z.object({
  quiet_hours_start: hhmm,
  quiet_hours_end: hhmm,
  lead_response_minutes: z.coerce
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  design_due_days: z.coerce.number().int().min(1).max(30),
  visit_buffer_minutes: z.coerce.number().int().min(0).max(180),
});

export async function saveRules(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = rulesSchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const current = must(
      await s.db.from("companies").select("settings_json").eq("id", s.companyId).single(),
    );
    ok(
      await s.db
        .from("companies")
        .update({
          settings_json: { ...((current.settings_json as Record<string, unknown>) ?? {}), ...v },
        })
        .eq("id", s.companyId),
    );
    return done("/settings/routing");
  });
}

const notifySchema = z.record(z.string().max(30), z.array(z.enum(["owner", "team", "crew"])));

/** Company defaults: which roles get each kind (the lead owner / PM / mentioned person always do). */
export async function saveNotifyDefaults(
  input: z.input<typeof notifySchema>,
): Promise<ActionState> {
  return run(async () => {
    const v = notifySchema.parse(input);
    const s = await requireRole("owner");
    const current = must(
      await s.db.from("companies").select("settings_json").eq("id", s.companyId).single(),
    );
    ok(
      await s.db
        .from("companies")
        .update({
          settings_json: {
            ...((current.settings_json as Record<string, unknown>) ?? {}),
            notify: v,
          },
        })
        .eq("id", s.companyId),
    );
    return done("/settings/routing");
  });
}
