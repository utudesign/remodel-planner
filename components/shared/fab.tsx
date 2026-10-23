"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calculator, Camera, ClipboardPaste, PhoneCall, PhoneMissed, Plus, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating + : New deal · Paste a message · Quick estimate · Take photos · Log call · Add expense · Log trip. */
const ACTIONS = [
  { href: "/deals/new", label: "New deal", icon: UserPlus },
  { href: "/deals/new?paste=1", label: "Paste a message", icon: ClipboardPaste },
  { href: "/deals/new?call=1", label: "Missed call", icon: PhoneMissed },
  { href: "/pick?for=estimate", label: "Quick estimate", icon: Calculator },
  { href: "/pick?for=photos", label: "Take photos", icon: Camera },
  { href: "/pick?for=log", label: "Log call", icon: PhoneCall },
] as const;

export function Fab() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  if (pathname.includes("/estimate/") || pathname.includes("/visit")) return null; // those screens have their own bottom bar
  return (
    <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 lg:bottom-6">
      {open ? (
        <>
          <button aria-label="Close" className="fixed inset-0 -z-10 bg-black/30" onClick={() => setOpen(false)} />
          <ul className="mb-3 flex flex-col items-end gap-2">
            {ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex h-12 items-center gap-2 rounded-full bg-card px-4 text-[15px] font-semibold shadow-md"
                >
                  <a.icon className="size-5" /> {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <button
        aria-label={open ? "Close quick actions" : "Quick actions"}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "ml-auto flex size-15 items-center justify-center rounded-2xl bg-foreground text-background shadow-lg transition-transform",
          open && "rotate-45",
        )}
      >
        {open ? <X className="size-6 -rotate-45" /> : <Plus className="size-7" />}
      </button>
    </div>
  );
}
