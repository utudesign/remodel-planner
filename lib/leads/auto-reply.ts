/** The first reply to every new lead: qualifying questions + booking link (SALES-REP-MODE §7). */
export const DEFAULT_AUTO_REPLY = `Hi {first}! Thanks for reaching out about your kitchen. I'm {me} — I come out, measure and put together a free estimate.

A few quick questions so I come prepared:
1) Cabinets only, or the whole kitchen (cabinets, countertops, install)?
2) When would you like it done?
3) A rough budget you have in mind?
4) Do you own the home, and about what year was it built?

Pick a time for the free visit (weekday evenings or Saturday): {link}`;

export function fillAutoReply(
  template: string | null | undefined,
  v: { customerName: string | null | undefined; myName: string | null | undefined; link: string },
): string {
  const first = (v.customerName ?? "").trim().split(/\s+/)[0] || "there";
  const me = (v.myName ?? "").trim().split(/\s+/)[0] || "your kitchen guy";
  return (template?.trim() ? template : DEFAULT_AUTO_REPLY)
    .replaceAll("{first}", first)
    .replaceAll("{me}", me)
    .replaceAll("{link}", v.link);
}

/** sms: link with a prefilled body (iOS uses "&body=", which also works with no number). */
export function smsHref(phone: string | null | undefined, body: string): string {
  const to = (phone ?? "").replace(/[^\d+]/g, "");
  return `sms:${to}&body=${encodeURIComponent(body)}`;
}
