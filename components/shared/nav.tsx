"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, FolderKanban, GanttChart, Menu, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIcon, NavItem } from "@/lib/nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  today: CalendarCheck,
  deals: FolderKanban,
  money: Wallet,
  more: Menu,
  jobs: GanttChart,
  kpis: BarChart3,
};

const MORE_PATHS = ["/more", "/settings", "/notifications", "/partners"];

function isActive(pathname: string, href: string) {
  if (href === "/more")
    return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  items,
  badges,
}: {
  items: NavItem[];
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const n = badges?.[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              isActive(pathname, item.href) && "bg-accent text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
            {n ? (
              <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white">
                {n}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({
  items,
  badges,
}: {
  items: NavItem[];
  badges?: Partial<Record<string, number>>;
}) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item.href);
          const n = badges?.[item.href];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground",
                  active && "text-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                {item.label}
                {n ? (
                  <span className="absolute top-1.5 left-1/2 ml-2 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold text-white">
                    {n}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
