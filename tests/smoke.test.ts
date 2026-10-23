import { describe, expect, it } from "vitest";
import { navFor } from "@/lib/nav";

describe("nav", () => {
  it("crew only see Today and Jobs", () => {
    expect(navFor("crew").map((i) => i.href)).toEqual(["/today", "/projects"]);
  });
  it("settings is owner-only", () => {
    expect(navFor("team").some((i) => i.href === "/settings")).toBe(false);
    expect(navFor("owner").some((i) => i.href === "/settings")).toBe(true);
  });
});
