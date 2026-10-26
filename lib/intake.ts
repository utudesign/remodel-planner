import { z } from "zod";

/**
 * The client's free-estimate questionnaire (share link /l/<slug>): 4 short steps, tap-first,
 * contact last. Questions change with the project. Every answer is optional except name + phone.
 * Options live here (one place for the form, validation and the summary I read).
 */
export const PROJECTS = [
  { key: "kitchen", label: "Full kitchen", hint: "Cabinets, counters, install" },
  { key: "cabinets_only", label: "Cabinets only", hint: "New cabinets" },
  { key: "countertops", label: "Countertops", hint: "Quartz, granite…" },
  { key: "bath", label: "Bathroom", hint: "Vanity, shower, tub" },
] as const;
export type Project = (typeof PROJECTS)[number]["key"];

type Opt = { key: string; label: string };
const o = <const T extends readonly Opt[]>(x: T) => x;
const keys = <T extends readonly Opt[]>(x: T) => x.map((i) => i.key) as unknown as [T[number]["key"], ...T[number]["key"][]];

// --- Kitchen / cabinets
export const LAYOUTS = o([
  { key: "l_shape", label: "L-shape" },
  { key: "u_shape", label: "U-shape" },
  { key: "galley", label: "Galley (2 walls)" },
  { key: "one_wall", label: "One wall" },
  { key: "not_sure", label: "Not sure" },
]);
export const ISLAND = o([
  { key: "has", label: "Has an island" },
  { key: "wants", label: "Want one" },
  { key: "no", label: "No island" },
]);
export const CEILINGS = o([
  { key: "8", label: "8 ft" },
  { key: "9", label: "9 ft" },
  { key: "10", label: "10 ft +" },
  { key: "not_sure", label: "Not sure" },
]);
export const LAYOUT_CHANGE = o([
  { key: "same", label: "Keep the same layout" },
  { key: "small", label: "Small changes" },
  { key: "new", label: "New layout" },
]);
export const APPLIANCES_PLAN = o([
  { key: "keep", label: "Keeping my appliances" },
  { key: "some", label: "Replacing some" },
  { key: "all_new", label: "All new" },
]);
/** The cabinets have to fit these. The standard four are pre-checked. */
export const APPLIANCES = o([
  { key: "fridge", label: "Fridge" },
  { key: "range", label: "Range / stove" },
  { key: "dishwasher", label: "Dishwasher" },
  { key: "microwave_otr", label: "Microwave over range" },
  { key: "hood", label: "Range hood" },
  { key: "wall_oven", label: "Wall oven" },
  { key: "cooktop", label: "Separate cooktop" },
  { key: "microwave_builtin", label: "Built-in microwave / drawer" },
  { key: "wine_fridge", label: "Wine / beverage fridge" },
  { key: "second_sink", label: "Second sink / bar" },
]);
export const STANDARD_APPLIANCES = ["fridge", "range", "dishwasher", "microwave_otr"] as const;
export const ALSO = o([
  { key: "backsplash", label: "Backsplash" },
  { key: "sink_faucet", label: "Sink + faucet" },
  { key: "flooring", label: "Flooring" },
  { key: "lighting", label: "Lighting" },
  { key: "move_plumbing", label: "Moving sink / gas / walls" },
]);
export const DOOR_STYLES = o([
  { key: "shaker", label: "Shaker" },
  { key: "flat", label: "Flat / modern" },
  { key: "raised", label: "Raised panel" },
  { key: "not_sure", label: "Not sure" },
]);
export const COLORS = o([
  { key: "white", label: "White" },
  { key: "gray", label: "Gray" },
  { key: "wood", label: "Wood tone" },
  { key: "dark", label: "Navy / green / dark" },
  { key: "not_sure", label: "Not sure" },
]);

// --- Countertops
export const TOP_SIZES = o([
  { key: "s", label: "Small · under 30 sq ft", hint: "one wall" },
  { key: "m", label: "Medium · 30–50 sq ft", hint: "L-shape" },
  { key: "l", label: "Large · 50–80 sq ft", hint: "U-shape or L + island" },
  { key: "xl", label: "Extra large · 80+ sq ft", hint: "big island" },
  { key: "not_sure", label: "Not sure", hint: "" },
]);
export const TOP_NOW = o([
  { key: "laminate", label: "Laminate" },
  { key: "granite", label: "Granite" },
  { key: "quartz", label: "Quartz" },
  { key: "tile", label: "Tile" },
  { key: "other", label: "Other / not sure" },
]);
export const TOP_WANT = o([
  { key: "quartz", label: "Quartz" },
  { key: "granite", label: "Granite" },
  { key: "quartzite", label: "Quartzite / marble" },
  { key: "butcher_block", label: "Butcher block" },
  { key: "not_sure", label: "Not sure" },
]);

