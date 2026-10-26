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
  moveStage,
  setFollowUp,
  setMeetingStatus,
  updateContact,
  updateQualify,
} from "@/server/actions/deals";
import type { Stage } from "@/server/queries/deals";

export function StageForm({
  dealId,
  stage,
  stages,
  reasons,
}: {
  dealId: string;
  stage: string;
  stages: Stage[];
  reasons: { key: string; label: string; active: boolean }[];
}) {
  const [state, action] = useActionState(moveStage, null);
  const [picked, setPicked] = useState(stage);
  const kind = stages.find((s) => s.key === picked)?.kind;
  const choices = stages.filter((s) => (s.active && s.kind !== "handed_off") || s.key === stage);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="flex gap-2">
        <NativeSelect
          name="stage"
          aria-label="Stage"
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          disabled={stages.find((s) => s.key === stage)?.kind === "handed_off"}
        >
          {choices.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
        <SubmitButton variant="secondary">Move</SubmitButton>
      </div>
      {kind === "lost" ? (
        <Field label="Why was it lost?" htmlFor="lost_reason">
          <NativeSelect id="lost_reason" name="lost_reason" required defaultValue="">
            <option value="" disabled>
              Pick a reason
            </option>
            {reasons
              .filter((r) => r.active)
              .map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
          </NativeSelect>
        </Field>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}

export function FollowUpForm({ dealId, value }: { dealId: string; value: string }) {
  const [state, action] = useActionState(setFollowUp, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <div className="flex gap-2">
        <Input type="datetime-local" name="at" defaultValue={value} aria-label="Next follow-up" required />
        <SubmitButton variant="secondary">Set</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

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
        <Field label="Year built" htmlFor="q_year" hint="Before 1978 = lead-safe rules for the partner">
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

export function BookVisitForm({ dealId, minutes }: { dealId: string; minutes: number }) {
  const [state, action] = useActionState(bookVisit, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="deal_id" value={dealId} />
      <input type="hidden" name="minutes" value={minutes} />
      <div className="flex gap-2">
        <Input type="datetime-local" name="starts_at" required aria-label="Visit date and time" />
        <SubmitButton variant="secondary">Book</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function MeetingButtons({ meetingId }: { meetingId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = (status: "done" | "canceled") =>
    start(async () => {
      await setMeetingStatus({ meeting_id: meetingId, status });
      router.refresh();
    });
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => go("done")}>
        <Check /> Done
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => go("canceled")} aria-label="Cancel visit">
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
