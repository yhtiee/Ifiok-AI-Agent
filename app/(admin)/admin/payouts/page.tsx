import type { Metadata } from "next";
import { PayoutsAdmin } from "@/components/admin/PayoutsAdmin";
import { AppPage } from "@/components/app/AppPage";
import { requireAdminPage } from "@/lib/auth/guards";
import { adminPayouts } from "@/lib/payments/payouts";
import { paypalReady } from "@/lib/payments/paypal";

export const metadata: Metadata = { title: "Payouts", robots: { index: false } };

// Admin · Payouts (10 MVP-07, 06 §3, §15): contributor pool payouts in the PayPal sandbox.
export default async function AdminPayoutsPage() {
  await requireAdminPage();
  const data = await adminPayouts();
  return (
    <AppPage crumbs={[{ label: "Payouts" }]} title="Payouts" description="The contribution pool, split by usage points">
      <PayoutsAdmin
        month={data.month}
        demoPoolCents={data.demoPoolCents}
        periods={data.periods}
        paypalReady={paypalReady()}
      />
    </AppPage>
  );
}