// --- Bathroom
export const BATH_ROOMS = o([
  { key: "main", label: "Main bath" },
  { key: "hall", label: "Hall / kids bath" },
  { key: "half", label: "Half bath (powder)" },
  { key: "basement", label: "Basement bath" },
]);
export const BATH_NOW = o([
  { key: "tub_shower", label: "Tub with shower" },
  { key: "tub", label: "Tub only" },
  { key: "shower", label: "Walk-in shower" },
  { key: "tub_and_shower", label: "Separate tub + shower" },
  { key: "none", label: "No tub or shower" },
]);
export const BATH_WANT = o([
  { key: "keep_tub", label: "Keep a tub (new one)" },
  { key: "tub_to_shower", label: "Tub → walk-in shower" },
  { key: "new_shower", label: "New walk-in shower" },
  { key: "freestanding", label: "Freestanding tub" },
  { key: "not_sure", label: "Not sure" },
]);
export const BATH_SCOPE = o([
  { key: "full", label: "Full remodel (to the studs)" },
  { key: "update", label: "Update: vanity, toilet, fixtures" },
  { key: "shower_only", label: "Shower / tub only" },
  { key: "not_sure", label: "Not sure" },
]);
export const VANITIES = o([
  { key: "24", label: '24"' },
  { key: "30", label: '30"' },
  { key: "36", label: '36"' },
  { key: "48", label: '48"' },
  { key: "60_double", label: '60" double' },
  { key: "72_double", label: '72" double' },
  { key: "not_sure", label: "Not sure" },
]);
export const BATH_SIZES = o([
  { key: "small", label: "Small (about 5×8 ft)" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "not_sure", label: "Not sure" },
]);

// --- Timing + budget (timeline keys match deals.timeline)
export const WHEN = o([
  { key: "asap", label: "As soon as possible" },
  { key: "1_3_months", label: "1–3 months" },
  { key: "3_6_months", label: "3–6 months" },
  { key: "later", label: "Just planning" },
]);
export const BUDGETS = [
  { key: "u10", label: "Under $10k", min: 0, max: 1_000_000 },
  { key: "10_20", label: "$10k–$20k", min: 1_000_000, max: 2_000_000 },
  { key: "20_35", label: "$20k–$35k", min: 2_000_000, max: 3_500_000 },
  { key: "35_50", label: "$35k–$50k", min: 3_500_000, max: 5_000_000 },
  { key: "50p", label: "$50k +", min: 5_000_000, max: null },
  { key: "not_sure", label: "Not sure yet", min: null, max: null },
] as const;

const count = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().min(0).max(80).nullable(),
);
const opt = <T extends [string, ...string[]]>(values: T) => z.enum(values).nullable().optional().default(null);
const many = <T extends [string, ...string[]]>(values: T) => z.array(z.enum(values)).max(20).optional().default([]);

export const intakeSchema = z.object({
  projects: z.array(z.enum(PROJECTS.map((p) => p.key) as [Project, ...Project[]])).max(4).default([]),
  kitchen: z
    .object({
      layout: opt(keys(LAYOUTS)),
      island: opt(keys(ISLAND)),
      base: count.default(null),
      wall: count.default(null),
      tall: count.default(null),
      ceiling: opt(keys(CEILINGS)),
      layout_change: opt(keys(LAYOUT_CHANGE)),
      appliances_plan: opt(keys(APPLIANCES_PLAN)),
      appliances: many(keys(APPLIANCES)),
      appliances_other: z.string().trim().max(120).optional().default(""),
      also: many(keys(ALSO)),
      door: opt(keys(DOOR_STYLES)),
      color: opt(keys(COLORS)),
    })
    .optional(),
  tops: z
    .object({
      size: opt(keys(TOP_SIZES)),
      sqft: count.default(null).pipe(z.number().max(400).nullable()),
      now: opt(keys(TOP_NOW)),
      want: opt(keys(TOP_WANT)),
    })
    .optional(),
  bath: z
    .object({
      room: opt(keys(BATH_ROOMS)),
      now: opt(keys(BATH_NOW)),
      want: opt(keys(BATH_WANT)),
      scope: opt(keys(BATH_SCOPE)),
      vanity: opt(keys(VANITIES)),
      size: opt(keys(BATH_SIZES)),
    })
    .optional(),
  when: opt(keys(WHEN)),
  budget: opt(BUDGETS.map((b) => b.key) as unknown as [string, ...string[]]),
  owns_home: z.boolean().nullable().optional().default(null),
});
export type Intake = z.infer<typeof intakeSchema>;
export type IntakeInput = z.input<typeof intakeSchema>;

const label = (list: readonly Opt[], key: string | null | undefined) => list.find((i) => i.key === key)?.label ?? null;
const labels = (list: readonly Opt[], ks: readonly string[] | undefined) =>
  (ks ?? []).map((k) => label(list, k)).filter(Boolean) as string[];

/** Which project the deal is filed under (deals.scope). */
export function primaryScope(projects: readonly Project[]): Project | null {
  for (const k of ["kitchen", "cabinets_only", "countertops", "bath"] as const) if (projects.includes(k)) return k;
  return null;
}

