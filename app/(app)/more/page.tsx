import Link from "next/link";
import { Bell, ChevronRight, Handshake, MessageSquare, Settings, SlidersHorizontal } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/states";
import { PushToggle } from "@/components/shared/push-toggle";
import { requireOwner } from "@/lib/auth/require-role";
import { CopyButton } from "@/components/shared/copy-button";
import { appUrl } from "@/lib/app-url";

export const metadata = { title: "More" };

export default async function MorePage() {
  const s = await requireOwner();
  const { data: link } = await s.db
    .from("lead_links")
    .select("slug, active")
    .eq("company_id", s.companyId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const shareUrl = link ? `${await appUrl()}/l/${link.slug}` : null;
  const links = [
    { href: "/partners", label: "Partners + commission plans", icon: Handshake, hint: "RenoDesign, plans, Crystal's login" },
    { href: "/notifications", label: "Notifications", icon: Bell, hint: "Everything that happened" },
    { href: "/settings", label: "Settings", icon: Settings, hint: "Hours, booking slots, tax, mileage, auto-reply" },
    { href: "/settings/texts", label: "My texts", icon: MessageSquare, hint: "On my way, thanks, estimate follow-ups" },
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
      {shareUrl ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>My share link</CardTitle>
            <CardDescription>
              Post it in Facebook groups. People fill a short form and land on Today as a new lead.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="truncate rounded-xl bg-secondary px-3 py-2.5 font-mono text-sm">{shareUrl}</p>
            <div className="flex gap-2">
              <CopyButton text={shareUrl} label="Copy link" />
              <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-semibold text-primary">
                Preview
              </a>
            </div>
          </CardContent>
        </Card>
      ) : null}
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
