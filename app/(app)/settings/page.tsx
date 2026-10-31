import { Card, CardContent } from "@/components/ui/card";
import { CompanyForm } from "@/components/settings/company-form";
import { PriceLists } from "@/components/settings/price-lists";
import { requireOwner } from "@/lib/auth/require-role";
import { must } from "@/server/action-utils";

export const metadata = { title: "Settings" };
// The Skyline import (3.5k items) runs as a server action from this page.
export const maxDuration = 300;

export default async function SettingsPage() {
  const s = await requireOwner();
  const [lists, collections, colors] = await Promise.all([
    s.db.from("price_lists").select("id, vendor, name, effective_date").eq("company_id", s.companyId).order("vendor").then(must),
    s.db.from("catalog_collections").select("id, price_list_id").eq("company_id", s.companyId).eq("active", true).then(must),
    s.db.from("catalog_colors").select("price_list_id").eq("company_id", s.companyId).eq("active", true).then(must),
  ]);
  // Item counts per list (one count query per list keeps the payload small).
  const counts = await Promise.all(
    lists.map(async (l) => {
      const ids = collections.filter((c) => c.price_list_id === l.id).map((c) => c.id);
      if (!ids.length) return 0;
      const { count } = await s.db
        .from("catalog_items")
        .select("id", { count: "exact", head: true })
        .in("collection_id", ids)
        .eq("active", true);
      return count ?? 0;
    }),
  );
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <CompanyForm name={s.companyName} settings={s.settings} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <PriceLists
            lists={lists.map((l, i) => ({
              ...l,
              items: counts[i],
              colors: colors.filter((c) => c.price_list_id === l.id).length,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
