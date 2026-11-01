import type { Metadata } from "next";
import { TutoringAdmin } from "@/components/admin/TutoringAdmin";
import { AppPage } from "@/components/app/AppPage";
import { requireAdminPage } from "@/lib/auth/guards";
import { adminBookings } from "@/lib/payments/tutoring";

export const metadata: Metadata = { title: "Tutoring", robots: { index: false } };

// Admin · Tutoring (F17, 06 §12, 10 MVP-07): every booking and where its money is; decide disputes.
export default async function AdminTutoringPage() {
  await requireAdminPage();
  const rows = await adminBookings();
  return (
    <AppPage
      crumbs={[{ label: "Tutoring" }]}
      title="Tutoring"
      description="Bookings held, taken and paid in the PayPal sandbox"
    >
      <TutoringAdmin
        rows={rows.map((b) => ({
          id: b.id,
          createdAt: b.createdAt,
          concept: { title: b.concept.title },
          learner: b.learner,
          tutor: b.tutor,
          startsAt: b.startsAt,
          price: b.price,
          commission: b.commission,
          status: b.status,
          proposedBy: b.proposedBy,
          tutorPayout: b.tutorPayout,
          note: b.note,
        }))}
      />
    </AppPage>
  );
}
