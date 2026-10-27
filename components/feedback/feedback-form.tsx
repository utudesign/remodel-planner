"use client";

import { useActionState, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { saveFeedback } from "@/server/actions/feedback";

/** One area: 1–5 stars, what works, what to change. Prefilled with what I said before. */
export function FeedbackForm({
  area,
  label,
  ask,
  saved,
}: {
  area: string;
  label: string;
  ask: string;
  saved: { rating: number | null; works: string; change: string } | null;
}) {
  const [state, action] = useActionState(saveFeedback, null);
  const [rating, setRating] = useState<number | null>(saved?.rating ?? null);
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="rating" value={rating ?? ""} />
      <div>
        <h2 className="font-semibold">{label}</h2>
        <p className="text-sm text-muted-foreground">{ask}</p>
      </div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={`${label} rating`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} of 5`}
            onClick={() => setRating(rating === n ? null : n)}
            className={cn(
              "flex size-11 items-center justify-center rounded-xl text-lg font-bold ring-1",
              rating !== null && n <= rating ? "bg-primary text-primary-foreground ring-primary" : "bg-card ring-border",
            )}
          >
            {n}
          </button>
        ))}
        <span className="ml-2 self-center text-xs text-muted-foreground">1 = doesn&apos;t work · 5 = perfect</span>
      </div>
      <Textarea name="works" rows={2} defaultValue={saved?.works ?? ""} placeholder="What works well?" aria-label="What works well" />
      <Textarea name="change" rows={2} defaultValue={saved?.change ?? ""} placeholder="What's confusing or missing?" aria-label="What to change" />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full sm:w-auto">
        {saved ? "Update" : "Send"}
      </SubmitButton>
    </form>
  );
}
