import Link from "next/link";
import { Settings } from "lucide-react";
import { BottomNav, SidebarNav } from "@/components/shared/nav";
import { navFor } from "@/lib/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const items = navFor("admin"); // replaced by the signed-in user's role in Step 2
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-3 py-5 md:flex">
        <Link href="/today" className="px-3 text-base font-semibold tracking-tight">
          Remodel Planner
        </Link>
        <SidebarNav items={items} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
          <Link href="/today" className="font-semibold tracking-tight">
            Remodel Planner
          </Link>
          <Link href="/settings" aria-label="Settings" className="text-muted-foreground">
            <Settings className="size-5" />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-24 md:px-8 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}
