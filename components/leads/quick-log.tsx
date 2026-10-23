"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mail, MessageCircle, MessageSquare, NotebookPen, Phone, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { cn } from "@/lib/utils";
import { logActivity } from "@/server/actions/leads";

const TYPES = [
  { value: "call", label: "Call", icon: Phone },
  { value: "text", label: "Text", icon: MessageSquare },
  { value: "fb_msg", label: "FB", icon: MessageCircle },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Met", icon: Users },
  { value: "note", label: "Note", icon: NotebookPen },
] as const;

/** One-tap log (spec §5). Next follow-up is required and pre-filled from the stage's rules. */
export function QuickLog({ leadId, suggested }: { leadId: string; suggested: string }) {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("call");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [state, action] = useActionState(logActivity, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-6 gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setType(t.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md border py-2 text-xs font-medium text-muted-foreground",
              type === t.value && "border-primary bg-primary text-primary-foreground",
            )}
            aria-pressed={type === t.value}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      {type !== "note" ? (
        <div className="grid grid-cols-2 gap-1.5 text-sm">
          {(["out", "in"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={cn(
                "rounded-md border py-1.5 font-medium text-muted-foreground",
                direction === d && "border-foreground text-foreground",
              )}
              aria-pressed={direction === d}
            >
              {d === "out" ? "I reached out" : "They reached out"}
            </button>
          ))}
        </div>
      ) : null}
      <Textarea name="summary" placeholder="What happened? (optional)" rows={2} />
      <Field
        label="Next follow-up"
        htmlFor="next_follow_up_at"
        hint="Suggested from this stage's follow-up rules"
      >
        <Input
          id="next_follow_up_at"
          name="next_follow_up_at"
          type="datetime-local"
          required
          defaultValue={suggested}
          key={suggested}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Log it</SubmitButton>
    </form>
  );
}
