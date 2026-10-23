import type { Session } from "@/lib/auth/require-role";
import { signedUrls } from "@/lib/storage";
import { must } from "@/server/action-utils";

export type CommentView = {
  id: string;
  body: string;
  created_at: string;
  author: { id: string; name: string } | null;
  photos: string[];
};

export async function getComments(
  s: Session,
  entityType: "lead" | "project" | "task",
  entityId: string,
): Promise<CommentView[]> {
  const rows = must(
    await s.db
      .from("comments")
      .select("id, body, created_at, photo_paths, author:users(id, name)")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at"),
  );
  const urls = await signedUrls(
    rows.flatMap((r) => r.photo_paths),
    s.companyId,
  );
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    created_at: r.created_at,
    author: r.author,
    photos: r.photo_paths.map((p) => urls[p]).filter(Boolean),
  }));
}

/** Remember when I last looked at a record (unread dots). Called during render, non-blocking. */
export async function recordView(s: Session, entityType: "lead" | "project", entityId: string) {
  await s.db.from("record_views").upsert({
    user_id: s.userId,
    entity_type: entityType,
    entity_id: entityId,
    last_seen_at: new Date().toISOString(),
  });
}

/**
 * Unread = someone else changed the record since I last opened it.
 * Small company: read the last 14 days of events and compare in memory.
 */
export async function getUnread(
  s: Session,
): Promise<{ leads: Set<string>; projects: Set<string> }> {
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [events, views] = await Promise.all([
    s.db
      .from("events")
      .select("lead_id, project_id, actor_id, created_at")
      .gte("created_at", since)
      .neq("actor_id", s.userId),
    s.db
      .from("record_views")
      .select("entity_type, entity_id, last_seen_at")
      .eq("user_id", s.userId),
  ]);
  const seen = new Map(must(views).map((v) => [`${v.entity_type}:${v.entity_id}`, v.last_seen_at]));
  const leads = new Set<string>();
  const projects = new Set<string>();
  for (const e of must(events)) {
    if (e.lead_id) {
      const t = seen.get(`lead:${e.lead_id}`);
      if (!t || t < e.created_at) leads.add(e.lead_id);
    }
    if (e.project_id) {
      const t = seen.get(`project:${e.project_id}`);
      if (!t || t < e.created_at) projects.add(e.project_id);
    }
  }
  return { leads, projects };
}

export type FeedItem = {
  id: string;
  verb: string;
  summary: string;
  created_at: string;
  publish_at: string;
  pinned_until: string | null;
  has_money: boolean;
  actor: { id: string; name: string } | null;
  lead_id: string | null;
  project_id: string | null;
};

export async function getFeed(
  s: Session,
  opts: {
    limit?: number;
    actorId?: string;
    projectId?: string;
    money?: boolean;
    since?: string;
  } = {},
): Promise<FeedItem[]> {
  let q = s.db
    .from("events")
    .select(
      "id, verb, summary, created_at, publish_at, pinned_until, has_money, lead_id, project_id, actor:users(id, name)",
    )
    .order("publish_at", { ascending: false })
    .limit(opts.limit ?? 50);
  if (opts.actorId) q = q.eq("actor_id", opts.actorId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.money) q = q.eq("has_money", true);
  if (opts.since) q = q.gte("publish_at", opts.since);
  return must(await q);
}

export async function getNotifications(s: Session, limit = 30) {
  return must(
    await s.db
      .from("notifications")
      .select("id, kind, title, body, url, read_at, created_at")
      .eq("user_id", s.userId)
      .order("created_at", { ascending: false })
      .limit(limit),
  );
}

export async function unreadNotificationCount(s: Session) {
  const { count } = await s.db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", s.userId)
    .is("read_at", null);
  return count ?? 0;
}

export async function getTeamMembers(s: Session) {
  return must(
    await s.db
      .from("users")
      .select("id, name, role, active, avatar_url")
      .eq("active", true)
      .order("name"),
  );
}
