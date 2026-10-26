import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { EmptyState, SectionHeading } from "@/components/app/Page";
import { SolutionReveal } from "@/components/app/exam/WorkedSolution";
import { MathHtmlProvider, RichText } from "@/components/lesson/RichText";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { mathHtmlFor } from "@/lib/exam/math";
import { patternText } from "@/lib/exam/patterns";
import { getExamPrep, type ExamQuestionView } from "@/lib/exam/service";

export const metadata: Metadata = { title: "Past questions", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QTYPE: Record<string, string> = {
  calc: "Calculation",
  theory: "Explain or discuss",
  definition: "Definition",
  proof: "Proof",
  diagram: "Diagram",
  mcq: "Multiple choice",
};

const label = (q: ExamQuestionView) =>
  [
    q.year,
    q.number ? `Q${q.number}${q.sub ?? ""}` : null,
    q.marks !== null ? `${q.marks} marks` : null,
    q.qtype ? QTYPE[q.qtype] : null,
  ]
    .filter(Boolean)
    .join(" · ");

// Past questions grouped by topic, in outline order, with each topic's counts and share of marks and
// a worked solution per question (10 MVP-04). Never predictions (guardrail 13).
export default async function ExamQuestionsPage({ params }: PageProps<"/courses/[id]/exam/questions">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const prep = await getExamPrep(viewer, id).catch(() => null);
  if (!prep) notFound();

  const pattern = new Map(prep.patterns.topics.map((t) => [t.conceptId, t]));
  const groups = [
    ...prep.topics.map((t) => ({
      id: t.conceptId,
      title: t.title,
      questions: prep.questions.filter((q) => q.conceptId === t.conceptId),
    })),
    { id: "unassigned", title: "Not matched to a topic", questions: prep.questions.filter((q) => !q.conceptId) },
  ].filter((g) => g.questions.length);
  const math = mathHtmlFor(prep.questions.map((q) => q.text));

  return (
    <AppPage
      crumbs={[
        { label: "Courses", href: "/courses" },
        { label: prep.course.code, href: `/courses/${id}?tab=exam` },
        { label: "Past questions" },
      ]}
      title="Past questions"
      description={`${prep.questions.length} questions from ${prep.patterns.papers} ${prep.patterns.papers === 1 ? "paper" : "papers"}, by topic.`}
    >
      {groups.length ? (
        <MathHtmlProvider value={math}>
          <div className="grid max-w-4xl grid-cols-1 gap-10">
            {groups.map((g) => {
              const p = pattern.get(g.id);
              return (
                <section
                  key={g.id}
                  id={`topic-${g.id}`}
                  aria-labelledby={`h-${g.id}`}
                  className="grid scroll-mt-24 grid-cols-1 gap-4"
                >
                  <div>
                    <SectionHeading id={`h-${g.id}`}>{g.title}</SectionHeading>
                    {p ? <p className="text-sm text-ink-2">{patternText(p, prep.patterns.papers)}</p> : null}
                  </div>
                  <ol className="grid grid-cols-1 gap-6">
                    {g.questions.map((q) => (
                      <li key={q.id} className="grid grid-cols-1 gap-3 border-t border-line pt-4">
                        <p className="text-sm text-ink-2">{label(q)}</p>
                        <p className="text-base leading-relaxed whitespace-pre-line">
                          <RichText text={q.text} />
                        </p>
                        <SolutionReveal questionId={q.id} />
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        </MathHtmlProvider>
      ) : (
        <EmptyState
          title="No past questions yet"
          body="Add past questions from the course's Exam prep tab. They show here, by topic, once you've checked them."
        />
      )}
    </AppPage>
  );
}
