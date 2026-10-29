import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { BookingPicker, type Day } from "@/components/public/booking-picker";
import { readSettings } from "@/lib/auth/require-role";
import { availableSlots } from "@/lib/booking";
import { formatDateTime } from "@/lib/dates";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { busyMeetings, hostFirstName } from "@/server/workspace";

export const metadata = { title: "Book your free visit" };

/** The client picks a visit slot (weekday evenings + Saturdays) from the link in my auto-reply. */
export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();
  const db = createAdminSupabase();
  const { data: deal } = await db
    .from("deals")
    .select("id, company_id, workspace_id, owner_id, deleted_at, contact:contacts(name), company:companies(timezone, settings_json)")
    .eq("booking_token", token)
    .maybeSingle();
  if (!deal || deal.deleted_at || !deal.company) notFound();
  const tz = deal.company.timezone;
  const st = readSettings((deal.company.settings_json ?? {}) as Record<string, unknown>);
  const now = new Date();
  const [booked, { data: mine }, me] = await Promise.all([
    busyMeetings(deal.company_id, deal.workspace_id, now),
    db
      .from("meetings")
      .select("starts_at")
      .eq("deal_id", deal.id)
      .eq("status", "scheduled")
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(1),
    hostFirstName(deal.company_id, deal.owner_id),
  ]);
  const busy = booked.map((m) => ({
    start: new Date(m.starts_at),
    end: new Date(m.ends_at ?? new Date(new Date(m.starts_at).getTime() + st.booking.minutes * 60_000)),
  }));
  const slots = availableSlots(st.booking, busy, now, tz);
  const days: Day[] = [];
  for (const s of slots) {
    let d = days.find((x) => x.date === s.date);
    if (!d) {
      d = { date: s.date, label: formatInTimeZone(new Date(s.start), tz, "EEEE, MMM d"), slots: [] };
      days.push(d);
    }
    d.slots.push({ start: s.start, label: s.label });
  }
  const first = (deal.contact?.name ?? "").split(/\s+/)[0];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Book your free visit</h1>
        <p className="mt-1 text-muted-foreground">
          {first ? `Hi ${first}! ` : ""}Pick a time for {me || "me"} to come measure your kitchen (about {st.booking.minutes} minutes).
        </p>
        {mine?.[0] ? (
          <p className="mt-3 rounded-xl bg-accent p-3 text-sm font-medium text-accent-foreground">
            You already have a visit on {formatDateTime(mine[0].starts_at, tz)}. Booking again adds another time.
          </p>
        ) : null}
      </div>
      <BookingPicker token={token} days={days} />
    </main>
  );
}
