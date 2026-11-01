import type { Session } from "@/lib/auth/require-role";
import { DEFAULT_PHOTO_CATEGORIES, type PhotoCategory } from "@/lib/deals/display";

/** Active photo categories in Settings order (v3 D, 0024). Falls back to the defaults if the table can't be read. */
export async function getPhotoCategories(s: Session, opts: { all?: boolean } = {}): Promise<(PhotoCategory & { active: boolean })[]> {
  let q = s.db.from("photo_categories").select("key, label, hint, min_required, active, sort_order").eq("company_id", s.companyId).order("sort_order");
  if (!opts.all) q = q.eq("active", true);
  const { data, error } = await q;
  if (error || !data?.length) return DEFAULT_PHOTO_CATEGORIES.map((c) => ({ ...c, active: true }));
  return data.map((c) => ({ key: c.key, label: c.label, hint: c.hint, min_required: c.min_required, active: c.active }));
}
