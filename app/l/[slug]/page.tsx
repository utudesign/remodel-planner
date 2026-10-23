import { notFound } from "next/navigation";
import { LeadForm } from "@/components/public/lead-form";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const metadata = { title: "Free kitchen estimate" };

/** Public share link I post in Facebook groups: a short form that creates a lead. */
export default async function PublicLeadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) notFound();
  const db = createAdminSupabase();
  const { data: link } = await db
    .from("lead_links")
    .select("active, company:companies(id)")
    .eq("slug", slug)
    .maybeSingle();
  if (!link?.active || !link.company) notFound();
  const { data: owner } = await db
    .from("users")
    .select("name")
    .eq("company_id", link.company.id)
    .eq("role", "owner")
    .eq("is_default_owner", true)
    .maybeSingle();
  const first = (owner?.name ?? "").split(/\s+/)[0];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-4 py-8">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Free kitchen estimate</h1>
        <p className="mt-1 text-muted-foreground">
          {first ? `Hi, I'm ${first}. ` : ""}I come to your home, measure, and give you a written estimate for new
          cabinets, countertops or a full kitchen. Weekday evenings and Saturdays.
        </p>
      </div>
      <LeadForm slug={slug} />
    </main>
  );
}
