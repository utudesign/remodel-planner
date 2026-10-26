import { describe, expect, it } from "vitest";
import { isExact, likeEscape, parseItemQuery, rankByCode, type FoundItem } from "@/lib/item-search";

const item = (code: string, collection_id: string | null = "c1", id = `${code}-${collection_id}`): FoundItem => ({
  id,
  code,
  name: `${code} cabinet`,
  unit: "each",
  collection_id,
  price_cents: 10000,
  fixed: false,
});

describe("add by code", () => {
  it("reads quantities", () => {
    expect(parseItemQuery("B36")).toEqual({ term: "B36", qty: 1 });
    expect(parseItemQuery(" 2 B36 ")).toEqual({ term: "B36", qty: 2 });
    expect(parseItemQuery("2xB36")).toEqual({ term: "B36", qty: 2 });
    expect(parseItemQuery("B36 x3")).toEqual({ term: "B36", qty: 3 });
    expect(parseItemQuery("W3012*2")).toEqual({ term: "W3012", qty: 2 });
    expect(parseItemQuery("W3012")).toEqual({ term: "W3012", qty: 1 }); // trailing digits are part of the code
    expect(parseItemQuery("")).toEqual({ term: "", qty: 1 });
  });
  it("exact code first, then longer codes; nothing else", () => {
    const rows = [item("B36FH"), item("B36"), item("B3"), item("SB36"), item("B369")];
    expect(rankByCode(rows, "b36", "c1").map((r) => r.code)).toEqual(["B36", "B369", "B36FH"]);
    expect(isExact(rankByCode(rows, "b36", "c1")[0], "b36")).toBe(true);
  });
  it("the estimate's collection beats the generic item with the same code", () => {
    const rows = [item("B36", null), item("B36", "c1"), item("B36", "c2")];
    expect(rankByCode(rows, "B36", "c1")).toHaveLength(1);
    expect(rankByCode(rows, "B36", "c1")[0].collection_id).toBe("c1");
  });
  it("caps the list", () => {
    const rows = ["W3012", "W3015", "W3018", "W3021", "W3024", "W3030", "W3036", "W3042"].map((c) => item(c));
    expect(rankByCode(rows, "W30", "c1")).toHaveLength(6);
  });
  it("escapes LIKE wildcards", () => {
    expect(likeEscape("50%_off")).toBe("50\\%\\_off");
  });
});
