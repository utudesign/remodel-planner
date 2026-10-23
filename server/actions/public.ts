"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { availableSlots } from "@/lib/booking";
import { readSettings } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { SCOPE_KEYS } from "@/lib/deals/display";
import { formatPhone } from "@/lib/leads/parse-message";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formToObject, type ActionState } from "@/server/action-utils";
import { notifyOwners } from "@/server/notify";

/**
 * Public pages (share-link lead form, client booking). No login: the server validates the
 * slug / token, rate-limits by hashed IP and writes with the service role. Nothing else is exposed.
 */
async function ipHash() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${ip}|${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "salt"}`)
    .digest("hex")
    .slice(0, 32);
}

async function tooMany(kind: "lead" | "booking", hash: string, max: number) {
  const { count } = await createAdminSupabase()
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("ip_hash", hash)
    .gte("created_at", new Date(Date.now() - 3600_000).toISOString());
  return (count ?? 0) >= max;
}

const leadForm = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().trim().min(1, "Please add your name").max(120),
  phone: z.string().trim().min(7, "Please add a phone number").max(40),
  city: z.string().trim().max(80).optional().default(""),
  scope: z.preprocess((v) => (v === "" ? null : v), z.enum(SCOPE_KEYS).nullable()),
  message: z.string().trim().max(2000).optional().default(""),
  website: z.string().max(0, "spam").optional().default(""), // honeypot: real people never fill it
});

export async function submitLeadForm(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = leadForm.safeParse(formToObject(fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "spam") return { ok: true, message: "Thanks! I'll text you shortly." };
    return { ok: false, error: issue?.message ?? "Please check the form" };
  }
  const v = parsed.data;
  const db = createAdminSupabase();
  const hash = await ipHash();
  if (await tooMany("lead", hash, 5)) return { ok: false, error: "Too many requests. Please text me instead." };

  const { data: link } = await db
    .from("lead_links")
    .select("company_id, source, active")
    .eq("slug", v.slug)
    .maybeSingle();
  if (!link?.active) return { ok: false, error: "This link is no longer active." };

  const { data: contact, error: cErr } = await db
    .from("contacts")
    .insert({ company_id: link.company_id, name: v.name, phone: formatPhone(v.phone) ?? v.phone, city: v.city || null })
    .select("id")
    .single();
  if (cErr || !contact) return { ok: false, error: "Something went wrong. Please text me instead." };
  const { data: deal, error: dErr } = await db
    .from("deals")
    .insert({
      company_id: link.company_id,
      contact_id: contact.id,
      source: link.source,
      stage: "new",
      scope: v.scope,
      notes: v.message || null,
      title: `${v.name.split(/\s+/).pop()} ${v.scope === "cabinets_only" ? "cabinets" : (v.scope ?? "kitchen")}`,
    })
    .select("id, deal_number")
    .single();
  if (dErr || !deal) return { ok: false, error: "Something went wrong. Please text me instead." };
  await db.from("form_submissions").insert({ kind: "lead", company_id: link.company_id, ip_hash: hash, deal_id: deal.id });
  await notifyOwners(link.company_id, {
    kind: "new_lead",
    title: `New lead #${deal.deal_number}: ${v.name}`,
    body: [v.city, v.message].filter(Boolean).join(" · ").slice(0, 140) || "From your share link",
    url: `/deals/${deal.deal_number}`,
    dealId: deal.id,
  });
  return { ok: true, message: "Thanks! I'll text you shortly with a few quick questions." };
}

const bookingForm = z.object({ token: z.uuid(), start: z.iso.datetime() });

export async function bookSlot(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = bookingForm.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, error: "Pick a time" };
  const v = parsed.data;
  const db = createAdminSupabase();
  const hash = await ipHash();
  if (await tooMany("booking", hash, 5)) return { ok: false, error: "Too many requests. Please text me instead." };

  const { data: deal } = await db
    .from("deals")
    .select("id, company_id, stage, deal_number, deleted_at, contact:contacts(name), company:companies(timezone, settings_json)")
    .eq("booking_token", v.token)
    .maybeSingle();
  if (!deal || deal.deleted_at || !deal.company) return { ok: false, error: "This booking link is no longer valid." };
  const tz = deal.company.timezone;
  const st = readSettings((deal.company.settings_json ?? {}) as Record<string, unknown>);

  // Re-check the slot is still free right now (someone else may have taken it).
  const now = new Date();
  const { data: booked } = await db
    .from("meetings")
    .select("starts_at, ends_at")
    .eq("company_id", deal.company_id)
    .eq("status", "scheduled")
    .gte("starts_at", new Date(now.getTime() - 86400_000).toISOString());
  const busy = (booked ?? []).map((m) => ({
    start: new Date(m.starts_at),
    end: new Date(m.ends_at ?? new Date(new Date(m.starts_at).getTime() + st.booking.minutes * 60_000)),
  }));
  const slot = availableSlots(st.booking, busy, now, tz).find((s) => s.start === new Date(v.start).toISOString());
  if (!slot) return { ok: false, error: "That time was just taken. Please pick another." };

  const { error } = await db.from("meetings").insert({
    company_id: deal.company_id,
    deal_id: deal.id,
    kind: "visit",
    starts_at: slot.start,
    ends_at: slot.end,
    booked_via: "link",
  });
  if (error) return { ok: false, error: "Could not book. Please text me instead." };
  if (["new", "qualified"].includes(deal.stage)) {
    await db.from("deals").update({ stage: "visit_booked" }).eq("id", deal.id);
  }
  await db.from("form_submissions").insert({ kind: "booking", company_id: deal.company_id, ip_hash: hash, deal_id: deal.id });
  const when = formatDateTime(slot.start, tz);
  await notifyOwners(deal.company_id, {
    kind: "booking",
    title: `Visit booked: ${deal.contact?.name ?? `#${deal.deal_number}`}`,
    body: when,
    url: `/deals/${deal.deal_number}`,
    dealId: deal.id,
  });
  return { ok: true, message: when };
}
