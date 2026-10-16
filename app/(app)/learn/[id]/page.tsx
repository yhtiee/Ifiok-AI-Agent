import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppPage, type Crumb } from "@/components/app/AppPage";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getLesson, getLessonState } from "@/lib/lessons/service";
import type { GetLessonResult } from "@/lib/lessons/types";
import { createClient } from "@/lib/supabase/server";
import { Player } from "@/components/lesson/Player";
import { LessonClient } from "./LessonClient";

export const metadata: Metadata = { title: "Learn", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ course?: string }>;
};

export default async function LearnPage({ params, searchParams }: PageProps) {
  await requireOnboardedPage();
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

  // A lesson ID opens that exact version: superseded versions stay readable so progress keeps
  // its version (F2-FR6). RLS hides review lessons from students.
  const directLesson = conceptRow ? null : await getLesson(id);
  if (directLesson) {
    if (directLesson.status !== "published" && directLesson.status !== "superseded") notFound();
    const crumbs: Crumb[] = [
      { label: "Courses", href: "/courses" },
      ...(course ? [{ label: course.code, href: `/courses/${course.id}` }] : []),
      { label: directLesson.spec.title },
    ];

    return (
      <AppPage crumbs={crumbs} title={directLesson.spec.title} description={directLesson.spec.objective}>
        <Player lesson={directLesson} courseId={course?.id} />
      </AppPage>
    );
  }

  // Read-only: generation starts from the client's POST, never from rendering this page.
  if (!conceptRow) notFound();
  const conceptResult: GetLessonResult = await getLessonState(id);

  const subjectCode = conceptRow.subject;
  const { data: subjectRow } = subjectCode
    ? await supabase.from("subjects").select("title").eq("code", subjectCode).maybeSingle()
    : { data: null };

  const title = conceptResult.status === "published" ? conceptResult.lesson.spec.title : conceptRow.title;

  const description =
    conceptResult.status === "published"
      ? conceptResult.lesson.spec.objective
      : (conceptRow.description ?? "A short interactive lesson with checkpoints.");

  const crumbs: Crumb[] = [
    { label: "Courses", href: "/courses" },
    ...(course ? [{ label: course.code, href: `/courses/${course.id}` }] : []),
    { label: title },
  ];

  return (
    <AppPage
      crumbs={crumbs}
      eyebrow={subjectRow?.title ?? subjectCode ?? undefined}
      title={title}
      description={description}
    >
      <LessonClient initialState={conceptResult} conceptId={id} courseId={course?.id} />
    </AppPage>
  );
}
