import { formatCents } from "@/lib/money";

/** Payment-link texts (v3 G). Pure; tested in tests/payments.test.ts. */

/** "Hi Maria, here's the deposit for your kitchen: $9,000.00 …" — the Text it message (v3 G). */
export function paymentText(p: { label: string; amount_cents: number; link_url: string }, client: string | null, company: string) {
  const hi = client ? `Hi ${client.split(" ")[0]}, ` : "Hi, ";
  return `${hi}here's the payment link for your ${p.label.toLowerCase()} (${formatCents(p.amount_cents)}) with ${company}: ${p.link_url}\nBank transfer (ACH) is free. Thank you!`;
}

/** iOS and Android both open Messages from sms:<number>?&body=… */
export function smsHref(phone: string | null, body: string) {
  const to = (phone ?? "").replace(/[^\d+]/g, "");
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}
