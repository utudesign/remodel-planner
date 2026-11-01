import { describe, expect, it } from "vitest";
import { jobHealth, swatchFor, PALETTE } from "@/lib/jobs/colors";

describe("job workspace colors + health", () => {
  it("a trade keeps its color by its Settings order", () => {
    const order = [{ key: "installer" }, { key: "plumber" }];
    expect(swatchFor("plumber", order)).toBe(PALETTE[1]);
    expect(swatchFor(null, order)).toBeNull();
  });
  it("on track / at risk / off track", () => {
    const today = "2026-11-10";
    expect(jobHealth([{ status: "doing", end_on: "2026-11-12" }], today).key).toBe("on");
    expect(jobHealth([{ status: "doing", end_on: "2026-11-09" }], today).key).toBe("risk");
    expect(jobHealth([{ status: "blocked", end_on: null }], today).key).toBe("risk");
    expect(jobHealth([{ status: "todo", end_on: "2026-11-01" }], today).key).toBe("off");
    expect(jobHealth([{ status: "done", end_on: "2026-11-01" }], today).key).toBe("on");
  });
});
