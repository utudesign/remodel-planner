"use client";

import { useActionState, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronLeft, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormMessage, SubmitButton } from "@/components/shared/form";
import {
  ALSO,
  APPLIANCES,
  APPLIANCES_PLAN,
  BATH_NOW,
  BATH_ROOMS,
  BATH_SCOPE,
  BATH_SIZES,
  BATH_WANT,
  BUDGETS,
  CEILINGS,
  COLORS,
  DOOR_STYLES,
  ISLAND,
  LAYOUT_CHANGE,
  LAYOUTS,
  PROJECTS,
  STANDARD_APPLIANCES,
  TOP_NOW,
  TOP_SIZES,
  TOP_WANT,
  VANITIES,
  WHEN,
  showsBath,
  showsKitchen,
  showsTops,
  type Project,
} from "@/lib/intake";
import { cn } from "@/lib/utils";
import { submitLeadForm } from "@/server/actions/public";

type Opt = { key: string; label: string; hint?: string };

type Kitchen = {
  layout: string | null;
  island: string | null;
  base: number | null;
  wall: number | null;
  tall: number | null;
  ceiling: string | null;
  layout_change: string | null;
  appliances_plan: string | null;
  appliances: string[];
  appliances_other: string;
  also: string[];
  door: string | null;
  color: string | null;
};
type Tops = { size: string | null; sqft: number | null; now: string | null; want: string | null };
type Bath = { room: string | null; now: string | null; want: string | null; scope: string | null; vanity: string | null; size: string | null };

const EMPTY_KITCHEN: Kitchen = {
  layout: null,
  island: null,
  base: null,
  wall: null,
  tall: null,
  ceiling: null,
  layout_change: null,
  appliances_plan: null,
  appliances: [...STANDARD_APPLIANCES],
  appliances_other: "",
  also: [],
  door: null,
  color: null,
};

type Step = "what" | "kitchen_now" | "kitchen_plan" | "tops" | "bath" | "when" | "contact";
const TITLES: Record<Step, string> = {
  what: "What are you thinking about?",
  kitchen_now: "Your kitchen now",
  kitchen_plan: "What you'd like",
  tops: "Countertops",
  bath: "Your bathroom",
  when: "Timing + budget",
  contact: "Where should I text you?",
};

function stepsFor(p: Project[]): Step[] {
  const s: Step[] = ["what"];
  if (showsKitchen(p)) s.push("kitchen_now", "kitchen_plan");
  else if (showsTops(p)) s.push("tops");
  if (showsBath(p)) s.push("bath");
  s.push("when", "contact");
  return s;
}

/* ------------------------------------------------------------------ inputs */

