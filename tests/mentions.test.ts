import { describe, expect, it } from "vitest";
import { parseMentions } from "@/lib/mentions";

const team = [
  { id: "t", name: "Tugu Z" },
  { id: "c", name: "Crystal" },
  { id: "a", name: "Office Admin" },
];

describe("parseMentions", () => {
  it("matches first names and full names", () => {
    expect(parseMentions("@Crystal can you measure Sat? cc @tugu", team).sort()).toEqual([
      "c",
      "t",
    ]);
    expect(parseMentions("@Office Admin please book", team)).toEqual(["a"]);
  });
  it("ignores emails and partial words", () => {
    expect(parseMentions("send to crystal@example.com", team)).toEqual([]);
    expect(parseMentions("@Crystalline", team)).toEqual([]);
  });
});
