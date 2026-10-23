import { MessageSquare, Navigation, NotebookPen, Phone } from "lucide-react";

/** Big one-thumb actions (CONTEXT §6): Call · Text · Navigate · Log. Sticky above the tab bar on phones. */
export function LeadActionBar({
  phone,
  address,
}: {
  phone: string | null;
  address: string | null;
}) {
  const cls =
    "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border bg-card text-xs font-medium shadow-xs";
  const off = "pointer-events-none opacity-40";
  return (
    <div className="sticky top-14 z-20 -mx-4 flex gap-2 bg-background/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:px-0">
      <a href={phone ? `tel:${phone}` : undefined} className={`${cls} ${phone ? "" : off}`}>
        <Phone className="size-5" /> Call
      </a>
      <a href={phone ? `sms:${phone}` : undefined} className={`${cls} ${phone ? "" : off}`}>
        <MessageSquare className="size-5" /> Text
      </a>
      <a
        href={address ? `https://maps.google.com/?daddr=${encodeURIComponent(address)}` : undefined}
        target="_blank"
        rel="noreferrer"
        className={`${cls} ${address ? "" : off}`}
      >
        <Navigation className="size-5" /> Navigate
      </a>
      <a href="#log" className={cls}>
        <NotebookPen className="size-5" /> Log
      </a>
    </div>
  );
}
