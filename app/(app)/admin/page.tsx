import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { AdminReview } from "@/components/app/contribute/AdminReview";
import { isReviewAdmin, requireOnboardedPage } from "@/lib/auth/guards";
import { reviewQueue } from "@/lib/contribute/explainers";
import { mathHtmlFor } from "@/lib/exam/math";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// The admin section (12 §4 Q58): short review queues behind the admin role (email and password
// until TOTP admin sign-in ships with L-02). Anyone else gets a 404.
export default async function AdminPage() {
  const viewer = await requireOnboardedPage();
  if (!(await isReviewAdmin())) notFound();
  const queue = await reviewQueue(viewer);
  const all = [...queue.review, ...queue.reported, ...queue.spotChecks];
  const math = mathHtmlFor(all.flatMap((e) => (e.body ? [e.body] : [])));
  return (
    <AppPage crumbs={[{ label: "Admin" }]} title="Admin" description="Explainers and shares that need a person">
      <AdminReview queue={queue} math={math} />
    </AppPage>
  );
}