function Q({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[15px] font-semibold">{label}</legend>
      {hint ? <p className="-mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

const chip = (on: boolean) =>
  cn(
    "flex min-h-11 items-center rounded-xl px-3 py-2 text-left text-[15px] font-medium ring-1 transition-colors",
    on ? "bg-accent ring-2 ring-primary" : "bg-card ring-border",
  );

function One({ opts, value, onChange, cols = 2 }: { opts: readonly Opt[]; value: string | null; onChange: (v: string | null) => void; cols?: 2 | 3 }) {
  return (
    <div className={cn("grid gap-2", cols === 3 ? "grid-cols-3" : "grid-cols-2")} role="radiogroup">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(value === o.key ? null : o.key)}
          className={chip(value === o.key)}
        >
          <span>
            {o.label}
            {o.hint ? <span className="block text-xs font-normal text-muted-foreground">{o.hint}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function Many({ opts, value, onChange }: { opts: readonly Opt[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opts.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.key) : [...value, o.key])}
            className={chip(on)}
          >
            <span className={cn("mr-2 flex size-5 shrink-0 items-center justify-center rounded border", on && "border-primary bg-primary text-primary-foreground")}>
              {on ? "✓" : ""}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Counter({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 ring-1 ring-border">
      <div>
        <p className="text-[15px] font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label}`}
          onClick={() => onChange(value === null || value <= 0 ? null : value - 1)}
          className="flex size-11 items-center justify-center rounded-lg bg-secondary"
        >
          <Minus className="size-4" />
        </button>
        <span className="w-9 text-center text-lg font-semibold tabular-nums" aria-live="polite">
          {value ?? "–"}
        </span>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => onChange(Math.min(80, (value ?? 0) + 1))}
          className="flex size-11 items-center justify-center rounded-lg bg-secondary"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ form */

export function LeadForm({ slug }: { slug: string }) {
  const [state, action] = useActionState(submitLeadForm, null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [other, setOther] = useState(false);
  const [k, setK] = useState<Kitchen>(EMPTY_KITCHEN);
  const [t, setT] = useState<Tops>({ size: null, sqft: null, now: null, want: null });
  const [b, setB] = useState<Bath>({ room: null, now: null, want: null, scope: null, vanity: null, size: null });
  const [when, setWhen] = useState<string | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [owns, setOwns] = useState<boolean | null>(null);
  const [i, setI] = useState(0);

  const steps = stepsFor(projects);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = step === "contact";
  const go = (n: number) => {
    setI(Math.max(0, Math.min(steps.length - 1, n)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const kk = <F extends keyof Kitchen>(f: F) => (v: Kitchen[F]) => setK((x) => ({ ...x, [f]: v }));
  const tt = <F extends keyof Tops>(f: F) => (v: Tops[F]) => setT((x) => ({ ...x, [f]: v }));
  const bb = <F extends keyof Bath>(f: F) => (v: Bath[F]) => setB((x) => ({ ...x, [f]: v }));

  const toggleProject = (p: Project) => {
    setOther(false);
    setProjects((cur) => {
      if (cur.includes(p)) return cur.filter((x) => x !== p);
      // A full kitchen already includes cabinets (and countertops).
      const next = p === "kitchen" ? cur.filter((x) => x !== "cabinets_only") : p === "cabinets_only" ? cur.filter((x) => x !== "kitchen") : cur;
      return [...next, p];
    });
  };

  const answers = JSON.stringify({
    projects,
    kitchen: showsKitchen(projects) ? k : undefined,
    tops: showsTops(projects) ? t : undefined,
    bath: showsBath(projects) ? b : undefined,
    when,
    budget,
    owns_home: owns,
  });

  if (state?.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center ring-1 ring-border">
        <CheckCircle2 className="size-10 text-primary" />
        <p className="text-lg font-semibold">{state.message}</p>
        <p className="text-sm text-muted-foreground">Have photos of the space? Text them to me when I reach out.</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-border">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="answers" value={answers} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>
            Step {i + 1} of {steps.length}
          </span>
          <span>About 1 minute</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight">{TITLES[step]}</h2>
      </div>

      {step === "what" ? (
        <div className="flex flex-col gap-2">
          <p className="-mt-2 text-sm text-muted-foreground">Pick one or more.</p>
          <div className="grid grid-cols-2 gap-2">
            {PROJECTS.map((p) => {
              const on = projects.includes(p.key);
              return (
                <button key={p.key} type="button" role="checkbox" aria-checked={on} onClick={() => toggleProject(p.key)} className={cn(chip(on), "min-h-16")}>
                  <span>
                    {p.label}
                    <span className="block text-xs font-normal text-muted-foreground">{p.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={other}
            onClick={() => {
              setProjects([]);
              setOther((x) => !x);
            }}
            className={chip(other)}
          >
            Something else
          </button>
        </div>
      ) : null}

      {step === "kitchen_now" ? (
        <>
          <Q label="Layout">
            <One opts={LAYOUTS} value={k.layout} onChange={kk("layout")} />
          </Q>
          <Q label="Island">
            <One opts={ISLAND} value={k.island} onChange={kk("island")} cols={3} />
          </Q>
          <Q label="How many cabinets do you have now?" hint="Count each cabinet box. A 2-door cabinet is 1. Leave “–” if you're not sure.">
            <Counter label="Bottom cabinets" hint="under the counter, incl. sink" value={k.base} onChange={kk("base")} />
            <Counter label="Wall cabinets" hint="upper cabinets" value={k.wall} onChange={kk("wall")} />
            <Counter label="Tall cabinets" hint="pantry / oven tower" value={k.tall} onChange={kk("tall")} />
          </Q>
          <Q label="Ceiling height">
            <One opts={CEILINGS} value={k.ceiling} onChange={kk("ceiling")} />
          </Q>
        </>
      ) : null}

      {step === "kitchen_plan" ? (
        <>
          <Q label="Layout">
            <One opts={LAYOUT_CHANGE} value={k.layout_change} onChange={kk("layout_change")} cols={3} />
          </Q>
          <Q label="Appliances">
            <One opts={APPLIANCES_PLAN} value={k.appliances_plan} onChange={kk("appliances_plan")} cols={3} />
          </Q>
          <Q label="Which appliances will the new kitchen have?" hint="The usual four are checked. Add any extras.">
            <Many opts={APPLIANCES} value={k.appliances} onChange={kk("appliances")} />
            <Input
              value={k.appliances_other}
              onChange={(e) => kk("appliances_other")(e.target.value)}
              placeholder={'Anything else? (e.g. 48" range, panel-ready fridge)'}
              maxLength={120}
              aria-label="Other appliances"
            />
          </Q>
          <Q label="Cabinet style">
            <One opts={DOOR_STYLES} value={k.door} onChange={kk("door")} />
          </Q>
          <Q label="Color">
            <One opts={COLORS} value={k.color} onChange={kk("color")} />
          </Q>
          {projects.includes("kitchen") ? (
            <>
              <Q label="Countertops" hint="Rough size of all counters together (each run: length × 2 ft, plus the island).">
                <One opts={TOP_SIZES} value={t.size} onChange={tt("size")} />
              </Q>
              <Q label="Countertop you'd like">
                <One opts={TOP_WANT} value={t.want} onChange={tt("want")} />
              </Q>
              <Q label="Also include">
                <Many opts={ALSO} value={k.also} onChange={kk("also")} />
              </Q>
            </>
          ) : null}
        </>
      ) : null}

      {step === "tops" ? (
        <>
          <Q label="Rough size" hint="All counters together. Each run: length × 2 ft, plus the island.">
            <One opts={TOP_SIZES} value={t.size} onChange={tt("size")} />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={400}
                value={t.sqft ?? ""}
                onChange={(e) => tt("sqft")(e.target.value ? Math.min(400, Math.max(0, Math.round(Number(e.target.value)))) : null)}
                placeholder="or type it"
                aria-label="Countertop square feet"
                className="w-32"
              />
              <span className="text-sm text-muted-foreground">sq ft (if you know)</span>
            </div>
          </Q>
          <Q label="What you have now">
            <One opts={TOP_NOW} value={t.now} onChange={tt("now")} />
          </Q>
          <Q label="What you'd like">
            <One opts={TOP_WANT} value={t.want} onChange={tt("want")} />
          </Q>
        </>
      ) : null}

      {step === "bath" ? (
        <>
          <Q label="Which bathroom?">
            <One opts={BATH_ROOMS} value={b.room} onChange={bb("room")} />
          </Q>
          {b.room !== "half" ? (
            <>
              <Q label="What's there now?">
                <One opts={BATH_NOW} value={b.now} onChange={bb("now")} />
              </Q>
              <Q label="What would you like?">
                <One opts={BATH_WANT} value={b.want} onChange={bb("want")} />
              </Q>
            </>
          ) : null}
          <Q label="How big a job?">
            <One opts={BATH_SCOPE} value={b.scope} onChange={bb("scope")} />
          </Q>
          <Q label="Vanity size">
            <One opts={VANITIES} value={b.vanity} onChange={bb("vanity")} cols={3} />
          </Q>
          <Q label="Room size">
            <One opts={BATH_SIZES} value={b.size} onChange={bb("size")} />
          </Q>
        </>
      ) : null}

      {step === "when" ? (
        <>
          <Q label="When would you like it done?">
            <One opts={WHEN} value={when} onChange={setWhen} />
          </Q>
          <Q label="Rough budget" hint="Helps me show you the right options. Not a commitment.">
            <One opts={BUDGETS} value={budget} onChange={setBudget} />
          </Q>
          <Q label="Do you own the home?">
            <One
              opts={[
                { key: "yes", label: "Yes" },
                { key: "no", label: "No (renting)" },
              ]}
              value={owns === null ? null : owns ? "yes" : "no"}
              onChange={(v) => setOwns(v === null ? null : v === "yes")}
            />
          </Q>
        </>
      ) : null}

      {/* Contact fields stay mounted so the form always sends them. */}
      <div className={cn("flex flex-col gap-4", !last && "hidden")}>
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required={last} />
        </Field>
        <Field label="Phone (I'll text you)" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required={last} />
        </Field>
        <Field label="ZIP code" htmlFor="zip">
          <Input id="zip" name="zip" inputMode="numeric" autoComplete="postal-code" pattern="\d{5}" maxLength={5} placeholder="22030" />
        </Field>
        <Field label="Anything else? (optional)" htmlFor="message">
          <Textarea id="message" name="message" rows={3} placeholder="Ideas, photos you can send, best time to reach you…" />
        </Field>
        <FormMessage state={state} />
      </div>

      <div className="flex gap-2">
        {i > 0 ? (
          <button type="button" onClick={() => go(i - 1)} className="flex h-12 items-center gap-1 rounded-xl bg-secondary px-4 font-semibold" aria-label="Back">
            <ChevronLeft className="size-5" /> Back
          </button>
        ) : null}
        {last ? (
          <SubmitButton size="lg" className="h-12 flex-1">
            Get my free estimate
          </SubmitButton>
        ) : (
          <button
            type="button"
            disabled={step === "what" && !projects.length && !other}
            onClick={() => go(i + 1)}
            className="h-12 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-40"
          >
            {step === "what" && !projects.length && !other ? "Pick one to continue" : "Next"}
          </button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">Free, no obligation. Your number is only used to set up the visit.</p>
    </form>
  );
}
