import { z } from "zod";
import { id, optMoney, optText, reqDateTimeLocal } from "@/lib/validation/common";
import { DEAL_FOLDERS } from "@/lib/deals/dealNumber";
import { PHOTO_TAG_KEYS, SCOPE_KEYS, SOURCE_KEYS, TIMELINE_KEYS } from "@/lib/deals/display";

const optEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === undefined ? null : v), z.enum(values).nullable());

const optBool = z.preprocess(
  (v) => (v === "yes" ? true : v === "no" ? false : null),
  z.boolean().nullable(),
);

const optInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );

export const ACTIVITY_TYPES = [
  { key: "call", label: "Call" },
  { key: "text", label: "Text" },
  { key: "fb_msg", label: "FB message" },
  { key: "email", label: "Email" },
  { key: "visit", label: "Visit" },
  { key: "note", label: "Note" },
] as const;
const ACTIVITY_KEYS = ACTIVITY_TYPES.map((a) => a.key) as [string, ...string[]];

export const newDealSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(""),
    phone: optText(40),
    email: z.preprocess((v) => (v === "" ? null : v), z.email().max(200).nullable().optional()),
    address: optText(200),
    city: optText(80),
    source: z.enum(SOURCE_KEYS),
    scope: optEnum(SCOPE_KEYS),
    notes: optText(4000),
    estimated_value: optMoney,
    /** Where the deal starts (a pipeline_stages key). Most deals start after the first chat. */
    stage: z.string().trim().min(1).max(60).optional().default("new"),
    /** Required when the visit is already booked. */
    visit_at: z
      .string()
      .optional()
      .transform((s) => (s ? s : null))
      .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s), "pick a date and time"),
  })
  .refine((v) => v.name || v.phone, { message: "Add a name or a phone number", path: ["name"] })
  .refine((v) => v.stage !== "visit_booked" || v.visit_at, { message: "When is the visit?", path: ["visit_at"] });

export const qualifySchema = z
  .object({
    deal_id: id,
    scope: optEnum(SCOPE_KEYS),
    timeline: optEnum(TIMELINE_KEYS),
    budget_min: optMoney,
    budget_max: optMoney,
    decision_maker: optText(120),
    owns_home: optBool,
    year_built: optInt(1700, 2100),
    knowledge_level: optInt(1, 3),
    estimated_value: optMoney,
    notes: optText(4000),
  })
  .refine((v) => v.budget_min === null || v.budget_max === null || v.budget_min <= v.budget_max, {
    message: "the low end is above the high end",
    path: ["budget_min"],
  });

export const contactSchema = z.object({
  deal_id: id,
  name: optText(120),
  phone: optText(40),
  email: z.preprocess((v) => (v === "" ? null : v), z.email().max(200).nullable().optional()),
  address: optText(200),
  city: optText(80),
  zip: optText(12),
});

export const stageSchema = z.object({
  deal_id: id,
  stage: z.string().min(1).max(60),
  lost_reason: optText(60),
});

export const logActivitySchema = z.object({
  deal_id: id,
  type: z.enum(ACTIVITY_KEYS),
  direction: z.preprocess((v) => (v === "" ? null : v), z.enum(["in", "out"]).nullable()),
  summary: optText(2000),
});

export const followUpSchema = z.object({ deal_id: id, at: reqDateTimeLocal });

export const bookVisitSchema = z.object({
  deal_id: id,
  starts_at: reqDateTimeLocal,
  minutes: z.coerce.number().int().min(15).max(480).default(90),
  notes: optText(500),
});

export const dealFileSchema = z.object({
  deal_id: id,
  folder: z.enum(DEAL_FOLDERS),
  photo_tag: z.preprocess((v) => (v === "" ? null : v), z.enum(PHOTO_TAG_KEYS).nullable().optional()),
  requirement_id: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().optional()),
  title: z.string().trim().max(160).optional(),
});
