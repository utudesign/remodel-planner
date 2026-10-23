import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { BottomNav, SidebarNav } from "@/components/shared/nav";
import { Fab } from "@/components/shared/fab";
import { navFor, tabsFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/require-role";
import { unreadNotificationCount } from "@/server/queries/team";

function BellLink({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
      className="relative p-2"
    >
      <Bell className="size-5 text-muted-foreground" />
      {count ? (
        <span className="absolute top-0.5 right-0.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const unread = await unreadNotificationCount(session);
  const crew = session.role === "crew";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
        <div className="flex items-center justify-between px-3">
          <Link href="/today" className="text-base font-semibold tracking-tight">
            {session.companyName}
          </Link>
          <BellLink count={unread} />
        </div>
        <SidebarNav items={navFor(session.role)} />
        <div className="mt-auto flex flex-col gap-3 px-1">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/today"
            afterCreateOrganizationUrl="/today"
          />
          <div className="flex items-center gap-2 px-2 text-sm">
            <UserButton />
            <div className="min-w-0">
              <p className="truncate font-medium">{session.name || "You"}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABELS[session.role]}</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:hidden">
          <Link href="/today" className="truncate font-semibold tracking-tight">
            {session.companyName}
          </Link>
          <div className="flex items-center gap-1">
            <BellLink count={unread} />
            <UserButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-36 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>
      {!crew ? <Fab /> : null}
      <BottomNav items={tabsFor(session.role)} />
    </div>
  );
}
