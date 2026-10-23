import { describe, expect, it } from "vitest";
import { formatPhone, parseLeadMessage } from "@/lib/leads/parse-message";

describe("parseLeadMessage", () => {
  it("Marketplace: 'is this available' + phone + town + cabinets only", () => {
    const p = parseLeadMessage(
      "Hi, is this still available? I need new cabinets for my kitchen in Burke. You can call me 703-555-0102. Ahmed",
    );
    expect(p.source).toBe("marketplace");
    expect(p.phone).toBe("(703) 555-0102");
    expect(p.city).toBe("Burke");
    expect(p.scope).toBe("cabinets_only");
    expect(p.name).toBe("Ahmed");
  });

  it("group post: full kitchen remodel, name from 'my name is'", () => {
    const p = parseLeadMessage(
      "Hello! Saw your post in the Fairfax Moms group. My name is maria gonzalez, we want a full kitchen remodel this winter. (571) 555 0101",
    );
    expect(p.source).toBe("fb_group");
    expect(p.name).toBe("Maria Gonzalez");
    expect(p.scope).toBe("kitchen");
    expect(p.city).toBe("Fairfax");
    expect(p.phone).toBe("(571) 555-0101");
  });

  it("cabinets with quartz and install counts as a kitchen", () => {
    expect(parseLeadMessage("need cabinets and quartz countertops installed").scope).toBe("kitchen");
  });

  it("countertops only; longest town wins (Fairfax Station over Fairfax)", () => {
    const p = parseLeadMessage("Looking for quartz countertops, we're in Fairfax Station. email me jo@example.com");
    expect(p.scope).toBe("countertops");
    expect(p.city).toBe("Fairfax Station");
    expect(p.email).toBe("jo@example.com");
    expect(p.name).toBeNull();
  });

  it("nothing recognizable keeps the text as notes", () => {
    const p = parseLeadMessage("hello?");
    expect(p).toMatchObject({ name: null, phone: null, scope: null, city: null, notes: "hello?" });
  });
});

describe("formatPhone", () => {
  it("normalizes US numbers and ignores short ones", () => {
    expect(formatPhone("+1 703.555.0199")).toBe("(703) 555-0199");
    expect(formatPhone("call 5550199")).toBeNull();
  });
});

describe("name guard", () => {
  it("\"I'm in Fairfax\" is not a name", () => {
    expect(parseLeadMessage("Hi I'm in Fairfax and need a kitchen quote").name).toBeNull();
  });
});
