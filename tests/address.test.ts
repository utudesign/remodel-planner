import { describe, expect, it } from "vitest";
import { addressForMaps, formatAddressLine, parseAddressLine } from "@/lib/address";

describe("parseAddressLine", () => {
  it("splits a Google-style line", () => {
    expect(parseAddressLine("4100 Chain Bridge Rd, Fairfax, VA 22030, USA")).toEqual({
      street: "4100 Chain Bridge Rd",
      city: "Fairfax",
      zip: "22030",
    });
  });
  it("keeps the state on out-of-state towns", () => {
    expect(parseAddressLine("7700 Old Georgetown Rd, Bethesda, MD 20814")).toEqual({
      street: "7700 Old Georgetown Rd",
      city: "Bethesda, MD",
      zip: "20814",
    });
  });
  it("keeps a unit with the street", () => {
    expect(parseAddressLine("100 Main St, Apt 4B, Vienna, VA 22180-1234")).toEqual({
      street: "100 Main St, Apt 4B",
      city: "Vienna",
      zip: "22180",
    });
  });
  it("handles a geoapify line and 'United States of America'", () => {
    expect(parseAddressLine("9200 Burke Lake Road, Burke, VA 22015, United States of America").city).toBe("Burke");
  });
  it("handles city and state without a comma", () => {
    expect(parseAddressLine("12 Oak Ct, Herndon VA 20170")).toEqual({ street: "12 Oak Ct", city: "Herndon", zip: "20170" });
  });
  it("street only, or empty", () => {
    expect(parseAddressLine("12 Oak Ct")).toEqual({ street: "12 Oak Ct", city: null, zip: null });
    expect(parseAddressLine("  ")).toEqual({ street: null, city: null, zip: null });
  });
  it("round-trips through formatAddressLine", () => {
    for (const line of ["4100 Chain Bridge Rd, Fairfax, VA 22030", "7700 Old Georgetown Rd, Bethesda, MD 20814"]) {
      const p = parseAddressLine(line);
      expect(formatAddressLine(p.street, p.city, p.zip)).toBe(line);
    }
  });
  it("maps link text", () => {
    expect(addressForMaps(null, null, null)).toBe("");
    expect(addressForMaps(null, "Burke", null)).toBe("Burke, VA");
  });
});

describe("navigate", () => {
  it("opens Google Maps driving directions", async () => {
    const { directionsUrl } = await import("@/lib/address");
    expect(directionsUrl("4100 Chain Bridge Rd, Fairfax, VA 22030")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=4100%20Chain%20Bridge%20Rd%2C%20Fairfax%2C%20VA%2022030&travelmode=driving",
    );
  });
});
