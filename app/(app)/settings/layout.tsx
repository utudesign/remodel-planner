import { PageHeader } from "@/components/shared/states";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireOwner } from "@/lib/auth/require-role";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <>
      <PageHeader title="Settings" description="How the app behaves for you. No code needed." />
      <SettingsNav />
      {children}
    </>
  );
}
