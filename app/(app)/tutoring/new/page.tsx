import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState } from "@/components/app/Page";
import { BookTutor } from "@/components/app/payments/BookTutor";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getConfig } from "@/lib/config";
import { tutorsForConcept } from "@/lib/contribute/tutor";
import { proposalFor } from "@/lib/payments/agent";
import { usd } from "@/lib/payments/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Book a tutor", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MASTERY_WORDS: Record<string, string> = { familiar: "Familiar", proficient: "Proficient", mastered: "Mastered" };
const uuid = (v: string | string[] | undefined) => (typeof v === "string" && UUID.test(v) ? v : null);

// Book a tutor (F17-FR2, 10 MVP-07). ?tutor=&concept= from a topic's tutors, or ?proposal= from Ifiok's
// tutoring agent (12 §4 Q63): the draft is read on the server (the student's own, still open), never
// taken from the URL, and the student still approves on PayPal.
export default async function NewBookingPage({ searchParams }: PageProps<"/tutoring/new">) {
  const viewer = await requireOnboardedPage();
  const q = await searchParams;
  const proposalId = uuid(q.proposal);
  const proposal = proposalId ? await proposalFor(viewer, proposalId) : null;
  const tutorId = proposal?.tutor.id ?? uuid(q.tutor);
  const conceptId = proposal?.concept.id ?? uuid(q.concept);
  if (!tutorId || !conceptId) notFound();

  const supabase = await createClient();
  const [{ data: concept }, tutors, cfg] = await Promise.all([
    supabase.from("concepts").select("id, title").eq("id", conceptId).maybeSingle(),
    tutorsForConcept(viewer, conceptId),
    getConfig("tutoring"),
  ]);
  if (!concept) notFound();
  const tutor = tutors.find((t) => t.tutorId === tutorId);
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(17, 0, 0, 0);

  return (
    <AppPage
      crumbs={[{ label: concept.title, href: `/explainers/${concept.id}` }, { label: "Book a tutor" }]}
      title={tutor ? `Book ${tutor.name}` : "Book a tutor"}
      description={
        tutor
          ? [
              concept.title,
              tutor.mastery ? `${MASTERY_WORDS[tutor.mastery]} on Ifiok` : null,
              `Free: ${tutor.availability}`,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
      width="form"
    >
      {tutor && tutor.priceCents && !tutor.isYou ? (
        <div className="grid gap-5">
          {proposal ? (
            <p className="rounded-[var(--radius-input)] bg-quantity-soft px-4 py-3 text-base">
              <span className="font-semibold">
                Drafted by Ifiok&apos;s tutoring agent, within your {proposal.limit} limit.
              </span>{" "}
              {proposal.reason} Change the time if you like; nothing is booked until you approve on PayPal.
            </p>
          ) : null}
          <BookTutor
            tutorId={tutor.tutorId}
            conceptId={concept.id}
            price={usd(tutor.priceCents)}
            minutes={cfg.session_minutes}
            startsAt={proposal?.startsAt ?? tomorrow.toISOString()}
            proposalId={proposal?.id ?? null}
          />
        </div>
      ) : (
        <EmptyState title="This tutor isn't taking bookings" body="Pick another tutor for this topic." />
      )}
    </AppPage>
  );
}
