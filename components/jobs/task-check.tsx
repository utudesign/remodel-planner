"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateTask } from "@/server/actions/jobs-pm";

/** Done / not done circle for a task in lists (My work). */
export function TaskCheck({ id, done, label }: { id: string; done: boolean; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reopen ${label}` : `Mark ${label} done`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await updateTask({ id, status: done ? "doing" : "done" });
          router.refresh();
        })
      }
      className="flex size-11 shrink-0 items-center justify-center"
    >
      <span className={cn("flex size-6 items-center justify-center rounded-full", done ? "bg-primary text-primary-foreground" : "ring-2 ring-input")}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : done ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  );
}
