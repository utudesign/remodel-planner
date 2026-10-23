"use client";

import { useActionState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton } from "@/components/shared/form";
import { postHandoff } from "@/server/actions/command";

export function HandoffForm({
  kind,
  date,
  draft,
  posted,
}: {
  kind: "live" | "back_office";
  date: string;
  draft: string;
  posted: boolean;
}) {
  const [state, action] = useActionState(postHandoff, null);
  if (posted || state?.ok) {
    return (
      <div className="flex flex-col gap-2">
        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
          {state?.ok ? "Posted." : draft}
        </p>
        <FormMessage state={state} />
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="date" value={date} />
      <Textarea name="body" rows={6} defaultValue={draft} />
      <p className="text-xs text-muted-foreground">
        {kind === "back_office"
          ? "The morning brief publishes to everyone's feed at 7:00 AM ET and stays pinned for 24 hours."
          : "Posts to the team feed now, pinned for 24 hours."}
      </p>
      <FormMessage state={state} />
      <SubmitButton className="h-11 w-fit">
        {kind === "back_office" ? "Post morning brief" : "Post handoff"}
      </SubmitButton>
    </form>
  );
}
