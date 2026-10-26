"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { saveTextTemplate } from "@/server/actions/settings";

export type TemplateRow = {
  key: string;
  label: string;
  body: string;
  stage_key: string | null;
  after_days: number | null;
  sort_order: number;
  active: boolean;
};

/** One ready-made text: name, words, which stage it belongs to, and on which day it's suggested. */
export function TextTemplateEditor({
  row,
  stages,
}: {
  row: TemplateRow | null; // null = add a new one
  stages: { key: string; label: string }[];
}) {
  const [state, action] = useActionState(saveTextTemplate, null);
  const [body, setBody] = useState(row?.body ?? "");
  const [stage, setStage] = useState(row?.stage_key ?? "");
  const id = row?.key ?? "new";
  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
      <input type="hidden" name="key" value={row?.key ?? ""} />
      <input type="hidden" name="sort_order" value={row?.sort_order ?? 500} />
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
        <Field label="Name" htmlFor={`label-${id}`}>
          <Input id={`label-${id}`} name="label" defaultValue={row?.label ?? ""} placeholder="Say thanks" required />
        </Field>
        <Field label="Stage" htmlFor={`stage-${id}`}>
          <NativeSelect id={`stage-${id}`} name="stage_key" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Any stage (only when I pick it)</option>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Suggest on day" htmlFor={`days-${id}`}>
          <Input
            id={`days-${id}`}
            name="after_days"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            disabled={!stage}
            defaultValue={row?.after_days ?? ""}
            placeholder="manual"
          />
        </Field>
      </div>
      <Field label="Message" htmlFor={`body-${id}`}>
        <Textarea id={`body-${id}`} name="body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={row?.active ?? true} className="size-5" /> Show it on deals
        </label>
        <span className={body.length > 320 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {body.length} chars{body.length > 160 ? " · shorter gets more replies" : ""}
        </span>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant={row ? "secondary" : "default"} className="w-full sm:w-auto">
        {row ? "Save" : "Add text"}
      </SubmitButton>
    </form>
  );
}
