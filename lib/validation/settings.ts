import { z } from "zod";
import { id, optText, reqText } from "@/lib/validation/common";

export const LOOKUP_TABLES = ["pipeline_stages", "lost_reasons", "cost_categories"] as const;
export type LookupTable = (typeof LOOKUP_TABLES)[number];

export const lookupRowsSchema = z.object({
  table: z.enum(LOOKUP_TABLES),
  rows: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        label: reqText(80),
        sort_order: z.number().int().min(0).max(1000),
        active: z.boolean(),
      }),
    )
    .max(50),
});

export const followUpRulesSchema = z.object({
  stage_id: id,
  rules: z
    .array(
      z.object({
        offset_days: z.number().int().min(0).max(365),
        offset_hours: z
          .number()
          .int()
          .min(0)
          .max(23 * 24),
        description: z.string().trim().max(200),
      }),
    )
    .max(10),
});

export const paymentTemplateSchema = z
  .object({
    id: z.uuid().nullable(),
    name: reqText(80),
    active: z.boolean(),
    items: z
      .array(
        z.object({
          label: reqText(80),
          kind: z.enum(["percent", "fixed"]),
          percent_bps: z.number().int().min(0).max(10000).nullable(),
          amount_cents: z.number().int().min(0).nullable(),
          due_trigger: z.string().max(60).nullable(),
        }),
      )
      .min(1, "add at least one installment")
      .max(12),
  })
  .refine(
    (t) =>
      t.items.some((i) => i.kind === "fixed") ||
      t.items.reduce((s, i) => s + (i.percent_bps ?? 0), 0) === 10000,
    { message: "Percentages must add up to 100%", path: ["items"] },
  );

export const taskTemplateSchema = z.object({
  id: z.uuid().nullable(),
  name: reqText(80),
  is_default: z.boolean(),
  active: z.boolean(),
  items: z
    .array(
      z.object({
        title: reqText(200),
        milestone_key: z.string().max(60).nullable(),
        kind: z.enum(["task", "punch"]),
      }),
    )
    .max(80),
});

export const memberSchema = z.object({
  user_id: id,
  role: z.enum(["admin", "designer", "field"]),
  active: z.boolean(),
  is_default_owner: z.boolean(),
  phone: optText(40),
});

export const companySchema = z.object({
  name: reqText(120),
  target_margin_pct: z.coerce.number().min(0).max(90),
});

export function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "item"
  );
}
