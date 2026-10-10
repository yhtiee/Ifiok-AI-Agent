import type { Metadata } from "next";
import { EmptyState, Panel } from "@/components/app/Page";
import { AppPage } from "@/components/app/AppPage";
import { requireOnboardedPage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Practice", robots: { index: false } };

// Practice (07 §5.6): due reviews, weak spots, snap-and-mark. Filled by P1-04, P1-05, P1-09, P1-10.
export default async function PracticePage() {
  await requireOnboardedPage();
  return (
    <AppPage
      crumbs={[{ label: "Practice" }]}
      title="Practice"
      description="Reviews at the right time, your weak spots, and marking for your own working."
    >
      <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Panel title="Due now">
          <EmptyState
            title="Nothing to review yet"
            body="Questions you get wrong come back here just before you'd forget them."
          />
        </Panel>
        <Panel title="Weak spots">
          <EmptyState
            title="No weak spots found"
            body="When the same kind of mistake shows up three times, Ifiok lists it here with a short lesson to fix it."
          />
        </Panel>
      </div>
    </AppPage>
  );
}
