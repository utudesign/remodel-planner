"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { rulesSummary, WEEKDAYS, type DayHours, type Weekday } from "@/lib/jobs/pm";
import { cn } from "@/lib/utils";
import { saveSiteRules } from "@/server/actions/jobs-pm";

/**
 * On-site work rules (change request v3 item 15): allowed hours per weekday, no loud work after, building type,
 * HOA / elevator / parking / debris / gate / pets. One row per deal; the job and the workers read the same rules.
 * This is the job site, not the client's availability for the sales visit.
 */

export type SiteRulesRow = {
  building_type: string | null;
  hours: unknown;
  loud_until: string | null;
  hoa_contact: string | null;
  elevator: string | null;
  parking: string | null;
  debris: string | null;
  gate_code: string | null;
  pets: string | null;
  notes: string | null;
};

const DEFAULT_HOURS: Partial<Record<Weekday, DayHours>> = {
  mon: { start: "08:00", end: "18:00" },
  tue: { start: "08:00", end: "18:00" },
  wed: { start: "08:00", end: "18:00" },
  thu: { start: "08:00", end: "18:00" },
  fri: { start: "08:00", end: "18:00" },
  sat: { start: "09:00", end: "16:00" },
};

const TEXT_FIELDS = [
  { key: "hoa_contact", label: "HOA / condo management contact", placeholder: "Jane, 703-555-0101, mgmt office B1" },
  { key: "elevator", label: "Elevator booking", placeholder: "Book service elevator 48 h ahead" },
  { key: "parking", label: "Parking", placeholder: "Visitor spots only, permit in lobby" },
  { key: "debris", label: "Where to dump debris", placeholder: "No building dumpster — haul away daily" },
  { key: "gate_code", label: "Gate / door code", placeholder: "#1234" },
  { key: "pets", label: "Pets", placeholder: "Dog in back room, keep door closed" },
] as const;

/** Read-only block: the one-line summary + the notes workers need. */
export function SiteRulesSummary({ rules, compact }: { rules: SiteRulesRow | null; compact?: boolean }) {
  if (!rules) return <p className="text-sm text-muted-foreground">No site rules yet.</p>;
  const line = rulesSummary({
    building_type: rules.building_type,
    hours: (rules.hours ?? {}) as Partial<Record<Weekday, DayHours>>,
    loud_until: rules.loud_until,
  });
  const extras = TEXT_FIELDS.filter((f) => rules[f.key]).map((f) => `${f.label.split(" ")[0]}: ${rules[f.key]}`);
  return (
    <div className={cn("flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-950 dark:bg-amber-950 dark:text-amber-50", compact && "p-2")}>
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{line}</p>
        {!compact
          ? [...extras, rules.notes].filter(Boolean).map((x) => (
              <p key={x} className="break-words">
                {x}
              </p>
            ))
          : extras.length || rules.notes
            ? <p className="truncate">{[...extras, rules.notes].filter(Boolean).join(" · ")}</p>
            : null}
      </div>
    </div>
  );
}

export function SiteRulesForm({ dealId, rules }: { dealId: string; rules: SiteRulesRow | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hours, setHours] = useState<Partial<Record<Weekday, DayHours>>>(
    (rules?.hours as Partial<Record<Weekday, DayHours>>) ?? DEFAULT_HOURS,
  );
  const [building, setBuilding] = useState(rules?.building_type ?? "");
  const [loud, setLoud] = useState(rules?.loud_until?.slice(0, 5) ?? "");
  const [text, setText] = useState<Record<string, string>>(
    Object.fromEntries([...TEXT_FIELDS.map((f) => f.key), "notes"].map((k) => [k, (rules?.[k as keyof SiteRulesRow] as string) ?? ""])),
  );
  const setDay = (d: Weekday, h: DayHours | null) =>
    setHours((cur) => {
      const next = { ...cur };
      if (h) next[d] = h;
      else delete next[d];
      return next;
    });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSiteRules({
            deal_id: dealId,
            building_type: (building || null) as "house" | "condo" | "townhouse" | "apartment" | "other" | null,
            hours: hours as Record<Weekday, DayHours>,
            loud_until: loud || null,
            hoa_contact: text.hoa_contact,
            elevator: text.elevator,
            parking: text.parking,
            debris: text.debris,
            gate_code: text.gate_code,
            pets: text.pets,
            notes: text.notes,
          });
          setMsg(r?.ok ? { ok: true, text: "Saved" } : { ok: false, text: r?.error ?? "Couldn't save" });
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Building
          <NativeSelect value={building} onChange={(e) => setBuilding(e.target.value)}>
            <option value="">—</option>
            <option value="house">House</option>
            <option value="condo">Condo</option>
            <option value="townhouse">Townhouse</option>
            <option value="apartment">Apartment</option>
            <option value="other">Other</option>
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          No loud work after
          <Input type="time" value={loud} onChange={(e) => setLoud(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Work hours (start no earlier than / everyone off site by)</span>
        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-border">
          {WEEKDAYS.map(({ key, label }) => {
            const h = hours[key];
            return (
              <li key={key} className="flex min-h-12 items-center gap-2 px-2">
                <label className="flex w-16 shrink-0 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={!!h}
                    onChange={(e) => setDay(key, e.target.checked ? { start: "08:00", end: "18:00" } : null)}
                  />
                  {label}
                </label>
                {h ? (
                  <>
                    <Input
                      type="time"
                      aria-label={`${label} start`}
                      value={h.start}
                      onChange={(e) => setDay(key, { ...h, start: e.target.value })}
                      className="h-10"
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      aria-label={`${label} end`}
                      value={h.end}
                      onChange={(e) => setDay(key, { ...h, end: e.target.value })}
                      className="h-10"
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No work</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {TEXT_FIELDS.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {f.label}
          <Input value={text[f.key]} placeholder={f.placeholder} onChange={(e) => setText((t) => ({ ...t, [f.key]: e.target.value }))} />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Other rules
        <Textarea rows={2} value={text.notes} onChange={(e) => setText((t) => ({ ...t, notes: e.target.value }))} />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null} Save site rules
      </Button>
      {msg ? <p className={msg.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{msg.text}</p> : null}
    </form>
  );
}
