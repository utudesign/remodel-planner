import Link from "next/link";

export const metadata = { title: "No access" };

export default async function NoAccess({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">No access</h1>
      <p className="text-muted-foreground">
        {reason ?? "Your login isn't linked to this app. If you were invited, sign in with the email the invite went to."}
      </p>
      <Link href="/sign-in" className="text-primary underline">
        Sign in with another account
      </Link>
    </main>
  );
}
