import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/shared/states";
import { MarkAllRead } from "@/components/team/mark-all-read";
import { getSession } from "@/lib/auth/require-role";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getNotifications } from "@/server/queries/team";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const s = await getSession();
  const items = await getNotifications(s, 60);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader title="Notifications" actions={unread ? <MarkAllRead /> : null} />
      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          description="New leads, @mentions and payments show up here."
        />
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.url}
                className={cn("flex min-h-14 gap-3 px-4 py-3", !n.read_at && "bg-primary/5")}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.read_at ? "bg-transparent" : "bg-primary",
                  )}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{n.title}</span>
                  {n.body ? (
                    <span className="block truncate text-sm text-muted-foreground">{n.body}</span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(n.created_at, s.timezone)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
