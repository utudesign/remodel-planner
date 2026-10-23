import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Settings } from "lucide-react";
import { BottomNav, SidebarNav } from "@/components/shared/nav";
import { navFor } from "@/lib/nav";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getSession } from "@/lib/auth/require-role";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const items = navFor(session.role);
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-3 py-5 md:flex">
        <Link href="/today" className="px-3 text-base font-semibold tracking-tight">
          Remodel Planner
        </Link>
        <SidebarNav items={items} />
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur md:hidden">
          <Link href="/today" className="truncate font-semibold tracking-tight">
            {session.companyName}
          </Link>
          <div className="flex items-center gap-3">
            {session.role === "admin" ? (
              <Link href="/settings" aria-label="Settings" className="text-muted-foreground">
                <Settings className="size-5" />
              </Link>
            ) : null}
            <UserButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:px-8 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
