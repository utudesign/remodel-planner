import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/require-role";
import { homeFor } from "@/lib/auth/roles";

/** Each role has its own home: team → Deals board (v3 E1), workers → My work, customers → their job. */
export default async function Home() {
  const s = await getSession();
  redirect(s.role === "crew" || s.role === "customer" ? homeFor(s.role) : "/deals");
}
