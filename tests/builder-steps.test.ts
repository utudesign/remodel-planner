import { describe, expect, it } from "vitest";
import { noteWithSinkType, resolveAccessory, sinkTypeFromNote, splitSteps } from "@/lib/estimating/builder-steps";

const sections = { cabinetry: "s1", countertop: "s2" };
const line = (p: Partial<{ id: string; code: string; cost_category: string | null; collection_id: string | null; section_id: string }>) => ({
  id: "x",
  code: "",
  cost_category: "materials",
  collection_id: null,
  section_id: "s5",
  ...p,
});

describe("splitSteps (v3 item 10)", () => {
  it("puts each line under its step", () => {
    const s = splitSteps(
      [
        line({ id: "cab", code: "B36", collection_id: "c1", section_id: "s1" }),
        line({ id: "trim", code: "BF3", section_id: "s1" }),
        line({ id: "lab", cost_category: "labor" }),
        line({ id: "qz", code: "QZ2", section_id: "s2", cost_category: "subcontractor" }),
        line({ id: "sp", code: "SPECIAL-gas", section_id: "s3", cost_category: "subcontractor" }),
        line({ id: "misc", code: "", section_id: "s5" }),
      ],
      sections,
    );
    expect(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.map((l) => l.id)]))).toEqual({
      cabinets: ["cab", "trim"],
      labor: ["lab"],
      countertop: ["qz"],
      special: ["sp"],
      other: ["misc"],
    });
  });
});

describe("sink type note", () => {
  it("reads and writes the sink type without losing the rest of the note", () => {
    expect(noteWithSinkType(null, "Undermount")).toBe("Sink: Undermount");
    expect(noteWithSinkType("Sink: Undermount · 2 cm edge", "Farmhouse")).toBe("Sink: Farmhouse · 2 cm edge");
    expect(noteWithSinkType("Sink: Undermount · 2 cm edge", null)).toBe("2 cm edge");
    expect(sinkTypeFromNote("Sink: Client's own sink · x")).toBe("Client's own sink");
    expect(sinkTypeFromNote("nothing")).toBeNull();
  });
});

describe("resolveAccessory", () => {
  const items = [
    { id: "a", code: "F342", name: "Wall Filler", collection_id: "sky" },
    { id: "b", code: "F342", name: "Wall Filler", collection_id: "other" },
    { id: "c", code: "BF3", name: "Base filler (generic)", collection_id: null },
    { id: "d", code: "", name: "LED tape light, 3000K dimmable (per ft, from 16 ft kit)", collection_id: null },
  ];
  it("uses the estimate's color group first, then a generic item, then a name", () => {
    expect(resolveAccessory({ code: "f342", item_name: null }, "sky", items)?.id).toBe("a");
    expect(resolveAccessory({ code: "BF3", item_name: null }, "sky", items)?.id).toBe("c");
    expect(resolveAccessory({ code: null, item_name: "LED tape light, 3000K dimmable (per ft, from 16 ft kit)" }, null, items)?.id).toBe("d");
    expect(resolveAccessory({ code: "F342", item_name: null }, null, items)).toBeNull();
  });
});
