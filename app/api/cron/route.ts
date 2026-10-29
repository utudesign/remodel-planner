import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { readSettings } from "@/lib/auth/require-role";
import { isDigestRun } from "@/lib/workday";
import { flushNotifications, pushToUsers } from "@/server/push";
import { digestFor } from "@/server/digest";

/**
 * Vercel cron (vercel.json): 19:30 and 20:30 UTC, Monday–Friday. One of the two runs is
 * 3:30 PM in New York (EDT or EST); that run sends each workspace admin's digest (0016) (SALES-REP-MODE §7).
 * Every run also sends any pushes still waiting. Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const now = new Date();
  const force = req.nextUrl.searchParams.get("digest") === "1";
  const result: Record<string, number> = { pushed: (await flushNotifications()).sent, digests: 0 };

  const db = createAdminSupabase();
  const { data: owners } = await db
    .from("users")
    .select("id, workspace_id, company:companies(id, timezone, settings_json)")
    .or("role.eq.owner,workspace_admin.eq.true")
    .eq("active", true);
  for (const o of owners ?? []) {
    if (!o.company) continue;
    const st = readSettings((o.company.settings_json ?? {}) as Record<string, unknown>);
    if (!force && !isDigestRun(now, st.digestTime, st.workday.days, o.company.timezone)) continue;
    const d = await digestFor(o.company.id, o.company.timezone, now, o.workspace_id);
    if (!d) continue;
    result.digests += await pushToUsers([o.id], { kind: "digest", title: d.title, body: d.body, url: "/today" });
  }
  return NextResponse.json(result);
}
