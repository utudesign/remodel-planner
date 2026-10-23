import { z } from "zod";
import { id, optMoney, optText, reqDateTimeLocal, reqText } from "@/lib/validation/common";

export const LEAD_SOURCES = [
  { value: "call", label: "Phone call" },
  { value: "text", label: "Text" },
  { value: "fb_marketplace", label: "FB Marketplace" },
  { value: "fb_group", label: "FB group" },
  { value: "web", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "other", label: "Other" },
] as const;

export const SCOPES = [
  { value: "cabinets", label: "Cabinets" },
  { value: "counters", label: "Counters" },
  { value: "full", label: "Full remodel" },
  { value: "other", label: "Other" },
] as const;

export const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "text", label: "Text" },
  { value: "fb_msg", label: "FB message" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
] as const;

const scope = z.enum(["cabinets", "counters", "full", "other"]).nullable().optional();
const source = z.enum(LEAD_SOURCES.map((s) => s.value) as [string, ...string[]]);

const budget = {
  budget_min: optMoney,
  budget_max: optMoney,
};

export const newLeadSchema = z
  .object({
    name: reqText(120),
    phone: optText(40),
    email: z.union([z.literal(""), z.email("is not a valid email")]).optional(),
    address: optText(200),
    city: optText(80),
    zip: optText(12),
    source,
    scope: z.preprocess((v) => (v === "" ? null : v), scope),
    desired_timeline: optText(120),
    notes: optText(4000),
    ...budget,
  })
  .refine((v) => v.phone || v.email, { message: "Add a phone number or email", path: ["phone"] })
  .refine((v) => !v.budget_min || !v.budget_max || v.budget_min <= v.budget_max, {
    message: "min can't be above max",
    path: ["budget_min"],
  });

export const updateLeadSchema = z
  .object({
    deal_id: id,
    contact_id: id,
    name: reqText(120),
    phone: optText(40),
    email: z.union([z.literal(""), z.email("is not a valid email")]).optional(),
    address: optText(200),
    city: optText(80),
    zip: optText(12),
    source,
    scope: z.preprocess((v) => (v === "" ? null : v), scope),
    desired_timeline: optText(120),
    notes: optText(4000),
    owner_id: z.preprocess((v) => (v === "" ? null : v), id.nullable()),
    ...budget,
  })
  .refine((v) => !v.budget_min || !v.budget_max || v.budget_min <= v.budget_max, {
    message: "min can't be above max",
    path: ["budget_min"],
  });

export const logActivitySchema = z.object({
  deal_id: id,
  type: z.enum(["call", "text", "fb_msg", "email", "meeting", "note"]),
  direction: z.enum(["in", "out"]).optional(),
  summary: optText(2000),
  next_follow_up_at: reqDateTimeLocal,
});

export const moveStageSchema = z.object({ deal_id: id, stage_id: id });

export const markLostSchema = z.object({
  deal_id: id,
  lost_reason_id: id,
  lost_note: optText(1000),
});

export const bookMeetingSchema = z.object({
  deal_id: id,
  type: z.enum(["initial", "design_review", "mid_check", "final"]),
  scheduled_at: reqDateTimeLocal,
  notes: optText(1000),
  move_to_booked: z.string().optional(),
});
