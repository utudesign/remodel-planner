import Link from "next/link";
import { Pin } from "lucide-react";
import { Avatar } from "@/components/shared/avatar";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FeedItem } from "@/server/queries/team";

export function FeedList({ items, tz, now }: { items: FeedItem[]; tz: string; now: Date }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  const pinned = items.filter((e) => e.pinned_until && new Date(e.pinned_until) > now);
  const rest = items.filter((e) => !pinned.includes(e));
  return (
    <div className="flex flex-col gap-3">
      {pinned.map((e) => (
        <div key={e.id} className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Pin className="size-3" />
            {e.verb === "handoff.brief" ? "Morning brief" : "Shift handoff"} · {e.actor?.name} ·{" "}
            {formatDateTime(e.publish_at, tz)}
          </p>
          <p className="whitespace-pre-wrap text-sm">{e.summary}</p>
        </div>
      ))}
      <ol className="flex flex-col gap-2.5">
        {rest.map((e) => {
          const href = e.project_id ? `/projects/${e.project_id}` : e.lead_id ? `/leads/${e.lead_id}` : null;
          const body = (
            <span className={cn("text-sm", e.has_money && "font-medium")}>{e.summary}</span>
          );
          return (
            <li key={e.id} className="flex gap-2.5">
              <Avatar id={e.actor?.id} name={e.actor?.name ?? "System"} className="mt-0.5" />
              <div className="min-w-0">
                {href ? (
                  <Link href={href} className="hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                <p className="text-xs text-muted-foreground">
                  {e.actor?.name ?? "System"} · {formatDateTime(e.publish_at, tz)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
