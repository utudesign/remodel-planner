"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardPaste, Hammer, PhoneCall, Plus, Ruler, UserPlus, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/leads/new", label: "New lead", icon: UserPlus },
  { href: "/leads/new?paste=1", label: "Paste a message", icon: ClipboardPaste },
  { href: "/today?tab=mine#follow-ups", label: "Log call", icon: PhoneCall },
  { href: "/payments?f=open", label: "Record payment", icon: Wallet },
] as const;

const LATER = [
  { label: "Start site visit", icon: Hammer, phase: "Phase 2" },
  { label: "Ballpark", icon: Ruler, phase: "Phase 3" },
];

/** Floating + on every screen (CONTEXT §6). Site visit / ballpark arrive with Phases 2–3. */
export function Fab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 lg:bottom-6">
      {open ? (
        <>
          <button
            aria-label="Close"
            className="fixed inset-0 -z-10 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <ul className="mb-3 flex flex-col items-end gap-2">
            {LATER.map((a) => (
              <li key={a.label}>
                <span className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-md">
                  <a.icon className="size-4" /> {a.label}{" "}
                  <span className="text-[10px]">({a.phase})</span>
                </span>
              </li>
            ))}
            {ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium shadow-md"
                >
                  <a.icon className="size-4" /> {a.label}
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
          "ml-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform",
          open && "rotate-45",
        )}
      >
        {open ? <X className="size-6 -rotate-45" /> : <Plus className="size-6" />}
      </button>
    </div>
  );
}
