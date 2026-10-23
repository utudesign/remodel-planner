import Link from "next/link";
import { PageHeader } from "@/components/shared/states";
import { FeedList } from "@/components/team/feed-list";
import { requirePageRole } from "@/lib/auth/require-role";
import { cn } from "@/lib/utils";
import { getFeed, getTeamMembers } from "@/server/queries/team";

export const metadata = { title: "Activity" };

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; money?: string }>;
}) {
  const { who, money } = await searchParams;
  const s = await requirePageRole("owner", "team");
  const [team, items] = await Promise.all([
    getTeamMembers(s),
    getFeed(s, { limit: 100, actorId: who, money: money === "1" }),
  ]);
  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "flex h-9 items-center whitespace-nowrap rounded-full border px-3 text-sm",
        active ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader title="Activity" description="Everything the team did, newest first." />
      <nav className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {chip("/activity", "Everyone", !who && !money)}
        {team
          .filter((u) => u.role !== "crew")
          .map((u) => chip(`/activity?who=${u.id}`, u.name.split(" ")[0] || "—", who === u.id))}
        {chip("/activity?money=1", "Money", money === "1")}
      </nav>
      <div className="rounded-xl border bg-card p-4">
        <FeedList items={items} tz={s.timezone} now={new Date()} />
      </div>
    </>
  );
}
