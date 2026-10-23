import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { roleFromClerk } from "@/lib/auth/roles";

/**
 * Clerk → Supabase sync. Subscribe to: organization.created, organization.updated,
 * organizationMembership.created, organizationMembership.deleted, user.updated, user.deleted.
 * Roles are only set when a membership is first created; after that, Settings → Users owns them.
 */
export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req); // reads CLERK_WEBHOOK_SIGNING_SECRET
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = createAdminSupabase();

  switch (evt.type) {
    case "organization.created":
    case "organization.updated": {
      const { error } = await db.rpc("bootstrap_membership", {
        p_clerk_org_id: evt.data.id,
        p_org_name: evt.data.name,
        p_clerk_user_id: null as unknown as string,
        p_name: "",
        p_email: "",
        p_role: "field",
      });
      if (error) return new Response(error.message, { status: 500 });
      break;
    }
    case "organizationMembership.created": {
      const m = evt.data;
      const u = m.public_user_data;
      if (!u) break;
      const { error } = await db.rpc("bootstrap_membership", {
        p_clerk_org_id: m.organization.id,
        p_org_name: m.organization.name,
        p_clerk_user_id: u.user_id,
        p_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || (u.identifier ?? ""),
        p_email: u.identifier ?? "",
        p_role: roleFromClerk(m.role),
      });
      if (error) return new Response(error.message, { status: 500 });
      break;
    }
    case "organizationMembership.deleted": {
      const m = evt.data;
      const { data: company } = await db
        .from("companies")
        .select("id")
        .eq("clerk_org_id", m.organization.id)
        .maybeSingle();
      if (company && m.public_user_data) {
        await db
          .from("users")
          .update({ active: false })
          .eq("company_id", company.id)
          .eq("clerk_id", m.public_user_data.user_id);
      }
      break;
    }
    case "user.updated": {
      const u = evt.data;
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
      const email = u.email_addresses.find(
        (e) => e.id === u.primary_email_address_id,
      )?.email_address;
      await db
        .from("users")
        .update({ ...(name ? { name } : {}), ...(email ? { email } : {}) })
        .eq("clerk_id", u.id);
      break;
    }
    case "user.deleted": {
      if (evt.data.id) await db.from("users").update({ active: false }).eq("clerk_id", evt.data.id);
      break;
    }
  }
  return new Response("ok");
}
