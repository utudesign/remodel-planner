import { Card, CardContent } from "@/components/ui/card";
import { CompanyForm } from "@/components/settings/company-form";
import { requireOwner } from "@/lib/auth/require-role";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await requireOwner();
  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <CompanyForm name={s.companyName} settings={s.settings} />
      </CardContent>
    </Card>
  );
}
