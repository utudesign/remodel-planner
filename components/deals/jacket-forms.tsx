"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { AddressInput } from "@/components/shared/address-input";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import { formatAddressLine } from "@/lib/address";
import { KNOWLEDGE, SCOPES, TIMELINES } from "@/lib/deals/display";
import { centsToInput } from "@/lib/money";
import { ACTIVITY_TYPES } from "@/lib/validation/deal";
import {
  archiveDeal,
  bookVisit,
  logActivity,
  setMeetingStatus,
  updateContact,
  updateQualify,
} from "@/server/actions/deals";
import { markVisited } from "@/server/actions/jacket";
import type { ActionState } from "@/server/action-utils";

export type QualifyValues = {
  scope: string | null;
  timeline: string | null;
  budget_min_cents: number | null;
  budget_max_cents: number | null;
  decision_maker: string | null;
  owns_home: boolean | null;
  year_built: number | null;
  knowledge_level: number | null;
  estimated_value_cents: number | null;
  notes: string | null;
};

/** The qualifying questions (SALES-REP-MODE §2), used to sort leads. */
export function QualifyForm({ dealId, v }: { dealId: string; v: QualifyValues }) {
  const [state, action] = useActionState(updateQualify, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cabinets only or full kitchen?" htmlFor="q_scope">
          <NativeSelect id="q_scope" name="scope" defaultValue={v.scope ?? ""}>
            <option value="">Not sure yet</option>
            {SCOPES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="When do they want it done?" htmlFor="q_timeline">
          <NativeSelect id="q_timeline" name="timeline" defaultValue={v.timeline ?? ""}>
            <option value="">Didn&apos;t say</option>
            {TIMELINES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Budget from ($)" htmlFor="q_bmin">
          <Input id="q_bmin" name="budget_min" inputMode="decimal" defaultValue={centsToInput(v.budget_min_cents)} />
        </Field>
        <Field label="Budget to ($)" htmlFor="q_bmax">
          <Input id="q_bmax" name="budget_max" inputMode="decimal" defaultValue={centsToInput(v.budget_max_cents)} />
        </Field>
        <Field label="Who decides?" htmlFor="q_dm">
          <Input id="q_dm" name="decision_maker" defaultValue={v.decision_maker ?? ""} placeholder="Her and her husband" />
        </Field>
        <Field label="Own the home?" htmlFor="q_own">
          <NativeSelect
            id="q_own"
            name="owns_home"
            defaultValue={v.owns_home === null ? "" : v.owns_home ? "yes" : "no"}
          >
            <option value="">Didn&apos;t say</option>
            <option value="yes">Owner</option>
            <option value="no">Renter</option>
          </NativeSelect>
        </Field>
        <Field label="Year built" htmlFor="q_year" hint="Before 1978 = lead-safe (RRP) work rules">
          <Input id="q_year" name="year_built" inputMode="numeric" defaultValue={v.year_built ?? ""} placeholder="1994" />
        </Field>
        <Field label="How much do they know?" htmlFor="q_know">
          <NativeSelect id="q_know" name="knowledge_level" defaultValue={v.knowledge_level ?? ""}>
            <option value="">Not sure</option>
            {KNOWLEDGE.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Rough value ($)" htmlFor="q_value" hint="Until there's an estimate">
          <Input id="q_value" name="estimated_value" inputMode="decimal" defaultValue={centsToInput(v.estimated_value_cents)} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="q_notes">
        <Textarea id="q_notes" name="notes" rows={3} defaultValue={v.notes ?? ""} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Save answers</SubmitButton>
    </form>
  );
}

export function ContactForm({
  dealId,
  c,
}: {
  dealId: string;
  c: { name: string | null; phone: string | null; email: string | null; address: string | null; city: string | null; zip: string | null } | null;
}) {
  const [state, action] = useActionState(updateContact, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="c_name">
          <Input id="c_name" name="name" defaultValue={c?.name ?? ""} />
        </Field>
        <Field label="Phone" htmlFor="c_phone">
          <Input id="c_phone" name="phone" type="tel" defaultValue={c?.phone ?? ""} />
        </Field>
        <Field label="Email" htmlFor="c_email">
          <Input id="c_email" name="email" type="email" defaultValue={c?.email ?? ""} />
        </Field>
      </div>
      <Field label="Project address" htmlFor="c_address">
        <AddressInput id="c_address" defaultValue={formatAddressLine(c?.address, c?.city, c?.zip)} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full sm:w-auto">
        Save contact
      </SubmitButton>
    </form>
  );
}

export function LogForm({ dealId }: { dealId: string }) {
  const [state, action] = useActionState(logActivity, null);
  const [type, setType] = useState("call");
  return (
    <form action={action} className="flex flex-col gap-3" id="log">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What happened">
        {ACTIVITY_TYPES.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={type === a.key}
            onClick={() => setType(a.key)}
            className={
              type === a.key
                ? "h-10 rounded-full bg-foreground px-4 text-sm font-semibold text-background"
                : "h-10 rounded-full bg-card px-4 text-sm font-semibold ring-1 ring-border"
            }
          >
            {a.label}
          </button>
        ))}
      </div>
      {type !== "note" ? (
        <NativeSelect name="direction" defaultValue="out" aria-label="Direction">
          <option value="out">I reached out</option>
          <option value="in">They reached me</option>
        </NativeSelect>
      ) : (
        <input type="hidden" name="direction" value="" />
      )}
      <Textarea name="summary" rows={2} placeholder="What was said / next step" aria-label="Summary" />
      <FormMessage state={state} />
      <SubmitButton className="w-full sm:w-auto">Log it</SubmitButton>
    </form>
  );
}

export function BookVisitForm({
  dealId,
  minutes,
  meetingId,
  defaultValue,
  onDone,
}: {
  dealId: string;
  minutes: number;
  /** Editing a booked visit: move it instead of booking another one. */
  meetingId?: string;
  defaultValue?: string;
  onDone?: () => void;
}) {
  const [state, action] = useActionState(async (prev: ActionState | null, fd: FormData) => {
    const res = await bookVisit(prev, fd);
    if (res?.ok) onDone?.();
    return res;
  }, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="minutes" value={minutes} />
      {meetingId ? <input type="hidden" name="meeting_id" value={meetingId} /> : null}
      <div className="flex gap-2">
        <Input
          type="datetime-local"
          name="starts_at"
          required
          defaultValue={defaultValue}
          aria-label="Visit date and time"
        />
        <SubmitButton variant="secondary">{meetingId ? "Save" : "Book"}</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * The site visit's two buttons (change request v3 item 5): Book / Edit visit, and Mark as visited.
 * Mark as visited closes the booked visit (or records one now), moves the deal to "Visit done" when
 * it's earlier in the pipeline, and resets the follow-up from the stage's rules (database).
 */
export function VisitActions({
  dealId,
  minutes,
  booked,
}: {
  dealId: string;
  minutes: number;
  /** The booked (scheduled) visit, as a datetime-local value in the company time zone. */
  booked: { id: string; local: string } | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="lg" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {booked ? "Edit visit" : "Book visit"}
        </Button>
        <Button
          size="lg"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await markVisited({ deal_id: dealId });
              setMsg(res?.ok ? { ok: true, text: "Marked as visited" } : { ok: false, text: res?.error ?? "Couldn't save" });
              router.refresh();
            })
          }
        >
          <Check /> Mark as visited
        </Button>
      </div>
      {open ? (
        <BookVisitForm
          dealId={dealId}
          minutes={minutes}
          meetingId={booked?.id}
          defaultValue={booked?.local}
          onDone={() => setOpen(false)}
        />
      ) : null}
      {msg ? <p className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{msg.text}</p> : null}
    </div>
  );
}

export function MeetingButtons({ meetingId, cancelOnly = false }: { meetingId: string; cancelOnly?: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (status: "done" | "canceled") =>
    start(async () => {
      await setMeetingStatus({ meeting_id: meetingId, status });
      router.refresh();
    });
  return (
    <div className="flex gap-1.5">
      {cancelOnly ? null : (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("done")}>
          <Check /> Done
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Cancel this visit?")) go("canceled");
        }}
        aria-label="Cancel visit"
        className="size-11"
      >
        <X />
      </Button>
    </div>
  );
}

export function ArchiveButton({ dealId }: { dealId: string }) {
  const [pending, start] = useTransition();
  const [sure, setSure] = useState(false);
  return sure ? (
    <div className="flex items-center gap-2 text-sm">
      Hide this deal from every list? Its number stays used.
      <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(() => archiveDeal({ deal_id: dealId }).then(() => undefined))}>
        Archive
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setSure(false)}>
        Keep
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setSure(true)} className="text-muted-foreground">
      <Archive /> Archive deal
    </Button>
  );
}
