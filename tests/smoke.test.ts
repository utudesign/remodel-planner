import { describe, expect, it } from "vitest";
import { navFor } from "@/lib/nav";

describe("nav", () => {
  it("field users only see Today and Projects", () => {
    expect(navFor("field").map((i) => i.href)).toEqual(["/today", "/projects"]);
  });
  it("settings is admin-only", () => {
    expect(navFor("designer").some((i) => i.href === "/settings")).toBe(false);
    expect(navFor("admin").some((i) => i.href === "/settings")).toBe(true);
  });
});
