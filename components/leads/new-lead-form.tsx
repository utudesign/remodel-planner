"use client";

import { useActionState, useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { PhotoInput } from "@/components/shared/photo-input";
import { parseQuickAdd } from "@/lib/quick-add";
import { LEAD_SOURCES, SCOPES } from "@/lib/validation/lead";
import { createLead } from "@/server/actions/leads";

/** New lead, with quick-add: paste a Marketplace/text/email message (+ screenshot) and check the fields. */
export function NewLeadForm({ paste }: { paste: boolean }) {
  const [state, action] = useActionState(createLead, null);
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
    source: paste ? "fb_marketplace" : "call",
  });
  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setF((x) => ({ ...x, [k]: e.target.value }));

  function onPaste(text: string) {
    const g = parseQuickAdd(text);
    setF((x) => ({
      ...x,
      name: x.name || g.name || "",
      phone: x.phone || g.phone || "",
      email: x.email || g.email || "",
      notes: g.notes,
    }));
  }

  return (
    <form action={action} className="grid grid-cols-2 gap-3">
      <div className="col-span-2 rounded-lg border border-dashed p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <ClipboardPaste className="size-4" /> Paste a message
        </p>
        <Textarea
          rows={3}
          autoFocus={paste}
          placeholder="Paste the Marketplace / text / email message here. Name, phone and email are filled in for you."
          onChange={(e) => onPaste(e.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Or attach a screenshot of the conversation:
        </p>
        <PhotoInput label="Screenshot" className="mt-1" />
      </div>
      <Field label="Name" htmlFor="name" className="col-span-2">
        <Input
          id="name"
          name="name"
          required
          value={f.name}
          onChange={set("name")}
          autoComplete="off"
        />
      </Field>
      <Field label="Phone" htmlFor="phone">
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          value={f.phone}
          onChange={set("phone")}
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" value={f.email} onChange={set("email")} />
      </Field>
      <Field label="Source" htmlFor="source">
        <NativeSelect id="source" name="source" value={f.source} onChange={set("source")}>
          {LEAD_SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Scope" htmlFor="scope">
        <NativeSelect id="scope" name="scope" defaultValue="">
          <option value="">Not sure yet</option>
          {SCOPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Budget from ($)" htmlFor="budget_min">
        <Input id="budget_min" name="budget_min" inputMode="decimal" placeholder="8,000" />
      </Field>
      <Field label="Budget to ($)" htmlFor="budget_max">
        <Input id="budget_max" name="budget_max" inputMode="decimal" placeholder="12,000" />
      </Field>
      <Field label="City" htmlFor="city">
        <Input id="city" name="city" />
      </Field>
      <Field label="Timeline" htmlFor="desired_timeline">
        <Input id="desired_timeline" name="desired_timeline" placeholder="Before Thanksgiving" />
      </Field>
      <Field label="Notes" htmlFor="notes" className="col-span-2">
        <Textarea id="notes" name="notes" rows={4} value={f.notes} onChange={set("notes")} />
      </Field>
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] col-span-2 flex flex-col gap-2 bg-background py-2 lg:static">
        <FormMessage state={state} />
        <SubmitButton className="h-12 w-full text-base">Create lead</SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          Goes to whoever is live now; otherwise the default owner. The 1-hour reply clock starts
          now.
        </p>
      </div>
    </form>
  );
}
