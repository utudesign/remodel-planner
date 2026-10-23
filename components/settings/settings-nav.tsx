"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "Me & my hours" },
  { href: "/settings/pipeline", label: "Stages & follow-ups" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm text-muted-foreground",
            pathname === t.href && "border-primary font-medium text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
