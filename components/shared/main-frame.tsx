"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Boards and job views use the whole screen (Asana-style); reading pages stay at a comfortable width. */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const p = usePathname();
  const wide = p === "/deals" || p === "/jobs" || p.startsWith("/jobs/");
  return (
    <main className={cn("mx-auto w-full flex-1 px-4 pt-5 pb-40 lg:px-8 lg:pt-8 lg:pb-12", wide ? "max-w-none" : "max-w-5xl")}>
      {children}
    </main>
  );
}
