import { notFound } from "next/navigation";
import { LeadForm } from "@/components/public/lead-form";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hostFirstName } from "@/server/workspace";

export const metadata = { title: "Free estimate" };

/** Public share link I post in Facebook groups: a short form that creates a lead. */
export default async function PublicLeadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound();
  const db = createAdminSupabase();
  const { data: link } = await db
    .from("lead_links")
    .select("active, user_id, company:companies(id)")
    .eq("slug", slug)
    .maybeSingle();
  if (!link?.active || !link.company) notFound();
  const first = await hostFirstName(link.company.id, link.user_id);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Free kitchen &amp; bath estimate</h1>
        <p className="mt-1 text-muted-foreground">
          {first ? `Hi, I'm ${first}. ` : ""}A few quick taps about your space, and I&apos;ll come
          measure and give you a written estimate. Weekday evenings and Saturdays.
        </p>
      </div>
      <LeadForm slug={slug} />
    </main>
  );
}
