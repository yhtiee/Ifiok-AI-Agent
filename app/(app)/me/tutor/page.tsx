import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { TutorForm } from "@/components/app/contribute/TutorForm";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { myTopicOptions } from "@/lib/contribute/topics";
import { getTutorProfile } from "@/lib/contribute/tutor";
import { getConfig } from "@/lib/config";

export const metadata: Metadata = { title: "Tutor profile", robots: { index: false } };

// Become a tutor (F17-FR1, 10 MVP-06, MVP-07): topics, availability and a price per session.
export default async function TutorProfilePage() {
  const viewer = await requireOnboardedPage();
  const [topics, profile, band] = await Promise.all([
    myTopicOptions(viewer),
    getTutorProfile(viewer),
    getConfig("tutoring"),
  ]);
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
          band={{
            minCents: band.price_min_cents,
            maxCents: band.price_max_cents,
            takeRate: band.take_rate,
            minutes: band.session_minutes,
          }}
          initial={
            profile
              ? {
                  availability: profile.availability,
                  active: profile.active,
                  priceCents: profile.priceCents,
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
