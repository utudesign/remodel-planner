import Link from "next/link";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getSession } from "@/lib/auth/require-role";

/** Partner login shell (Crystal): only the deals handed to her company. */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (s.role === "owner") redirect("/today");
  if (s.role !== "partner") redirect("/no-access");
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card/95 px-4 backdrop-blur">
        <Link href="/p" className="font-semibold tracking-tight">
          Jobs from {s.companyName.replace(/ —.*$/, "")}
        </Link>
        <UserButton />
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-16">{children}</main>
    </div>
  );
}
