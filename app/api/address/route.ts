import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-role";
import { addressDetails, addressProvider, suggestAddresses } from "@/server/address";

/**
 * GET /api/address?q=4100 chain&s=<session>   → { provider, items: AddressSuggestion[] }
 * GET /api/address?place=<id>&s=<session>     → { line }   (Google only: adds the ZIP)
 * Signed-in owner only, so the key can't be used by anyone else.
 */
const query = z.object({
  q: z.string().trim().min(3).max(120).optional(),
  place: z.string().trim().min(1).max(300).optional(),
  s: z.string().trim().min(8).max(64),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole("owner", "team", "partner");
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { q, place, s } = parsed.data;
  try {
    if (place) return NextResponse.json({ line: await addressDetails(place, s) });
    if (!q) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    return NextResponse.json({ provider: addressProvider(), items: await suggestAddresses(q, s) });
  } catch (e) {
    return NextResponse.json(
      { provider: addressProvider(), items: [], error: e instanceof Error ? e.message : "Lookup failed" },
      { status: 502 },
    );
  }
}
