import Link from "next/link";
import { BarChart3, Bell, ChevronRight, LayoutDashboard, Rss, Settings } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/states";
import { MuteForm } from "@/components/team/mute-form";
import { PushToggle } from "@/components/team/push-toggle";
import { requirePageRole } from "@/lib/auth/require-role";
import { NOTIFY_KINDS } from "@/lib/notify";
import { must } from "@/server/action-utils";

export const metadata = { title: "More" };

export default async function MorePage() {
  const s = await requirePageRole("owner", "team");
  const me = must(await s.db.from("users").select("notify_prefs").eq("id", s.userId).single());
  const muted = ((me.notify_prefs ?? {}) as { mute?: string[] }).mute ?? [];
  const links = [
    { href: "/command", label: "Command center", icon: LayoutDashboard, hint: "Shift queue, checklists, handoff" },
    { href: "/activity", label: "Activity", icon: Rss, hint: "Everything the team did" },
    { href: "/notifications", label: "Notifications", icon: Bell, hint: "Your inbox" },
    { href: "/analytics", label: "Analytics", icon: BarChart3, hint: "Margin per job" },
    ...(s.role === "owner" ? [{ href: "/settings", label: "Settings", icon: Settings, hint: "Team, windows, rules" }] : []),
  ];
  return (
    <>
      <PageHeader title="More" />
      <ul className="mb-5 flex flex-col divide-y rounded-xl border bg-card">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-14 items-center gap-3 px-4">
              <l.icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Push on this phone</CardTitle>
            <CardDescription>Each phone turns it on once.</CardDescription>
          </CardHeader>
          <CardContent>
            <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What I get notified about</CardTitle>
          </CardHeader>
          <CardContent>
            <MuteForm kinds={NOTIFY_KINDS} muted={muted} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
