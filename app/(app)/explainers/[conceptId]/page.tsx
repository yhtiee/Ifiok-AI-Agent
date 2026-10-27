import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { ActionBar, EmptyState, SectionHeading } from "@/components/app/Page";
import { DataSaverSwitch, ExplainerCard } from "@/components/app/explainers/ExplainerCard";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { explainersForConcept } from "@/lib/contribute/explainers";
import { tutorsForConcept } from "@/lib/contribute/tutor";
import { mathHtmlFor } from "@/lib/exam/math";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Student explainers", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MASTERY_WORDS: Record<string, string> = { familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };

// A topic's student explainers and tutors (F18-FR6, F17-FR1, 10 MVP-06). Only approved explainers
// show; tutors are profiles only until bookings open after launch.
export default async function TopicExplainersPage({ params }: PageProps<"/explainers/[conceptId]">) {
  const viewer = await requireOnboardedPage();
  const { conceptId } = await params;
  if (!UUID.test(conceptId)) notFound();
  const supabase = await createClient();
  const { data: concept } = await supabase.from("concepts").select("id, title").eq("id", conceptId).maybeSingle();
  if (!concept) notFound();
  const [explainers, tutors] = await Promise.all([
    explainersForConcept(viewer, conceptId),
    tutorsForConcept(viewer, conceptId),
  ]);
  const math = mathHtmlFor(explainers.flatMap((e) => (e.body ? [e.body] : [])));

  return (
    <AppPage crumbs={[{ label: concept.title }]} title={concept.title} description="Explained by students">
      <div className="grid gap-10 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:gap-16">
        <section aria-labelledby="explainers" className="grid grid-cols-1 content-start gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading id="explainers">Student explainers</SectionHeading>
            <DataSaverSwitch />
          </div>
          {explainers.length ? (
            explainers.map((e) => <ExplainerCard key={e.id} ex={e} math={math} />)
          ) : (
            <EmptyState
              title="No explainers yet"
              body="Understood this topic? Explain it in writing, a voice note or a short video. You earn Units when it helps other students."
            />
          )}
        </section>

        <section aria-labelledby="tutors" className="grid content-start gap-3">
          <SectionHeading id="tutors">Students who tutor this</SectionHeading>
          {tutors.length ? (
            <ul className="grid gap-3">
              {tutors.map((t, i) => (
                <li key={i} className="grid gap-0.5 border-t border-line pt-3">
                  <span className="text-base font-semibold">
                    {t.isYou ? "You" : t.name}
                    {t.mastery ? (
                      <span className="font-normal text-ink-2"> · {MASTERY_WORDS[t.mastery]} on Ifiok</span>
                    ) : null}
                  </span>
                  <span className="text-sm text-ink-2">Free: {t.availability}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-ink-2">No one has offered to tutor this topic yet.</p>
          )}
          <p className="text-sm text-ink-2">Tutoring bookings open after launch.</p>
          <Link
            href="/me/tutor"
            className="inline-flex min-h-11 items-center justify-self-start text-base text-quantity underline-offset-4 hover:underline"
          >
            Offer to tutor topics
          </Link>
        </section>
      </div>
      <ActionBar>
        <Button asChild>
          <Link href={`/me/explainers/new?concept=${conceptId}`}>Explain this topic</Link>
        </Button>
      </ActionBar>
    </AppPage>
  );
}
