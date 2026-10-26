"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, type Session } from "@/lib/auth/require-role";
import { dealStoragePath } from "@/lib/deals/dealNumber";
import { BUCKET } from "@/lib/storage";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatCentsWhole } from "@/lib/money";
import { must, maybe, ok, type ActionState } from "@/server/action-utils";
import { kitchenRange } from "@/server/ballpark";
import type { Json } from "@/types/db";

const wall = z.object({ name: z.string().max(20), ft: z.number().min(0).max(80) });
const appliance = z.object({
  kind: z.string().max(40),
  model: z.string().max(120),
  reuse: z.boolean(),
});

const visitSchema = z.object({
  deal_id: z.uuid(),
  walls: z.array(wall).max(8),
  ceiling_in: z.number().int().min(72).max(240).nullable(),
  appliances: z.array(appliance).max(12),
  year_built: z.number().int().min(1700).max(2100).nullable(),
  notes: z.string().max(4000),
  done: z.boolean(),
});

export type VisitInput = z.input<typeof visitSchema>;

/** Text files that satisfy the hand-off checklist (measurements, appliance list). */
async function fileText(
  s: Session,
  deal: { id: string; company_id: string; deal_year: number; deal_number: string },
  folder: "design" | "other",
  label: string,
  title: string,
  text: string,
) {
  const req = maybe(
    await s.db
      .from("document_requirements")
      .select("id")
      .eq("company_id", s.companyId)
      .eq("gate", "before_handoff")
      .eq("label", label)
      .maybeSingle(),
  );
  // Replace the previous generated copy (records are permanent: soft-delete, then add).
  ok(
    await s.db
      .from("deal_files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("deal_id", deal.id)
      .eq("title", title)
      .is("deleted_at", null),
  );
  const path = dealStoragePath(deal.company_id, deal.deal_year, deal.deal_number, folder, `${title}.txt`);
  const body = new Blob([text], { type: "text/plain" });
  const { error } = await createAdminSupabase().storage.from(BUCKET).upload(path, body, { contentType: "text/plain" });
  if (error) throw new Error(`Could not save ${title}: ${error.message}`);
  ok(
    await s.db.from("deal_files").insert({
      company_id: s.companyId,
      deal_id: deal.id,
      folder,
      title,
      storage_path: path,
      mime_type: "text/plain",
      size_bytes: body.size,
      requirement_id: req?.id ?? null,
    }),
  );
}

export async function saveSiteVisit(input: VisitInput): Promise<ActionState & { low?: number; high?: number }> {
  try {
    const v = visitSchema.parse(input);
    const s = await requireRole("owner", "partner");
    const deal = must(
      await s.db
        .from("deals")
        .select("id, company_id, deal_year, deal_number, stage, contact:contacts(name, address, city)")
        .eq("id", v.deal_id)
        .eq("company_id", s.companyId)
        .single(),
    );
    const walls = v.walls.filter((w) => w.ft > 0);
    const range = await kitchenRange(s.db, s.companyId, walls);
    const existing = maybe(
      await s.db
        .from("site_visits")
        .select("id")
        .eq("deal_id", deal.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    const row = {
      company_id: s.companyId,
      deal_id: deal.id,
      walls: walls as unknown as NonNullable<Json>,
      ceiling_in: v.ceiling_in,
      appliances: v.appliances.filter((a) => a.kind || a.model) as unknown as NonNullable<Json>,
      notes: v.notes || null,
      status: v.done ? "done" : "draft",
      visited_at: v.done ? new Date().toISOString() : null,
      ballpark_low_cents: range?.lowCents ?? null,
      ballpark_high_cents: range?.highCents ?? null,
    };
    if (existing) ok(await s.db.from("site_visits").update(row).eq("id", existing.id));
    else ok(await s.db.from("site_visits").insert(row));
    ok(await s.db.from("deals").update({ year_built: v.year_built }).eq("id", deal.id));

    if (v.done) {
      const ref = { id: deal.id, company_id: deal.company_id, deal_year: deal.deal_year!, deal_number: deal.deal_number! };
      const who = [deal.contact?.name, [deal.contact?.address, deal.contact?.city].filter(Boolean).join(", ")].filter(Boolean).join(" — ");
      if (walls.length) {
        await fileText(
          s,
          ref,
          "design",
          "Measurements + sketch",
          "Site visit measurements",
          [
            `#${deal.deal_number} ${who}`,
            `Measured ${new Date().toLocaleDateString("en-US", { timeZone: s.timezone })}`,
            "",
            ...walls.map((w) => `Wall ${w.name}: ${w.ft} ft`),
            v.ceiling_in ? `Ceiling: ${v.ceiling_in} in` : "",
            v.year_built ? `Year built: ${v.year_built}${v.year_built < 1978 ? " (pre-1978: lead-safe rules)" : ""}` : "",
            "",
            v.notes,
          ].join("\n"),
        );
      }
      const apps = v.appliances.filter((a) => a.kind || a.model);
      if (apps.length) {
        await fileText(
          s,
          ref,
          "other",
          'Appliance list (model numbers or "reuse")',
          "Appliance list",
          [`#${deal.deal_number} ${who}`, "", ...apps.map((a) => `${a.kind || "Appliance"}: ${a.reuse ? "reuse existing" : a.model || "new, model TBD"}`)].join("\n"),
        );
      }
      if (["new", "qualified", "visit_booked"].includes(deal.stage)) {
        ok(await s.db.from("deals").update({ stage: "visit_done" }).eq("id", deal.id));
      }
      const { data: due } = await s.db
        .from("meetings")
        .select("id")
        .eq("deal_id", deal.id)
        .eq("status", "scheduled")
        .lte("starts_at", new Date(Date.now() + 12 * 3600_000).toISOString());
      for (const m of due ?? []) ok(await s.db.from("meetings").update({ status: "done" }).eq("id", m.id));
      ok(
        await s.db.from("activities").insert({
          company_id: s.companyId,
          deal_id: deal.id,
          type: "visit",
          direction: "out",
          summary: `Site visit: ${walls.map((w) => `${w.name} ${w.ft} ft`).join(", ") || "no walls"}${range ? ` · ballpark ${formatCentsWhole(range.lowCents)}–${formatCentsWhole(range.highCents)}` : ""}`,
          created_by: s.userId,
        }),
      );
    }
    revalidatePath(`/deals/${deal.deal_number}`);
    revalidatePath(`/deals/${deal.deal_number}/visit`);
    return { ok: true, message: v.done ? "Visit saved and done" : "Saved", low: range?.lowCents, high: range?.highCents };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? "Check the numbers" : e instanceof Error ? e.message : "Could not save" };
  }
}
