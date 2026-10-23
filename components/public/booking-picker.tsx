"use client";

import { useActionState, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { bookSlot } from "@/server/actions/public";

export type Day = { date: string; label: string; slots: { start: string; label: string }[] };

export function BookingPicker({ token, days }: { token: string; days: Day[] }) {
  const [state, action] = useActionState(bookSlot, null);
  const [picked, setPicked] = useState<string | null>(null);
  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
        <CalendarCheck className="size-10 text-primary" />
        <p className="text-lg font-semibold">You&apos;re booked</p>
        <p className="text-muted-foreground">{state.message}. I&apos;ll text you the day before.</p>
      </div>
    );
  }
  if (!days.length) {
    return <p className="rounded-2xl bg-card p-5 ring-1 ring-border">No open times in the next two weeks. Please text me and we&apos;ll find one.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="start" value={picked ?? ""} />
      {days.map((d) => (
        <section key={d.date}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{d.label}</h2>
          <div className="grid grid-cols-3 gap-2">
            {d.slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => setPicked(s.start)}
                aria-pressed={picked === s.start}
                className={cn(
                  "h-12 rounded-xl text-[15px] font-semibold ring-1 ring-border",
                  picked === s.start ? "bg-primary text-primary-foreground ring-primary" : "bg-card",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>
      ))}
      <FormMessage state={state} />
      <div className="sticky bottom-0 -mx-4 bg-background/95 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <SubmitButton size="lg" className="w-full">
          {picked ? "Book this time" : "Pick a time above"}
        </SubmitButton>
      </div>
    </form>
  );
}
