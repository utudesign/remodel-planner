import { redirect } from "next/navigation";

/** Old partner deal link (in hand-off packets) → the deal in the main app. */
export default async function PartnerDeal({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  redirect(`/deals/${encodeURIComponent(number)}?tab=partner`);
}
