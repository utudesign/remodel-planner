import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyForm } from "@/components/settings/company-form";
import { LookupEditor } from "@/components/settings/lookup-editor";
import { requirePageRole } from "@/lib/auth/require-role";
import { getCostCategories, getLostReasons } from "@/server/queries/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const s = await requirePageRole("admin");
  const [categories, reasons] = await Promise.all([getCostCategories(s), getLostReasons(s)]);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>
            Target margin draws the line on the margin report (playbook: 35–45%).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm name={s.companyName} targetMarginBps={s.settings.targetMarginBps} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Cost buckets</CardTitle>
          <CardDescription>Estimate vs actual is tracked per bucket.</CardDescription>
        </CardHeader>
        <CardContent>
          <LookupEditor table="cost_categories" rows={categories} addLabel="Bucket" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lost reasons</CardTitle>
          <CardDescription>Required when a lead is marked lost.</CardDescription>
        </CardHeader>
        <CardContent>
          <LookupEditor table="lost_reasons" rows={reasons} addLabel="Reason" />
        </CardContent>
      </Card>
    </div>
  );
}
