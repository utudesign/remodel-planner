import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { MarkAllRead } from "@/components/shared/mark-all-read";
import { getSession } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { must } from "@/server/action-utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const s = await getSession();
  const items = must(
    await s.db
      .from("notifications")
      .select("id, title, body, url, created_at, read_at")
      .eq("user_id", s.userId)
      .order("created_at", { ascending: false })
      .limit(60),
  );
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" actions={unread ? <MarkAllRead /> : null} />
      {items.length === 0 ? (
        <EmptyState title="No notifications" description="New leads, booked visits and job updates show up here." />
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
          {items.map((n) => (
            <li key={n.id}>
              <Link href={n.url} className={cn("flex min-h-14 gap-3 px-4 py-3", !n.read_at && "bg-accent/50")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} />
                <span className="min-w-0">
                  <span className="block font-medium">{n.title}</span>
                  {n.body ? <span className="block truncate text-sm text-muted-foreground">{n.body}</span> : null}
                  <span className="block text-xs text-muted-foreground">{formatDateTime(n.created_at, s.timezone)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
