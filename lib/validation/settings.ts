import { z } from "zod";
import { reqText } from "@/lib/validation/common";

export const LOOKUP_TABLES = ["pipeline_stages", "lost_reasons"] as const;
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
  stage_key: z.string().min(1).max(60),
  rules: z
    .array(
      z.object({
        offset_days: z.number().int().min(0).max(365),
        offset_hours: z.number().int().min(0).max(23 * 24),
        description: z.string().trim().max(200),
      }),
    )
    .max(10),
});

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");

export const companySchema = z
  .object({
    name: reqText(120),
    tax_set_aside_pct: z.coerce.number().min(0).max(60),
    mileage_rate_cents: z.coerce.number().min(0).max(500),
    workday_start: hm,
    workday_end: hm,
    booking_weekday_start: hm,
    booking_weekday_end: hm,
    booking_saturday_start: hm,
    booking_saturday_end: hm,
    booking_minutes: z.coerce.number().int().min(30).max(240),
    auto_reply: z.string().trim().max(1500).optional().default(""),
  })
  .refine((v) => v.workday_start < v.workday_end, { message: "day job must end after it starts", path: ["workday_end"] });

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

/** Settings → Texts: one template. Key is fixed once created; new ones get a key from the label. */
export const textTemplateSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{2,40}$/).optional().or(z.literal("")),
  label: z.string().trim().min(1, "is required").max(60),
  body: z.string().trim().min(1, "is required").max(640, "keep it under 640 characters"),
  stage_key: z.string().trim().max(60).optional().default(""),
  after_days: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(0).max(365).nullable(),
  ),
  sort_order: z.coerce.number().int().min(0).max(10000).default(500),
  active: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});
