import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel } from "@/components/app/Page";
import { AppPage } from "@/components/app/AppPage";
import { JoinCourseButton } from "@/components/app/outline/JoinCourseButton";
import { OutlineHistory } from "@/components/app/outline/OutlineHistory";
import { OutlineWorkspace } from "@/components/app/outline/OutlineWorkspace";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getCourseView } from "@/lib/courses/read";

export const metadata: Metadata = { title: "Course", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Course home (07 §5.2). P1-01: the outline (set up three ways, edited wiki-style) and its
// history. The Path view, lessons and invites arrive with P1-02 and P1-03.
export default async function CoursePage({ params }: PageProps<"/courses/[id]">) {
  const viewer = await requireOnboardedPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const view = await getCourseView(viewer, id);
  if (!view) notFound();
  const { course, members, membership, topics, isDraft, revisions } = view;

  const meta = [
    `${members} ${members === 1 ? "classmate" : "classmates"}`,
    course.subject,
    course.level ? (course.level === 700 ? "Postgraduate" : `${course.level} level`) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppPage
      crumbs={[{ label: "Courses", href: "/courses" }, { label: course.code }]}
      eyebrow={course.university ?? undefined}
      title={`${course.code} · ${course.title}`}
      description={meta}
      actions={membership ? null : <JoinCourseButton courseId={course.id} />}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
        <OutlineWorkspace
          courseId={course.id}
          courseCode={course.code}
          isMember={Boolean(membership)}
          locked={course.locked}
          isDraft={isDraft}
          topics={topics}
        />

        {membership ? (
          <OutlineHistory courseId={course.id} revisions={revisions} />
        ) : (
          <Panel title="Join to take part">
            <p className="text-base text-ink-2">
              Members share one outline, fix it together and see its history. Joining is free and you can leave any
              time.
            </p>
          </Panel>
        )}
      </div>
    </AppPage>
  );
}
