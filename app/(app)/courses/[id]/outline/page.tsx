import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AppPage } from "@/components/app/AppPage";
import { OutlineWorkspace } from "@/components/app/outline/OutlineWorkspace";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getCourseView } from "@/lib/courses/read";

export const metadata: Metadata = { title: "Course outline", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STARTS = ["upload", "typed", "draft"] as const;

// The course outline (F2-FR2, app-overhaul §5.5): edited wiki-style by the course's members, with
// its history. Moved here from the course page so that page can lead with the Path.
export default async function OutlinePage({ params, searchParams }: PageProps<"/courses/[id]/outline">) {
  const viewer = await requireOnboardedPage();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const view = await getCourseView(viewer, id);
  if (!view) notFound();
  if (!view.membership) redirect(`/courses/${id}`);
  const { course, topics, isDraft, revisions } = view;
  const start = STARTS.find((s) => s === query.start) ?? null;

  return (
    <AppPage
      crumbs={[
        { label: "Courses", href: "/courses" },
        { label: course.code, href: `/courses/${course.id}` },
        { label: "Outline" },
      ]}
      title={`${course.code} outline`}
      description="Shared by everyone in the course. Edits are saved as versions."
    >
      <OutlineWorkspace
        courseId={course.id}
        locked={course.locked}
        isDraft={isDraft}
        topics={topics.map((t) => ({ id: t.id, title: t.title, week: t.week, description: t.description }))}
        revisions={revisions}
        start={start}
      />
    </AppPage>
  );
}
