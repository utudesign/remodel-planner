"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { setTheme } from "@/server/actions/theme";

/** More → Appearance: Dark (Asana-style) or Light. Saved on this device. */
export function ThemeToggle({ theme }: { theme: "dark" | "light" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (t: "dark" | "light") =>
    start(async () => {
      document.documentElement.classList.toggle("dark", t === "dark");
      await setTheme(t);
      router.refresh();
    });
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Appearance">
      {(
        [
          ["dark", "Dark", Moon],
          ["light", "Light", Sun],
        ] as const
      ).map(([k, label, Icon]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={theme === k}
          disabled={pending}
          onClick={() => pick(k)}
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold ring-1 ring-border",
            theme === k ? "bg-primary text-primary-foreground ring-primary" : "bg-card",
          )}
        >
          <Icon className="size-4" /> {label}
        </button>
      ))}
    </div>
  );
}
