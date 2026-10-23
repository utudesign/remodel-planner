import webpush from "web-push";
import { createAdminSupabase } from "@/lib/supabase/admin";

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

type Prefs = { mute?: string[] };

export async function flushNotifications(
  companyId?: string,
): Promise<{ sent: number; skipped: number }> {
  const db = createAdminSupabase();
  let q = db
    .from("notifications")
    .select("id, user_id, kind, title, body, url, user:users(notify_prefs)")
    .is("pushed_at", null)
    .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .limit(200);
  if (companyId) q = q.eq("company_id", companyId);
  const { data: pending } = await q;
  if (!pending?.length) return { sent: 0, skipped: 0 };

  const now = new Date().toISOString();
  if (!configure()) {
    await db
      .from("notifications")
      .update({ pushed_at: now })
      .in(
        "id",
        pending.map((n) => n.id),
      );
    return { sent: 0, skipped: pending.length };
  }

  const userIds = [...new Set(pending.map((n) => n.user_id))];
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, keys")
    .in("user_id", userIds);
  let sent = 0;
  for (const n of pending) {
    const muted = ((n.user?.notify_prefs ?? {}) as Prefs).mute?.includes(n.kind);
    if (muted) continue;
    for (const sub of (subs ?? []).filter((x) => x.user_id === n.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys as { p256dh: string; auth: string } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.id }),
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
      pending.map((n) => n.id),
    );
  return { sent, skipped: pending.length - sent };
}

/** Push to specific users right now (digest, scheduled-message reminders). */
export async function pushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url: string; kind: string },
) {
  if (!configure() || userIds.length === 0) return 0;
  const db = createAdminSupabase();
  const [{ data: subs }, { data: users }] = await Promise.all([
    db.from("push_subscriptions").select("id, user_id, endpoint, keys").in("user_id", userIds),
    db.from("users").select("id, notify_prefs").in("id", userIds),
  ]);
  let sent = 0;
  for (const sub of subs ?? []) {
    const prefs = (users?.find((u) => u.id === sub.user_id)?.notify_prefs ?? {}) as Prefs;
    if (prefs.mute?.includes(payload.kind)) continue;
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
