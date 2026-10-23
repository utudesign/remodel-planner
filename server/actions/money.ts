"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { BUCKET, uploadDealFiles } from "@/lib/storage";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { optText, reqDate } from "@/lib/validation/common";
import { parseDollarsToCents } from "@/lib/money";
import { formToObject, must, ok, run, type ActionState } from "@/server/action-utils";
import { EXPENSE_CATEGORIES } from "@/lib/money-categories";


const money = z.string().transform((s, ctx) => {
  try {
    const c = parseDollarsToCents(s);
    if (c === null || c === 0) throw new Error("enter an amount");
    return c;
  } catch (e) {
    ctx.addIssue({ code: "custom", message: (e as Error).message });
    return z.NEVER;
  }
});

function photo(fd: FormData): File | null {
  const f = fd.get("photo");
  return f instanceof File && f.size > 0 ? f : null;
}

function done() {
  revalidatePath("/money");
  revalidatePath("/today");
  revalidatePath("/deals", "layout");
}

/** A commission payment I received (check photo or Zelle reference). Negative = clawback/correction. */
export async function recordCommissionPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  let back = "";
  const res = await run(async () => {
    const v = z
      .object({
        deal_id: z.uuid(),
        amount: money,
        paid_on: reqDate,
        method: z.enum(["check", "zelle", "ach", "cash", "other"]),
        reference: optText(80),
        note: optText(500),
      })
      .parse(formToObject(fd));
    const s = await requireRole("owner");
    const deal = must(
      await s.db.from("deals").select("id, company_id, deal_year, deal_number").eq("id", v.deal_id).eq("company_id", s.companyId).single(),
    );
    ok(
      await s.db.from("commission_payments").insert({
        company_id: s.companyId,
        deal_id: deal.id,
        amount_cents: v.amount,
        paid_on: v.paid_on,
        method: v.method,
        reference: v.reference,
        note: v.note,
      }),
    );
    const file = photo(fd);
    if (file) {
      await uploadDealFiles(s.db, { id: deal.id, company_id: deal.company_id, deal_year: deal.deal_year!, deal_number: deal.deal_number! }, [file], {
        folder: "payments",
        title: `Commission ${v.method} ${v.paid_on}`,
      });
    }
    done();
    back = "/money";
  });
  if (res?.ok && back) redirect(back);
  return res;
}

async function uploadReceipt(companyId: string, file: File) {
  const year = new Date().getFullYear();
  const path = `${companyId}/receipts/${year}/${crypto.randomUUID()}-${(file.name || "receipt.jpg").replace(/[^\w.-]+/g, "-").toLowerCase()}`;
  const { error } = await createAdminSupabase().storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);
  return path;
}

export async function addExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  let back = "";
  const res = await run(async () => {
    const v = z
      .object({
        spent_on: reqDate,
        amount: money.refine((c) => c > 0, "must be more than $0"),
        category: z.enum(EXPENSE_CATEGORIES.map((c) => c.key) as [string, ...string[]]),
        vendor: optText(120),
        note: optText(500),
        deal_id: z.preprocess((x) => (x === "" ? null : x), z.uuid().nullable()),
      })
      .parse(formToObject(fd));
    const s = await requireRole("owner");
    const file = photo(fd);
    const receipt = file ? await uploadReceipt(s.companyId, file) : null;
    ok(
      await s.db.from("business_expenses").insert({
        company_id: s.companyId,
        spent_on: v.spent_on,
        amount_cents: v.amount,
        category: v.category,
        vendor: v.vendor,
        note: v.note,
        deal_id: v.deal_id,
        receipt_path: receipt,
      }),
    );
    done();
    back = "/money?tab=expenses";
  });
  if (res?.ok && back) redirect(back);
  return res;
}

/** Mileage: miles typed in, or odometer start/end (PLAN Q8: no paid maps API). */
export async function addTrip(_: ActionState, fd: FormData): Promise<ActionState> {
  let back = "";
  const res = await run(async () => {
    const v = z
      .object({
        trip_on: reqDate,
        miles: z.string().optional().default(""),
        odo_start: z.string().optional().default(""),
        odo_end: z.string().optional().default(""),
        purpose: z.string().trim().min(1, "say what the trip was for").max(200),
        deal_id: z.preprocess((x) => (x === "" ? null : x), z.uuid().nullable()),
      })
      .parse(formToObject(fd));
    const num = (x: string) => Number(x.replace(/[^\d.]/g, ""));
    let miles = v.miles ? num(v.miles) : 0;
    if (!miles && v.odo_start && v.odo_end) miles = num(v.odo_end) - num(v.odo_start);
    if (!(miles > 0 && miles < 2000)) throw new Error("Enter the miles, or odometer start and end");
    const s = await requireRole("owner");
    ok(
      await s.db.from("mileage_trips").insert({
        company_id: s.companyId,
        trip_on: v.trip_on,
        miles: Math.round(miles * 10) / 10,
        purpose: v.purpose,
        deal_id: v.deal_id,
      }),
    );
    done();
    back = "/money?tab=mileage";
  });
  if (res?.ok && back) redirect(back);
  return res;
}

export async function deleteMoneyRow(input: { table: "business_expenses" | "mileage_trips" | "commission_payments"; id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ table: z.enum(["business_expenses", "mileage_trips", "commission_payments"]), id: z.uuid() })
      .parse(input);
    const s = await requireRole("owner");
    ok(await s.db.from(v.table).delete().eq("id", v.id).eq("company_id", s.companyId));
    done();
  });
}
