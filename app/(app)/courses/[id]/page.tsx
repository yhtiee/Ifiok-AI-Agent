import { LockSimpleIcon, TargetIcon } from "@phosphor-icons/react/ssr";
import { ExamPrepPanel, type ExamPrepView } from "@/components/app/exam/ExamPrepPanel";
import { patternText } from "@/lib/exam/patterns";
import { getExamPrep } from "@/lib/exam/service";
import { getLabs } from "@/lib/labs/service";
import { LabsPanel } from "@/components/app/labs/LabsPanel";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ActionBar, EmptyState, Row, RowList } from "@/components/app/Page";
import { AppPage } from "@/components/app/AppPage";
import { CourseMenu } from "@/components/app/course/CourseMenu";
import { CourseTabs } from "@/components/app/course/CourseTabs";
import { CourseSetup } from "@/components/app/course/CourseSetup";
import { MaterialsList } from "@/components/app/materials/MaterialsList";
import { JoinCourseButton } from "@/components/app/outline/JoinCourseButton";
import { CoursePath } from "@/components/app/path/CoursePath";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getCoursePath } from "@/lib/courses/path";
import { getCourseView } from "@/lib/courses/read";

export const metadata: Metadata = { title: "Course", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const quietLink =
  "inline-flex min-h-11 items-center text-base text-ink-2 underline-offset-4 hover:text-ink hover:underline";

// Course home (07 §5.2, app-overhaul §5.4). Members with an outline get two tabs: the Path (Next up
// and the topics in order) and their Materials. Before the outline exists, the one job is adding it;
// visitors see the topics (anyone can learn them) and can join. The outline itself is edited on
// /courses/[id]/outline.
export default async function CoursePage({ params, searchParams }: PageProps<"/courses/[id]">) {
  const viewer = await requireOnboardedPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const view = await getCourseView(viewer, id);
  if (!view) notFound();
  const { course, members, membership, topics, isDraft } = view;
  const path = membership && topics.length ? await getCoursePath(viewer, course.id) : null;
  const [exam, labs] = path
    ? await Promise.all([getExamPrep(viewer, course.id), getLabs(viewer, course.id)])
    : [null, null];

  const meta = [
    course.university,
    `${members} ${members === 1 ? "classmate" : "classmates"}`,
    course.level ? (course.level === 700 ? "Postgraduate" : `${course.level} level`) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const page = (children: ReactNode) => (
    <AppPage
      crumbs={[{ label: "Courses", href: "/courses" }, { label: course.code }]}
      title={`${course.code} · ${course.title}`}
      description={meta}
      actions={membership ? <CourseMenu courseId={course.id} locked={course.locked} /> : null}
    >
      {children}
    </AppPage>
  );

  if (!membership) {
    return page(
      <div className="grid gap-5">
        <p className="max-w-[60ch] text-base text-ink-2">Join to add materials and help keep the outline right.</p>
        {topics.length ? (
          <RowList label="Topics in this course">
            {topics.map((t, i) =>
              t.conceptId ? (
                <Row
                  key={t.id}
                  href={`/learn/${t.conceptId}?course=${course.id}`}
                  icon={<TargetIcon size={22} />}
                  tone="topic"
                  title={t.title}
                  meta={t.week ? `Week ${t.week}` : `Topic ${i + 1}`}
                />
              ) : (
                <Row key={t.id} title={t.title} meta={t.week ? `Week ${t.week}` : `Topic ${i + 1}`} />
              ),
            )}
          </RowList>
        ) : (
          <EmptyState title="No outline yet" body="Join the course to add its outline. It takes a minute." />
        )}
        <ActionBar>
          <JoinCourseButton courseId={course.id} />
        </ActionBar>
      </div>,
    );
  }

  const materials = <MaterialsList scope={{ courseId: course.id }} addHref={`/materials/add?course=${course.id}`} />;

  if (!path) {
    // No outline yet: setting it up is the one job. Materials added before the outline (the
    // redirect after adding asks for ?tab=materials) still have a tab to land on.
    const setup = course.locked ? <LockedNote /> : <CourseSetup courseId={course.id} />;
    if (query.tab !== "materials") return page(setup);
    return page(<CourseTabs courseId={course.id} initial="materials" path={setup} materials={materials} />);
  }

  const notes =
    isDraft || course.locked ? (
      <>
        {isDraft ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-input)] border border-dashed border-change px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-2 text-base">
              <Badge variant="draft">Draft</Badge> Check it against your course.
            </p>
            <Button asChild variant="outline" size="sm" className="self-start sm:self-auto">
              <Link href={`/courses/${course.id}/outline`}>Check outline</Link>
            </Button>
          </div>
        ) : null}
        {course.locked ? <LockedNote /> : null}
      </>
    ) : null;

  return page(
    <CourseTabs
      courseId={course.id}
      initial={query.tab === "materials" || query.tab === "exam" || query.tab === "labs" ? query.tab : "path"}
      path={
        <CoursePath
          courseId={course.id}
          initial={path}
          notes={notes}
          footer={
            course.locked ? null : (
              <Link href={`/courses/${course.id}/outline`} className={quietLink}>
                Topics wrong or missing? Edit the outline
              </Link>
            )
          }
        />
      }
      materials={materials}
      exam={exam ? <ExamPrepPanel view={examView(course.id, exam)} /> : undefined}
      labs={labs ? <LabsPanel view={labs} courseId={course.id} /> : undefined}
    />,
  );
}

/** The Exam prep tab's data: topic titles with their counts and shares (never predictions). */
function examView(courseId: string, exam: Awaited<ReturnType<typeof getExamPrep>>): ExamPrepView {
  const titles = new Map(exam.topics.map((t) => [t.conceptId, t.title]));
  return {
    courseId,
    papers: exam.patterns.papers,
    weighted: exam.patterns.weighted,
    questions: exam.questions.length,
    unassigned: exam.patterns.unassigned,
    pending: exam.pending,
    topics: exam.patterns.topics.map((t) => ({
      conceptId: t.conceptId,
      title: titles.get(t.conceptId) ?? "Topic",
      text: patternText(t, exam.patterns.papers),
    })),
    plan: exam.plan ? { examDate: exam.plan.examDate, days: exam.plan.days, overflow: exam.plan.overflow } : null,
  };
}

function LockedNote() {
  return (
    <p className="flex items-center gap-2 text-base text-ink-2">
      <LockSimpleIcon size={20} aria-hidden="true" /> Outline locked by your lecturer.
    </p>
  );
}
