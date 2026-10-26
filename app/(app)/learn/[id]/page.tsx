import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage, type Crumb } from "@/components/app/AppPage";
import { LessonMenuLazy } from "@/components/lesson/LessonMenuLazy";
import { Player, type LessonLink } from "@/components/lesson/Player";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getNextTopicInCourse, isFollowing } from "@/lib/courses/read";
import { getLesson, getLessonState } from "@/lib/lessons/service";
import type { GetLessonResult } from "@/lib/lessons/types";
import { createClient } from "@/lib/supabase/server";
import { LessonClient } from "./LessonClient";

export const metadata: Metadata = { title: "Learn", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ course?: string }>;
};

// A lesson (app-overhaul §5.6): a focused screen with no tab bar. The player, or the building,
// waiting and failed states, which swap to the lesson by themselves when it's ready.
export default async function LearnPage({ params, searchParams }: PageProps) {
  const viewer = await requireOnboardedPage();
  const [{ id }, { course: courseId }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const validCourseId = courseId && UUID.test(courseId) ? courseId : undefined;

  const [{ data: course }, { data: conceptRow }] = await Promise.all([
    validCourseId
      ? supabase.from("courses").select("id, code, title").eq("id", validCourseId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("concepts").select("id, title, subject, description").eq("id", id).maybeSingle(),
  ]);

  const back: LessonLink = course
    ? { href: `/courses/${course.id}`, label: `Back to ${course.code}` }
    : { href: "/courses", label: "Back to courses" };
  const trail = (title: string): Crumb[] => [
    { label: "Courses", href: "/courses" },
    ...(course ? [{ label: course.code, href: `/courses/${course.id}` }] : []),
    { label: title },
  ];

  // A lesson ID opens that exact version: superseded versions stay readable so progress keeps
  // its version (F2-FR6). RLS hides review lessons from students.
  const directLesson = conceptRow ? null : await getLesson(id);
  if (directLesson) {
    if (directLesson.status !== "published" && directLesson.status !== "superseded") notFound();
    return (
      <AppPage
        crumbs={trail(directLesson.spec.title)}
        title={directLesson.spec.title}
        description={directLesson.spec.objective}
        width="full"
      >
        <Player lesson={directLesson} back={back} />
      </AppPage>
    );
  }

  // Read-only: generation starts from the client's POST, never from rendering this page.
  if (!conceptRow) notFound();
  const [conceptResult, nextTopic, following] = await Promise.all([
    getLessonState(id, { viewer, courseId: course?.id ?? null }) as Promise<GetLessonResult>,
    course ? getNextTopicInCourse(course.id, id) : Promise.resolve(null),
    course ? Promise.resolve(false) : isFollowing(viewer, id),
  ]);

  const subjectCode = conceptRow.subject;
  const { data: subjectRow } = subjectCode
    ? await supabase.from("subjects").select("title").eq("code", subjectCode).maybeSingle()
    : { data: null };

  const title = conceptResult.status === "published" ? conceptResult.lesson.spec.title : conceptRow.title;
  const description =
    conceptResult.status === "published"
      ? conceptResult.lesson.spec.objective
      : (conceptRow.description ?? "A short interactive lesson with checkpoints.");
  const next: LessonLink | null =
    course && nextTopic
      ? { href: `/learn/${nextTopic.conceptId}?course=${course.id}`, label: `Next topic: ${nextTopic.title}` }
      : null;

  return (
    <AppPage
      crumbs={trail(title)}
      eyebrow={subjectRow?.title ?? subjectCode ?? undefined}
      title={title}
      description={description}
      headerActions={following ? <LessonMenuLazy conceptId={id} /> : null}
      width="full"
    >
      <LessonClient initialState={conceptResult} conceptId={id} courseId={course?.id} next={next} back={back} />
    </AppPage>
  );
}
