import webpush from "web-push";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { readSettings } from "@/lib/auth/require-role";
import { isDayJob } from "@/lib/workday";

/**
 * Sends pending notifications as Web Push (CONTEXT §4). Runs after mutations (next/server `after`)
 * and from the cron route. Service role: it reads other users' subscriptions, nothing else.
 * No VAPID keys configured → notifications stay in-app only.
 */
let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  configured = !!(pub && priv);
  if (configured)
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:owner@example.com", pub!, priv!);
  return configured;
}

export async function flushNotifications(
  companyId?: string,
): Promise<{ sent: number; skipped: number }> {
  const db = createAdminSupabase();
  let q = db
    .from("notifications")
    .select("id, user_id, kind, title, body, url, company:companies(timezone, settings_json)")
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 12 * 3600_000).toISOString())
    .limit(200);
  if (companyId) q = q.eq("company_id", companyId);
  const { data: pending } = await q;
  if (!pending?.length) return { sent: 0, skipped: 0 };

  // During the day job only new leads go out; everything else waits for the 3:30 PM run.
  const at = new Date();
  const ready = pending.filter((n) => {
    if (n.kind === "new_lead" || !n.company) return true;
    const st = readSettings((n.company.settings_json ?? {}) as Record<string, unknown>);
    return !isDayJob(at, st.workday, n.company.timezone);
  });
  if (!ready.length) return { sent: 0, skipped: pending.length };
  const now = at.toISOString();
  if (!configure()) {
    await db
      .from("notifications")
      .update({ pushed_at: now })
      .in(
        "id",
        ready.map((n) => n.id),
      );
    return { sent: 0, skipped: pending.length };
  }

  const userIds = [...new Set(ready.map((n) => n.user_id))];
  const { data: unread } = await db
    .from("notifications")
    .select("user_id")
    .in("user_id", userIds)
    .is("read_at", null);
  const badge = (uid: string) => (unread ?? []).filter((u) => u.user_id === uid).length;
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys")
    .in("user_id", userIds);
  let sent = 0;
  for (const n of ready) {
    for (const sub of (subs ?? []).filter((x) => x.user_id === n.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.id, badge: badge(n.user_id) }),
          { TTL: 3600 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410)
          await db.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  await db
    .from("notifications")
    .update({ pushed_at: now })
    .in(
      "id",
      ready.map((n) => n.id),
    );
  return { sent, skipped: pending.length - ready.length };
}

/** Push to specific users right now (digest, scheduled-message reminders). */
export async function pushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url: string; kind: string },
) {
  if (!configure() || userIds.length === 0) return 0;
  const db = createAdminSupabase();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys")
    .in("user_id", userIds);
  let sent = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
        JSON.stringify(payload),
        { TTL: 3600 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410)
        await db.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }
  return sent;
}
