"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { companySchema, followUpRulesSchema, lookupRowsSchema, slugify } from "@/lib/validation/settings";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";

/** Stages the app's logic relies on (new lead, booking, visit done, hand-off, lost). */
const SYSTEM_STAGES = ["new", "visit_booked", "visit_done", "ready", "handed_off", "lost"];

function done(path: string, message = "Saved"): ActionState {
  revalidatePath(path);
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Stages and lost reasons: label / order / visible. Keys never change once created. */
export async function saveLookupRows(input: z.input<typeof lookupRowsSchema>): Promise<ActionState> {
  return run(async () => {
    const v = lookupRowsSchema.parse(input);
    const s = await requireRole("owner");
    const existing = must(await s.db.from(v.table).select("id, key").eq("company_id", s.companyId));
    const keys = new Set(existing.map((r) => r.key));
    const keyById = new Map(existing.map((r) => [r.id, r.key]));
    for (const r of v.rows) {
      if (v.table === "pipeline_stages" && r.id && !r.active && SYSTEM_STAGES.includes(keyById.get(r.id) ?? "")) {
        throw new Error(`"${r.label}" is a built-in stage the app relies on. Rename it instead of hiding it.`);
      }
      if (r.id) {
        ok(await s.db.from(v.table).update({ label: r.label, sort_order: r.sort_order, active: r.active }).eq("id", r.id));
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

export async function saveFollowUpRules(input: z.input<typeof followUpRulesSchema>): Promise<ActionState> {
  return run(async () => {
    const v = followUpRulesSchema.parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from("follow_up_rules").delete().eq("company_id", s.companyId).eq("stage_key", v.stage_key));
    if (v.rules.length) {
      ok(
        await s.db.from("follow_up_rules").insert(
          v.rules.map((r, i) => ({ ...r, sequence: i + 1, stage_key: v.stage_key, company_id: s.companyId })),
        ),
      );
    }
    return done("/settings/pipeline");
  });
}

export async function saveCompany(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = companySchema.parse(formToObject(fd));
    const s = await requireRole("owner");
    const settings = {
      ...s.settings.raw,
      tax_set_aside_pct: v.tax_set_aside_pct,
      mileage_rate_cents: v.mileage_rate_cents,
      workday: { ...s.settings.workday, start: v.workday_start, end: v.workday_end },
      digest_time: v.workday_end,
      booking: {
        minutes: v.booking_minutes,
        weekday: { start: v.booking_weekday_start, end: v.booking_weekday_end },
        saturday: { start: v.booking_saturday_start, end: v.booking_saturday_end },
      },
      auto_reply: v.auto_reply || null,
    };
    ok(await s.db.from("companies").update({ name: v.name, settings_json: settings }).eq("id", s.companyId));
    return done("/settings");
  });
}
