import { PageHeader } from "@/components/shared/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requirePageRole } from "@/lib/auth/require-role";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole("owner");
  return (
    <>
      <PageHeader title="Settings" description="Change how the workflow behaves. No code needed." />
      <SettingsNav />
      {children}
    </>
  );
}
