import Link from "next/link";
import { Bell, ChevronRight, Handshake, Settings, SlidersHorizontal } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/states";
import { PushToggle } from "@/components/shared/push-toggle";
import { requireOwner } from "@/lib/auth/require-role";

export const metadata = { title: "More" };

export default async function MorePage() {
  await requireOwner();
  const links = [
    { href: "/partners", label: "Partners + commission plans", icon: Handshake, hint: "RenoDesign, plans, Crystal's login" },
    { href: "/notifications", label: "Notifications", icon: Bell, hint: "Everything that happened" },
    { href: "/settings", label: "Settings", icon: Settings, hint: "Hours, booking slots, tax, mileage, auto-reply" },
    { href: "/settings/pipeline", label: "Stages + follow-ups", icon: SlidersHorizontal, hint: "My pipeline and cadence" },
  ];
  return (
    <>
      <PageHeader title="More" />
      <ul className="mb-5 flex flex-col divide-y rounded-2xl bg-card ring-1 ring-border">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-15 items-center gap-3 px-4 py-2">
              <l.icon className="size-5 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-semibold">{l.label}</span>
                <span className="block text-xs text-muted-foreground">{l.hint}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Push on this phone</CardTitle>
          <CardDescription>
            iPhone: Share → Add to Home Screen first, then open the app from the home screen and turn this on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        </CardContent>
      </Card>
      <SignOutButton>
        <button className="h-11 w-full rounded-xl bg-card text-sm font-semibold text-destructive ring-1 ring-border">Sign out</button>
      </SignOutButton>
    </>
  );
}
