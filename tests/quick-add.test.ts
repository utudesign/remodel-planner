import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/quick-add";

describe("parseQuickAdd", () => {
  it("Marketplace message with name on the first line", () => {
    const r = parseQuickAdd(
      "Maria Gonzalez\nHi, is this still available? Need white shaker for a 10x10. 703-555-0141",
    );
    expect(r).toMatchObject({ name: "Maria Gonzalez", phone: "(703) 555-0141", email: null });
  });
  it("labelled fields", () => {
    const r = parseQuickAdd("Name: James Park\nEmail: jp@example.com\nPhone: +1 (571) 555 0188");
    expect(r).toMatchObject({
      name: "James Park",
      phone: "(571) 555-0188",
      email: "jp@example.com",
    });
  });
  it("doesn't take a greeting as a name", () => {
    expect(parseQuickAdd("Hi there\ninterested in cabinets").name).toBeNull();
    expect(parseQuickAdd("Hello\n5715550123").phone).toBe("(571) 555-0123");
  });
  it("keeps the whole message as notes", () => {
    expect(parseQuickAdd("  Hi, price for counters?  ").notes).toBe("Hi, price for counters?");
  });
});
