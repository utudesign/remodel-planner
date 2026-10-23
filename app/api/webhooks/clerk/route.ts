import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Clerk → Supabase sync (optional; first sign-in creates the account without it).
 * Subscribe to: user.updated, user.deleted.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req); // reads CLERK_WEBHOOK_SIGNING_SECRET
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  const db = createAdminSupabase();
  if (evt.type === "user.updated") {
    const u = evt.data;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    const email = u.email_addresses.find((e) => e.id === u.primary_email_address_id)?.email_address;
    await db
      .from("users")
      .update({ ...(name ? { name } : {}), ...(email ? { email } : {}) })
      .eq("clerk_id", u.id);
  } else if (evt.type === "user.deleted" && evt.data.id) {
    await db.from("users").update({ active: false }).eq("clerk_id", evt.data.id);
  }
  return new Response("ok");
}
