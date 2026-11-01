import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoCategoriesEditor } from "@/components/settings/photo-categories-editor";
import { requireOwner } from "@/lib/auth/require-role";
import { getPhotoCategories } from "@/server/queries/photo-categories";

export const metadata = { title: "Settings · Photos" };

export default async function PhotoSettings() {
  const s = await requireOwner();
  const rows = await getPhotoCategories(s, { all: true });
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Photo categories</CardTitle>
          <CardDescription>Used when taking photos, as filters on the Photos tab, and as the site-visit checklist.</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoCategoriesEditor rows={rows.map((r) => ({ key: r.key, label: r.label, hint: r.hint, min_required: r.min_required, active: r.active }))} />
        </CardContent>
      </Card>
    </div>
  );
}
