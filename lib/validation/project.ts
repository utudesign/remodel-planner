import { z } from "zod";
import {
  id,
  optDate,
  optMoney,
  optText,
  reqDate,
  reqMoney,
  reqText,
} from "@/lib/validation/common";

export const PAYMENT_METHODS = [
  { value: "check", label: "Check" },
  { value: "zelle", label: "Zelle" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
] as const;

const method = z.enum(["check", "zelle", "card", "cash", "other"]);
const emptyToNull = (v: unknown) => (v === "" ? null : v);

export const convertLeadSchema = z.object({
  lead_id: id,
  name: reqText(160),
  contract_value: reqMoney,
  payment_template_id: z.preprocess(emptyToNull, id.nullable()),
  task_template_id: z.preprocess(emptyToNull, id.nullable()),
  received_on: reqDate,
  method,
  check_number: optText(40),
  planned_start_date: optDate,
});

export const receivePaymentSchema = z.object({
  payment_id: id,
  received_on: reqDate,
  method,
  check_number: optText(40),
  amount: optMoney,
});

export const paymentSchema = z.object({
  payment_id: z.preprocess(emptyToNull, id.nullable().optional()),
  project_id: id,
  label: reqText(120),
  amount: reqMoney,
  due_trigger: z.preprocess(emptyToNull, z.string().max(60).nullable()),
  due_date: optDate,
});

export const costSchema = z.object({
  cost_id: z.preprocess(emptyToNull, id.nullable().optional()),
  project_id: id,
  category_id: id,
  vendor: optText(120),
  description: optText(500),
  estimated: optMoney,
  actual: optMoney,
  paid_on: optDate,
});

export const taskSchema = z.object({
  task_id: z.preprocess(emptyToNull, id.nullable().optional()),
  project_id: id,
  title: reqText(200),
  description: optText(2000),
  kind: z.enum(["task", "punch"]).default("task"),
  status: z.enum(["todo", "doing", "blocked", "done"]).default("todo"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  milestone_id: z.preprocess(emptyToNull, id.nullable().optional()),
  assignee_id: z.preprocess(emptyToNull, id.nullable().optional()),
  trade: optText(80),
  due_date: optDate,
});

export const milestoneDatesSchema = z.object({
  milestone_id: id,
  planned_date: optDate,
  actual_date: optDate,
});

export const projectHeaderSchema = z.object({
  project_id: id,
  name: reqText(160),
  contract_value: reqMoney,
  project_manager_id: z.preprocess(emptyToNull, id.nullable()),
});

export const TRADES = [
  "Install crew",
  "Plumber",
  "Electrician",
  "Countertop fabricator",
  "Tile setter",
  "Drywall / paint",
];
