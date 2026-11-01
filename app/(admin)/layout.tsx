import { AdminShell } from "@/components/admin/AdminShell";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Toaster } from "@/components/ui/sonner";
import { requireAdminPage } from "@/lib/auth/guards";
// Explainers under review can carry maths (pre-rendered KaTeX).
import "katex/dist/katex.min.css";

// The admin interface (12 §4 Q58, Q63): admin accounts only, no student onboarding or screens.
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const viewer = await requireAdminPage();
  return (
    <QueryProvider>
      <AdminShell email={viewer.email}>{children}</AdminShell>
      <Toaster />
    </QueryProvider>
  );
}
