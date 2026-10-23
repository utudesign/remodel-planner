import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { env } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Server-only.
 * Used ONLY by the Clerk webhook and first-sign-in bootstrap (bootstrap_membership RPC).
 * Never use it for user-driven reads or writes.
 */
export function createAdminSupabase() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
