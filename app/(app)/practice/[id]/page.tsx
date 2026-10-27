import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { PracticeSession } from "@/components/app/practice/PracticeSession";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getPracticeSet } from "@/lib/learning/progress";
import { explainerCounts } from "@/lib/contribute/explainers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Practice", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Practise one topic (10 MVP-03): up to 10 questions, untried and previously wrong ones first. The
// questions arrive without their answers; each answer is marked on the server.
export default async function PracticeTopicPage({ params, searchParams }: PageProps<"/practice/[id]">) {
  const viewer = await requireOnboardedPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const courseId = typeof query.course === "string" && UUID.test(query.course) ? query.course : null;

  const supabase = await createClient();
  const [{ data: concept }, { data: course }, questions] = await Promise.all([
    supabase.from("concepts").select("id, title").eq("id", id).maybeSingle(),
    courseId
      ? supabase.from("courses").select("id, code").eq("id", courseId).maybeSingle()
      : Promise.resolve({ data: null }),
    getPracticeSet(viewer, id),
  ]);
  const explained = (await explainerCounts([id])).get(id) ?? 0;
  if (!concept) notFound();

  const lessonHref = `/learn/${concept.id}${course ? `?course=${course.id}` : ""}`;
  return (
    <AppPage
      crumbs={[{ label: "Practice", href: "/practice" }, { label: concept.title }]}
      eyebrow="Practice"
      title={concept.title}
    >
      <PracticeSession
        key={questions.map((q) => q.id).join(",")}
        questions={questions}
        lessonHref={lessonHref}
        explainersHref={explained ? `/explainers/${id}` : null}
        back={
          course
            ? { href: `/courses/${course.id}`, label: `Back to ${course.code}` }
            : { href: "/practice", label: "Back to Practice" }
        }
      />
    </AppPage>
  );
}
