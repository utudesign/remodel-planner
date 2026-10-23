import { describe, expect, it } from "vitest";
import { formatBps, formatBudget, formatCents, parseDollarsToCents } from "@/lib/money";

describe("parseDollarsToCents", () => {
  it.each([
    ["12,400", 1240000],
    ["$1,234.5", 123450],
    ["99.99", 9999],
    ["0.01", 1],
    ["  7 ", 700],
    ["0.1", 10],
  ])("%s → %d", (input, cents) => expect(parseDollarsToCents(input)).toBe(cents));

  it("treats empty as null", () => {
    expect(parseDollarsToCents("")).toBeNull();
    expect(parseDollarsToCents(null)).toBeNull();
  });

  it.each(["-5", "1.234", "abc", "1.2.3", "12e3"])("rejects %s", (input) =>
    expect(() => parseDollarsToCents(input)).toThrow(),
  );

  it("never goes through floating point (0.29 stays 29 cents)", () => {
    expect(parseDollarsToCents("0.29")).toBe(29);
    expect(parseDollarsToCents("1.15")).toBe(115);
  });
});

describe("formatting", () => {
  it("formats cents as USD", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(null)).toBe("—");
  });
  it("formats budget ranges", () => {
    expect(formatBudget(800000, 1200000)).toBe("$8k–$12k");
    expect(formatBudget(null, null)).toBe("—");
  });
  it("formats basis points", () => expect(formatBps(2793)).toBe("27.9%"));
});
