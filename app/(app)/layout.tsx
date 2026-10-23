import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { BottomNav, SidebarNav } from "@/components/shared/nav";
import { Fab } from "@/components/shared/fab";
import { PhotoQueueRunner } from "@/components/photos/photo-queue-runner";
import { TAB_ITEMS } from "@/lib/nav";
import { getSession } from "@/lib/auth/require-role";

function BellLink({ count }: { count: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
      className="relative flex size-11 items-center justify-center"
    >
      <Bell className="size-5 text-muted-foreground" />
      {count ? (
        <span className="absolute top-1.5 right-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}

/** The rep's app shell. Partner logins use the /p shell instead. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const { count } = await s.db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", s.userId)
    .is("read_at", null);
  const unread = count ?? 0;
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
        <div className="flex items-center justify-between px-3">
          <Link href="/today" className="truncate text-base font-semibold tracking-tight">
            Kitchen Sales
          </Link>
          <BellLink count={unread} />
        </div>
        <SidebarNav items={TAB_ITEMS} />
        <div className="mt-auto flex items-center gap-2 px-3 text-sm">
          <UserButton />
          <p className="truncate font-medium">{s.name || "You"}</p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card/95 px-4 backdrop-blur lg:hidden">
          <Link href="/today" className="truncate font-semibold tracking-tight">
            Kitchen Sales
          </Link>
          <div className="flex items-center gap-1">
            <BellLink count={unread} />
            <UserButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-40 lg:px-8 lg:pt-8 lg:pb-12">{children}</main>
      </div>
      {s.role === "owner" ? <Fab /> : null}
      {s.role === "owner" ? <PhotoQueueRunner /> : null}
      <BottomNav items={TAB_ITEMS} />
    </div>
  );
}
