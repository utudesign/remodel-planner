import { describe, expect, it } from "vitest";
import { paymentText, smsHref } from "@/lib/jobs/payments";

describe("payment link text (v3 G)", () => {
  it("names the installment, amount and link; says ACH is free", () => {
    const t = paymentText({ label: "Deposit", amount_cents: 900000, link_url: "https://pay.melio.com/x" }, "Maria Gonzalez", "RenoDesign");
    expect(t).toContain("Hi Maria,");
    expect(t).toContain("deposit ($9,000.00)");
    expect(t).toContain("https://pay.melio.com/x");
    expect(t).toMatch(/ACH\) is free/);
  });
  it("opens Messages with the number and the body", () => {
    expect(smsHref("(571) 555-0101", "a b")).toBe("sms:5715550101?&body=a%20b");
  });
});
