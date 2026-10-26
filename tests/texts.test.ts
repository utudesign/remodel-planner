import { describe, expect, it } from "vitest";
import { brandName, buildTextVars, dueAt, fillText, NO_LINK, orderForStage, suggestText, visitWhen, type TextTemplate } from "@/lib/texts";

const t = (key: string, stage: string | null, after: number | null, sort: number, body = `{first} ${key}`): TextTemplate => ({
  key,
  label: key,
  body,
  stage_key: stage,
  after_days: after,
  sort_order: sort,
  active: true,
});
const TEMPLATES = [
  t("on_my_way", "visit_booked", 0, 10),
  t("running_late", "visit_booked", null, 20),
  t("estimate_sent", "estimate", 0, 50),
  t("check_2", "estimate", 2, 60),
  t("check_5", "estimate", 5, 70),
  t("referral", "handed_off", null, 110),
];

describe("texts", () => {
  it("fills the first text: on my way", () => {
    const vars = buildTextVars({
      customerName: "Maria Gonzalez",
      myName: "Tuuguu Zorigtbaatar",
      partnerName: "RenoDesign Inc.",
      partnerContact: "Crystal Lee",
      nextVisitAt: null,
      estimateLink: null,
      bookingLink: "https://x/book/1",
    });
    expect(
      fillText("Hi {first}, this is {me} from {brand}. I'm on my way to our meeting at your place. See you soon!", vars),
    ).toBe("Hi Maria, this is Tuuguu from RenoDesign. I'm on my way to our meeting at your place. See you soon!");
    expect(fillText("{partner_contact} {link} {unknown}", vars)).toBe(`Crystal ${NO_LINK} {unknown}`);
  });
  it("falls back when names are missing", () => {
    const v = buildTextVars({ customerName: null, myName: "", partnerName: null, partnerContact: null, nextVisitAt: null, estimateLink: null, bookingLink: "" });
    expect([v.first, v.brand, v.when]).toEqual(["there", "RenoDesign", "soon"]);
  });
  it("brand drops the legal suffix", () => {
    expect(brandName("RenoDesign Inc.")).toBe("RenoDesign");
    expect(brandName("Acme Kitchens, LLC")).toBe("Acme Kitchens");
  });
  it("visit time reads naturally (Eastern)", () => {
    const now = new Date("2026-10-27T14:00:00Z"); // Tue 10 AM EDT
    expect(visitWhen("2026-10-27T22:30:00Z", "America/New_York", now)).toBe("today at 6:30 PM");
    expect(visitWhen("2026-10-28T13:00:00Z", "America/New_York", now)).toBe("tomorrow at 9:00 AM");
    expect(visitWhen("2026-10-31T13:00:00Z", "America/New_York", now)).toBe("Sat, Oct 31 at 9:00 AM");
  });
  it("suggests the first unsent step of the stage, in day order", () => {
    const entered = new Date("2026-10-26T15:00:00Z");
    const now = new Date("2026-10-26T16:00:00Z");
    let s = suggestText({ templates: TEMPLATES, stage: "estimate", stageEnteredAt: entered, sentKeysSinceStage: new Set(), now });
    expect(s.current?.key).toBe("estimate_sent");
    expect(s.early).toBe(false);
    s = suggestText({ templates: TEMPLATES, stage: "estimate", stageEnteredAt: entered, sentKeysSinceStage: new Set(["estimate_sent"]), now });
    expect(s.current?.key).toBe("check_2");
    expect(s.early).toBe(true);
    expect(s.dueAt?.toISOString()).toBe("2026-10-28T13:00:00.000Z"); // 9 AM EDT two days later
    expect(s.next?.key).toBe("check_5");
    s = suggestText({ templates: TEMPLATES, stage: "estimate", stageEnteredAt: entered, sentKeysSinceStage: new Set(["estimate_sent", "check_2", "check_5"]), now });
    expect(s.current).toBeNull();
  });
  it("manual texts (no day) are never suggested on their own", () => {
    const s = suggestText({ templates: TEMPLATES, stage: "handed_off", stageEnteredAt: new Date(), sentKeysSinceStage: new Set() });
    expect(s.current).toBeNull();
    expect(suggestText({ templates: TEMPLATES, stage: "visit_booked", stageEnteredAt: new Date(), sentKeysSinceStage: new Set() }).current?.key).toBe("on_my_way");
  });
  it("orders the picker: this stage first", () => {
    expect(orderForStage(TEMPLATES, "visit_booked").map((x) => x.key).slice(0, 2)).toEqual(["on_my_way", "running_late"]);
  });
  it("day 0 is due right away", () => {
    const at = new Date("2026-10-26T15:00:00Z");
    expect(dueAt(at, 0).getTime()).toBe(at.getTime());
  });
});