/** Kitchen questions show for a full kitchen or cabinets; countertop ones for countertops or a full kitchen. */
export const showsKitchen = (p: readonly Project[]) => p.includes("kitchen") || p.includes("cabinets_only");
export const showsTops = (p: readonly Project[]) => p.includes("countertops") || p.includes("kitchen");
export const showsBath = (p: readonly Project[]) => p.includes("bath");

/**
 * Rough cabinet run along the walls, in feet, from the cabinet count (for my ballpark only).
 * Base boxes average ~2 ft (12"–36"); add ~5 ft for the range + dishwasher openings.
 * Island boxes are in the count but not on the walls: take ~4 boxes off when there is one.
 */
export function roughRunFt(k: Intake["kitchen"]): number | null {
  if (!k?.base || k.base < 3) return null;
  const onWalls = Math.max(3, k.base - (k.island === "has" ? 4 : 0));
  return Math.round((onWalls * 2 + 5) * 2) / 2;
}

/** Split the run into walls by layout, the way the site-visit form measures them. */
export function wallsFromRun(runFt: number, layout: string | null | undefined): { ft: number }[] {
  const n = layout === "u_shape" ? 3 : layout === "l_shape" || layout === "galley" ? 2 : 1;
  const each = Math.round((runFt / n) * 2) / 2;
  return Array.from({ length: n }, () => ({ ft: each }));
}

/** Short lines I read on the deal (and Crystal sees in the hand-off packet). */
export function summarizeIntake(a: Intake): string[] {
  const out: string[] = [];
  const p = a.projects;
  const k = a.kitchen;
  if (showsKitchen(p) && k) {
    const head = p.includes("kitchen") ? "Kitchen" : "Cabinets";
    const shape = [label(LAYOUTS, k.layout), label(ISLAND, k.island)?.toLowerCase()].filter(Boolean).join(", ");
    const boxes = [
      k.base !== null ? `${k.base} bottom` : null,
      k.wall !== null ? `${k.wall} wall` : null,
      k.tall ? `${k.tall} tall` : null,
    ].filter(Boolean);
    out.push(
      [
        `${head}: ${shape || "layout not given"}`,
        boxes.length ? `cabinets now ${boxes.join(" + ")}` : null,
        k.ceiling && k.ceiling !== "not_sure" ? `${label(CEILINGS, k.ceiling)} ceiling` : null,
        label(LAYOUT_CHANGE, k.layout_change)?.toLowerCase(),
      ]
        .filter(Boolean)
        .join(" · "),
    );
    const appl = [
      label(APPLIANCES_PLAN, k.appliances_plan),
      k.appliances.length ? labels(APPLIANCES, k.appliances).join(", ") : null,
      k.appliances_other ? `other: ${k.appliances_other}` : null,
    ].filter(Boolean);
    if (appl.length) out.push(`Appliances: ${appl.join(" · ")}`);
    const style = [label(DOOR_STYLES, k.door), label(COLORS, k.color)].filter((x) => x && x !== "Not sure");
    const also = labels(ALSO, k.also);
    if (style.length || also.length)
      out.push([style.length ? `Style: ${style.join(", ")}` : null, also.length ? `Also: ${also.join(", ")}` : null].filter(Boolean).join(" · "));
  }
  const t = a.tops;
  if (showsTops(p) && t && (t.size || t.sqft || t.now || t.want)) {
    const bits = [
      t.sqft ? `about ${t.sqft} sq ft` : t.size && t.size !== "not_sure" ? label(TOP_SIZES, t.size) : null,
      t.now ? `now ${label(TOP_NOW, t.now)?.toLowerCase()}` : null,
      t.want ? `wants ${label(TOP_WANT, t.want)?.toLowerCase()}` : null,
    ].filter(Boolean);
    if (bits.length) out.push(`Countertops: ${bits.join(" · ")}`);
  }
  const b = a.bath;
  if (showsBath(p) && b) {
    out.push(
      [
        `Bath: ${label(BATH_ROOMS, b.room) ?? "room not given"}`,
        b.now ? `now ${label(BATH_NOW, b.now)?.toLowerCase()}` : null,
        b.want ? `wants ${label(BATH_WANT, b.want)?.toLowerCase()}` : null,
        label(BATH_SCOPE, b.scope),
        b.vanity ? `vanity ${label(VANITIES, b.vanity)}` : null,
        b.size ? label(BATH_SIZES, b.size)?.toLowerCase() : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }
  const when = label(WHEN, a.when);
  const budget = BUDGETS.find((x) => x.key === a.budget)?.label;
  const own = a.owns_home === true ? "owns the home" : a.owns_home === false ? "does NOT own the home" : null;
  const tail = [when ? `When: ${when}` : null, budget ? `Budget: ${budget}` : null, own].filter(Boolean);
  if (tail.length) out.push(tail.join(" · "));
  return out;
}

export function budgetRange(key: string | null | undefined): { min: number | null; max: number | null } {
  const b = BUDGETS.find((x) => x.key === key);
  return { min: b?.min ?? null, max: b?.max ?? null };
}
