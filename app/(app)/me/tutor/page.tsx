import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { TutorForm } from "@/components/app/contribute/TutorForm";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { myTopicOptions } from "@/lib/contribute/topics";
import { getTutorProfile } from "@/lib/contribute/tutor";

export const metadata: Metadata = { title: "Tutor profile", robots: { index: false } };

// Become a tutor (F17-FR1, profile only, 10 MVP-06): topics and availability; no bookings yet.
export default async function TutorProfilePage() {
  const viewer = await requireOnboardedPage();
  const [topics, profile] = await Promise.all([myTopicOptions(viewer), getTutorProfile(viewer)]);
  // Topics already offered stay listed even if they're no longer in the student's courses.
  const all = [
    ...topics,
    ...(profile?.concepts ?? [])
      .filter((c) => !topics.some((t) => t.conceptId === c.id))
      .map((c) => ({ conceptId: c.id, title: c.title, group: "Offered before" })),
  ];
  return (
    <AppPage
      crumbs={[{ label: "Me", href: "/me" }, { label: "Tutor profile" }]}
      title="Tutor profile"
      description="Offer to tutor topics you know well. You don't need to have mastered them on Ifiok."
      width="form"
    >
      {all.length ? (
        <TutorForm
          topics={all}
          initial={
            profile
              ? {
                  availability: profile.availability,
                  active: profile.active,
                  conceptIds: profile.concepts.map((c) => c.id),
                }
              : null
          }
        />
      ) : (
        <EmptyState
          title="Add a course or topic first"
          body="You offer to tutor topics from your courses or the topics you follow."
          action={
            <Button asChild variant="outline">
              <Link href="/courses">Find your course</Link>
            </Button>
          }
        />
      )}
    </AppPage>
  );
}
