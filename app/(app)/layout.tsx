import { AppShell } from "@/components/app/AppShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { requireOnboardedPage } from "@/lib/auth/guards";

// Signed-in student area (Today · Courses · Practice · Me). Only adults who finished onboarding
// get in; everyone else is sent to sign-in or their next onboarding step.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireOnboardedPage();
  return (
    <QueryProvider>
      <AppShell user={{ name: `${viewer.profile.first_name} ${viewer.profile.last_name}`.trim(), email: viewer.email }}>
        {children}
      </AppShell>
    </QueryProvider>
  );
}
