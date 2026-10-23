import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/require-role";

export const metadata = { title: "My jobs" };

/** Partner login (Crystal): her deals list arrives with the hand-off step. */
export default async function PartnerHome() {
  const s = await getSession();
  if (s.role !== "partner") redirect("/today");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">Hi {s.name || "there"}</h1>
      <p className="text-muted-foreground">Deals handed to you will show up here.</p>
    </main>
  );
}
