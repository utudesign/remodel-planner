import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { env } from "@/lib/env";

export type Db = ReturnType<typeof createServerSupabase>;

/**
 * Per-request Supabase client that runs as the signed-in Clerk user.
 * Supabase verifies the Clerk session token (third-party auth), so every query goes through RLS.
 */
export function createServerSupabase() {
  return createClient<Database>(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    accessToken: async () => (await auth()).getToken(),
    auth: { persistSession: false },
  });
}
