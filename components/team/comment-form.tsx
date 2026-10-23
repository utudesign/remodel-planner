"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { FormMessage, SubmitButton, useActionWithSuccess } from "@/components/shared/form";
import { PhotoInput } from "@/components/shared/photo-input";
import { addComment } from "@/server/actions/comments";

export function CommentForm({
  entityType,
  entityId,
  people,
}: {
  entityType: "deal" | "project" | "task";
  entityId: string;
  people: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [state, action] = useActionWithSuccess(addComment, () => formRef.current?.reset());

  function mention(name: string) {
    const el = areaRef.current;
    if (!el) return;
    const tag = `@${name.split(/\s+/)[0]} `;
    el.value = el.value ? `${el.value.trimEnd()} ${tag}` : tag;
    el.focus();
  }

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <Textarea
        ref={areaRef}
        name="body"
        rows={2}
        required
        placeholder="Write a note… use @name to notify someone"
      />
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => mention(p.name)}
            className="h-8 rounded-full border px-3 text-xs text-muted-foreground"
          >
            @{p.name.split(/\s+/)[0]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PhotoInput />
        <SubmitButton className="h-11">Post</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
