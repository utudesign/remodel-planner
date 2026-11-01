"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { localToUtc } from "@/lib/dates";
import { must, ok, run, type ActionState } from "@/server/action-utils";

/**
 * Installments + Melio links (v3 G, 0025). Manual by design (Melio has no payment-request API):
 * paste the link → Text it → Mark paid with the Melio reference. The database refuses a payment before
 * the contract is signed (0005) and keeps status in step.
 */

const staff = () => requireRole("owner", "team", "partner");

async function paymentRef(s: Session, id: string) {
  return must(
    await s.db
      .from("payments")
      .select("id, project_id, received_at, project:projects(deal:deals(deal_number))")
      .eq("id", id)
      .eq("company_id", s.companyId)
      .single(),
  );
}
const numberOf = (r: { project: unknown }) => (r.project as { deal: { deal_number: string | null } | null } | null)?.deal?.deal_number ?? null;
const refresh = (n: string | null) => {
  if (n) revalidatePath(`/deals/${n}`);
  revalidatePath("/today");
  revalidatePath("/my-job");
};

export async function addPaymentSchedule(input: { project_id: string; number: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ project_id: z.uuid(), number: z.string().max(20) }).parse(input);
    const s = await staff();
    ok(await s.db.rpc("add_payment_schedule", { p_project: v.project_id }));
    refresh(v.number);
    return { ok: true, message: "Standard schedule added" };
  });
}

const installmentSchema = z.object({
  id: z.uuid().optional(),
  project_id: z.uuid(),
  number: z.string().max(20),
  label: z.string().trim().min(1, "Name it").max(60),
  amount_cents: z.number().int().positive("Amount must be more than $0").max(1_000_000_00),
  due_date: z.iso.date().nullable(),
});

export async function saveInstallment(input: z.input<typeof installmentSchema>): Promise<ActionState> {
  return run(async () => {
    const v = installmentSchema.parse(input);
    const s = await staff();
    if (v.id) {
      const p = await paymentRef(s, v.id);
      if (p.received_at) throw new Error("It's paid. Mark it unpaid first to change it.");
      ok(await s.db.from("payments").update({ label: v.label, amount: v.amount_cents, due_date: v.due_date }).eq("id", v.id));
    } else {
      const n = must(await s.db.from("payments").select("id").eq("project_id", v.project_id)).length;
      ok(
        await s.db
          .from("payments")
          .insert({ project_id: v.project_id, label: v.label, amount: v.amount_cents, due_date: v.due_date, sort_order: n + 1 }),
      );
    }
    refresh(v.number);
  });
}

export async function deleteInstallment(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await staff();
    const p = await paymentRef(s, v.id);
    if (p.received_at) throw new Error("Paid installments stay on record");
    ok(await s.db.from("payments").delete().eq("id", v.id));
    refresh(numberOf(p));
  });
}

export async function setPaymentLink(input: { id: string; url: string | null }): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({ id: z.uuid(), url: z.url({ protocol: /^https$/, error: "Paste the https:// link from Melio" }).max(500).nullable() })
      .parse(input);
    const s = await staff();
    const p = await paymentRef(s, v.id);
    ok(await s.db.from("payments").update({ link_url: v.url, provider: v.url ? "melio" : null }).eq("id", v.id));
    refresh(numberOf(p));
  });
}

/** The phone opened Messages with the text: remember when (status → Sent). */
export async function markLinkSent(input: { id: string }): Promise<ActionState> {
  return run(async () => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const s = await staff();
    const p = await paymentRef(s, v.id);
    ok(await s.db.from("payments").update({ link_sent_at: new Date().toISOString() }).eq("id", v.id));
    refresh(numberOf(p));
  });
}

export async function markInstallmentPaid(input: {
  id: string;
  paid: boolean;
  on?: string;
  provider?: "melio" | "check" | "cash" | "zelle" | "other";
  ref?: string;
}): Promise<ActionState> {
  return run(async () => {
    const v = z
      .object({
        id: z.uuid(),
        paid: z.boolean(),
        on: z.iso.date().optional(),
        provider: z.enum(["melio", "check", "cash", "zelle", "other"]).optional(),
        ref: z.string().trim().max(120).optional(),
      })
      .parse(input);
    const s = await staff();
    const p = await paymentRef(s, v.id);
    ok(
      await s.db
        .from("payments")
        .update(
          v.paid
            ? {
                received_at: localToUtc(v.on ?? new Date().toISOString().slice(0, 10), "12:00", s.timezone).toISOString(),
                provider: v.provider ?? "melio",
                method: v.provider ?? "melio",
                provider_ref: v.ref || null,
                check_number: v.provider === "check" ? v.ref || null : null,
              }
            : { received_at: null, provider_ref: null },
        )
        .eq("id", v.id),
    );
    refresh(numberOf(p));
    return { ok: true, message: v.paid ? "Marked paid" : "Marked unpaid" };
  });
}
