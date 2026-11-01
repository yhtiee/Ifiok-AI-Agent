import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { AdminReview } from "@/components/app/contribute/AdminReview";
import { requireAdminPage } from "@/lib/auth/guards";
import { reviewQueue } from "@/lib/contribute/explainers";
import { mathHtmlFor } from "@/lib/exam/math";

export const metadata: Metadata = { title: "Review", robots: { index: false } };

// Admin · Review (12 §4 Q58): explainers and shares that need a person (email and password admin
// sign-in until TOTP ships with L-02). Payouts and tutoring have their own admin pages.
export default async function AdminReviewPage() {
  const viewer = await requireAdminPage();
  const queue = await reviewQueue(viewer);
  const all = [...queue.review, ...queue.reported, ...queue.spotChecks];
  const math = mathHtmlFor(all.flatMap((e) => (e.body ? [e.body] : [])));
  return (
    <AppPage crumbs={[{ label: "Review" }]} title="Review" description="Explainers and shares that need a person">
      <AdminReview queue={queue} math={math} />
    </AppPage>
  );
}
