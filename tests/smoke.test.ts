import { describe, expect, it } from "vitest";
import { navFor, tabsFor } from "@/lib/nav";

describe("nav", () => {
  it("phone tabs: Today · Leads · Jobs · Money · More", () => {
    expect(tabsFor("team").map((i) => i.label)).toEqual(["Today", "Leads", "Jobs", "Money", "More"]);
  });
  it("crew only see Today and Jobs", () => {
    expect(tabsFor("crew").map((i) => i.href)).toEqual(["/today", "/projects"]);
    expect(navFor("crew").map((i) => i.href)).toEqual(["/today", "/projects"]);
  });
  it("settings is owner-only", () => {
    expect(navFor("team").some((i) => i.href === "/settings")).toBe(false);
    expect(navFor("owner").some((i) => i.href === "/settings")).toBe(true);
  });
});
