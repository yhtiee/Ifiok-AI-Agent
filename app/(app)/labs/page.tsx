import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { LabsPanel } from "@/components/app/labs/LabsPanel";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getMyCourses } from "@/lib/courses/read";
import { getLabs } from "@/lib/labs/service";

export const metadata: Metadata = { title: "Labs", robots: { index: false } };

// Labs (10 MVP-05, 12 §4 Q56): every virtual lab the student has, what is being built or was
// declined, and "Request a lab" (filed under one of their courses, or none). A course's own labs
// are also in its Labs tab.
export default async function LabsPage() {
  const viewer = await requireOnboardedPage();
  const [labs, courses] = await Promise.all([getLabs(viewer), getMyCourses(viewer)]);
  return (
    <AppPage crumbs={[{ label: "Labs" }]} title="Labs">
      <LabsPanel
        view={labs}
        courseId={null}
        courses={courses.map((c) => ({ id: c.id, code: c.code }))}
        primary
        hideHeading
      />
    </AppPage>
  );
}
