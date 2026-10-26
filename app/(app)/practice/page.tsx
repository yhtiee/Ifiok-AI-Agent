import { ExamIcon, FlaskIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { AppPage } from "@/components/app/AppPage";
import { ActionBar, EmptyState, Row, RowList, SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { masteryText } from "@/lib/courses/path-rules";
import { getPracticeTopics, getWeakAreas } from "@/lib/learning/progress";
import { nextHref, withCourse } from "@/lib/learning/weak-areas";
import { getLabs } from "@/lib/labs/service";

export const metadata: Metadata = { title: "Practice", robots: { index: false } };

// Practice (10 MVP-03): Weak areas first (low mastery and recent mistakes, with the evidence, the
// most common mistake and one next step), then every topic with practice questions. Built only from
// server-recorded answers (guardrail 6). The one camwood action is the weakest topic's next step.
// On phones a link leads to Labs (desktop has it in the sidebar; 12 §4 Q56).
export default async function PracticePage() {
  const viewer = await requireOnboardedPage();
  const [weak, topics, labs] = await Promise.all([getWeakAreas(viewer), getPracticeTopics(viewer), getLabs(viewer)]);
  const top = weak[0];

  return (
    <AppPage crumbs={[{ label: "Practice" }]} title="Practice">
      <div className="grid gap-10 xl:grid-cols-2 xl:gap-16">
        <section aria-labelledby="weak-areas" className="grid content-start gap-3">
          <SectionHeading id="weak-areas">Weak areas</SectionHeading>
          {weak.length ? (
            <RowList labelledBy="weak-areas">
              {weak.map((w) => (
                <Row
                  key={w.conceptId}
                  href={nextHref(w)}
                  icon={<WarningCircleIcon size={22} />}
                  tone="add"
                  title={w.title}
                  meta={
                    <>
                      {w.evidence} · {masteryText(w.level, true)}
                      {w.mistake ? <> · Most common mistake: {w.mistake.title}</> : null}
                      <span className="block text-quantity">{w.next.label}</span>
                    </>
                  }
                />
              ))}
            </RowList>
          ) : (
            <EmptyState
              title="No weak areas yet"
              body="Answer the questions in your lessons and practice. Topics you're finding hard show up here, with what to do next."
            />
          )}
        </section>

        <section aria-labelledby="practise-topic" className="grid content-start gap-3">
          <SectionHeading id="practise-topic">Practise a topic</SectionHeading>
          {topics.length ? (
            <RowList labelledBy="practise-topic">
              {topics.map((t) => (
                <Row
                  key={t.conceptId}
                  href={withCourse(`/practice/${t.conceptId}`, t.courseId)}
                  icon={<ExamIcon size={22} />}
                  tone="topic"
                  title={t.title}
                  meta={`${t.count} ${t.count === 1 ? "question" : "questions"}`}
                />
              ))}
            </RowList>
          ) : (
            <p className="text-base text-ink-2">
              Practice questions are written for a topic once its lesson is ready.{" "}
              <Link href="/courses" className="font-semibold text-quantity hover:underline">
                Open a lesson
              </Link>
            </p>
          )}
        </section>
      </div>

      <div className="mt-10 lg:hidden">
        <RowList label="Labs">
          <Row
            href="/labs"
            icon={<FlaskIcon size={22} />}
            tone="topic"
            title="Labs"
            meta={(() => {
              const n = labs.labs.filter((l) => l.status === "ready").length;
              return n
                ? `${n} ${n === 1 ? "lab" : "labs"} · request a practical`
                : "Virtual practicals: request one by name";
            })()}
          />
        </RowList>
      </div>

      {top ? (
        <ActionBar>
          <Button asChild>
            <Link href={nextHref(top)}>
              {top.next.kind === "practice" ? "Practise" : "Revisit"}{" "}
              {top.title.length > 26 ? "your weakest topic" : top.title}
            </Link>
          </Button>
        </ActionBar>
      ) : null}
    </AppPage>
  );
}
