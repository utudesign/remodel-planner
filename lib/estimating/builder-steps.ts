/**
 * The estimate's steps (change request v3 item 10): which saved line shows under which step.
 * Pure, so it is tested on its own (tests/builder-steps.test.ts).
 *
 *   cabinets    vendor items (any color group) and anything in the Cabinetry section
 *   labor       lines whose cost category is labor
 *   countertop  lines in the countertop section
 *   special     special-work lines (code SPECIAL-<type>, written by addSpecialWork)
 *   other       everything else (old template lines: sink parts, consumables, permit, …)
 */
export type StepKey = "cabinets" | "labor" | "countertop" | "special" | "other";

export type StepLine = {
  id: string;
  code: string;
  cost_category: string | null;
  collection_id: string | null;
  section_id: string;
};

export const SPECIAL_PREFIX = "SPECIAL-";

export function stepOf(
  line: StepLine,
  sections: { cabinetry: string | null; countertop: string | null },
): StepKey {
  if (line.code.startsWith(SPECIAL_PREFIX)) return "special";
  if (line.cost_category === "labor") return "labor";
  if (line.collection_id || (sections.cabinetry && line.section_id === sections.cabinetry)) return "cabinets";
  if (sections.countertop && line.section_id === sections.countertop) return "countertop";
  return "other";
}

export function splitSteps<T extends StepLine>(
  lines: T[],
  sections: { cabinetry: string | null; countertop: string | null },
): Record<StepKey, T[]> {
  const out: Record<StepKey, T[]> = { cabinets: [], labor: [], countertop: [], special: [], other: [] };
  for (const l of lines) out[stepOf(l, sections)].push(l);
  return out;
}

/** Sink types for the countertop step (saved as the note on the countertop line). */
export const SINK_TYPES = ["Undermount", "Farmhouse", "Drop-in", "Client's own sink", "No sink"] as const;

const SINK_NOTE = /^Sink: ([^·]+?)(?: · |$)/;

export function sinkTypeFromNote(note: string | null | undefined): string | null {
  const m = SINK_NOTE.exec(note ?? "");
  return m ? m[1].trim() : null;
}

export function noteWithSinkType(note: string | null | undefined, sink: string | null): string | null {
  const rest = (note ?? "").replace(SINK_NOTE, "").trim();
  const parts = [sink ? `Sink: ${sink}` : "", rest].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Accessory → the price-list item it means for this estimate: the code in the estimate's color group,
 * else a generic (no color group) item with that code, else the generic item with that name.
 */
export function resolveAccessory<I extends { id: string; code: string; name: string; collection_id: string | null }>(
  acc: { code: string | null; item_name: string | null },
  collectionId: string | null,
  items: I[],
): I | null {
  if (acc.code) {
    const code = acc.code.toUpperCase();
    const inGroup = collectionId ? items.find((i) => i.collection_id === collectionId && i.code.toUpperCase() === code) : undefined;
    if (inGroup) return inGroup;
    const generic = items.find((i) => !i.collection_id && i.code.toUpperCase() === code);
    if (generic) return generic;
  }
  if (acc.item_name) return items.find((i) => !i.collection_id && i.name === acc.item_name) ?? null;
  return null;
}
