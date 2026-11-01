"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { companySchema, followUpRulesSchema, lookupRowsSchema, slugify, textTemplateSchema } from "@/lib/validation/settings";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";
import { importSkyline } from "@/server/onboarding";

/** Stages the app's logic relies on (new lead, booking, visit done, contract + deposit, sold, lost). */
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
      license_number: v.license_number || null,
      license_class: v.license_class || null,
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

/** Settings → Texts: save one ready-made text (or add a new one). */
export async function saveTextTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const v = textTemplateSchema.parse({ active: "false", ...formToObject(fd) });
    const s = await requireRole("owner");
    const row = {
      label: v.label,
      body: v.body,
      stage_key: v.stage_key || null,
      after_days: v.stage_key ? v.after_days : null,
      sort_order: v.sort_order,
      active: v.active,
    };
    if (v.key) {
      ok(await s.db.from("text_templates").update(row).eq("company_id", s.companyId).eq("key", v.key));
    } else {
      const existing = new Set(
        must(await s.db.from("text_templates").select("key").eq("company_id", s.companyId)).map((r) => r.key),
      );
      let key = slugify(v.label).slice(0, 36);
      if (key.length < 2) key = `text_${key}`;
      while (existing.has(key)) key = `${key.slice(0, 32)}_${Math.floor(Math.random() * 1000)}`;
      ok(await s.db.from("text_templates").insert({ ...row, key, company_id: s.companyId }));
    }
    revalidatePath("/deals", "layout");
    return done("/settings/texts", "Text saved");
  });
}

/**
 * Settings → Price lists: load (or refresh) the Skyline / Spring Forest 2026 price list for this company
 * (change request v3 batch C). Owner only; the database checks it again.
 */
export async function importSkylinePriceList(): Promise<ActionState> {
  return run(async () => {
    const s = await requireRole("owner");
    const r = await importSkyline(s.companyId, s.db);
    revalidatePath("/settings");
    return { ok: true, message: `Skyline loaded: ${r.items.toLocaleString("en-US")} items in ${r.colors} colors` };
  });
}

const keyRe = /^[a-z0-9_]{2,40}$/;
const phaseRows = z
  .array(
    z.object({
      key: z.string().regex(keyRe).nullable(), // null = new
      label: z.string().trim().min(1).max(60),
      trade_key: z.string().regex(keyRe).nullable(),
      start_offset_days: z.number().int().min(0).max(365),
      duration_days: z.number().int().min(1).max(120),
      active: z.boolean(),
    }),
  )
  .max(40);

/**
 * Settings → Jobs: the phase template new jobs start from (v3 item 13). Order = list order. Keys never change;
 * a hidden phase stays on jobs that already have it. Existing jobs aren't changed.
 */
export async function saveJobPhases(input: z.input<typeof phaseRows>): Promise<ActionState> {
  return run(async () => {
    const rows = phaseRows.parse(input);
    const s = await requireRole("owner");
    const existing = new Set(
      must(await s.db.from("job_phase_templates").select("key").eq("company_id", s.companyId)).map((r) => r.key),
    );
    for (const [i, r] of rows.entries()) {
      let key = r.key;
      if (!key) {
        key = slugify(r.label).slice(0, 36) || "phase";
        while (existing.has(key)) key = `${key}_${Math.floor(Math.random() * 1000)}`;
        existing.add(key);
      }
      ok(
        await s.db.from("job_phase_templates").upsert(
          {
            company_id: s.companyId,
            key,
            label: r.label,
            trade_key: r.trade_key,
            start_offset_days: r.start_offset_days,
            duration_days: r.duration_days,
            sort_order: i + 1,
            active: r.active,
          },
          { onConflict: "company_id,key" },
        ),
      );
    }
    revalidatePath("/jobs");
    return done("/settings/jobs");
  });
}

const tradeRows = z
  .array(z.object({ key: z.string().regex(keyRe).nullable(), label: z.string().trim().min(1).max(40), active: z.boolean() }))
  .max(30);

export async function saveTrades(input: z.input<typeof tradeRows>): Promise<ActionState> {
  return run(async () => {
    const rows = tradeRows.parse(input);
    const s = await requireRole("owner");
    const existing = new Set(must(await s.db.from("trades").select("key").eq("company_id", s.companyId)).map((r) => r.key));
    for (const [i, r] of rows.entries()) {
      let key = r.key;
      if (!key) {
        key = slugify(r.label).slice(0, 26) || "trade";
        while (existing.has(key)) key = `${key}_${Math.floor(Math.random() * 1000)}`;
        existing.add(key);
      }
      ok(
        await s.db
          .from("trades")
          .upsert({ company_id: s.companyId, key, label: r.label, sort_order: i + 1, active: r.active }, { onConflict: "company_id,key" }),
      );
    }
    return done("/settings/jobs");
  });
}

const photoCatRows = z
  .array(
    z.object({
      key: z.string().regex(keyRe).nullable(),
      label: z.string().trim().min(1).max(40),
      hint: z.string().trim().max(120).nullable(),
      min_required: z.number().int().min(0).max(50),
      active: z.boolean(),
    }),
  )
  .max(30);

/** Settings → Photos (v3 D, 0024): categories, order, and how many the site visit needs. Keys never change. */
export async function savePhotoCategories(input: z.input<typeof photoCatRows>): Promise<ActionState> {
  return run(async () => {
    const rows = photoCatRows.parse(input);
    const s = await requireRole("owner");
    const existing = new Set(
      must(await s.db.from("photo_categories").select("key").eq("company_id", s.companyId)).map((r) => r.key),
    );
    for (const [i, r] of rows.entries()) {
      let key = r.key;
      if (!key) {
        key = slugify(r.label).slice(0, 30) || "photos";
        while (existing.has(key)) key = `${key}_${Math.floor(Math.random() * 1000)}`;
        existing.add(key);
      }
      ok(
        await s.db.from("photo_categories").upsert(
          {
            company_id: s.companyId,
            key,
            label: r.label,
            hint: r.hint || null,
            min_required: r.min_required,
            sort_order: i + 1,
            active: key === "other" ? true : r.active,
          },
          { onConflict: "company_id,key" },
        ),
      );
    }
    revalidatePath("/deals", "layout");
    return done("/settings/photos");
  });
}
