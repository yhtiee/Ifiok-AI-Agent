import type { Metadata } from "next";
import { AppPage, type Crumb } from "@/components/app/AppPage";
import { AddMaterialsFlow, type Destination } from "@/components/app/materials/AddMaterialsFlow";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getFollowedTopics, getMyCourses } from "@/lib/courses/read";

export const metadata: Metadata = { title: "Add materials", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Add materials (10 MVP-01, app-overhaul §5.7): the one place materials are added. ?course= or
// ?topic= preselects where they go (every "Add materials" button links here with one).
export default async function AddMaterialsPage({ searchParams }: PageProps<"/materials/add">) {
  const viewer = await requireOnboardedPage();
  const [courses, topics, params] = await Promise.all([getMyCourses(viewer), getFollowedTopics(viewer), searchParams]);

  const destinations: Destination[] = [
    ...courses.map((c) => ({
      kind: "course" as const,
      id: c.id,
      label: `${c.code} · ${c.title}`,
      detail: c.topics ? `${c.topics} ${c.topics === 1 ? "topic" : "topics"} in the outline` : "No outline yet",
    })),
    ...topics.map((t) => ({ kind: "topic" as const, id: t.id, label: t.title, detail: "Topic you follow" })),
  ];

  const param = (v: string | string[] | undefined) => (typeof v === "string" && UUID.test(v) ? v : null);
  const courseId = param(params.course);
  const topicId = param(params.topic);
  const initial = courseId ? `course:${courseId}` : topicId ? `topic:${topicId}` : null;

  // The phone back button returns to where the student came from.
  const course = courses.find((c) => c.id === courseId);
  const topic = topics.find((t) => t.id === topicId);
  const crumbs: Crumb[] = course
    ? [
        { label: "Courses", href: "/courses" },
        { label: course.code, href: `/courses/${course.id}` },
      ]
    : topic
      ? [
          { label: "Courses", href: "/courses" },
          { label: topic.title, href: `/learn/${topic.id}` },
        ]
      : [{ label: "Today", href: "/today" }];

  return (
    <AppPage
      crumbs={[...crumbs, { label: "Add materials" }]}
      title="Add materials"
      description="Lecture notes, textbook pages, past questions or a lab manual."
      width="full"
    >
      <AddMaterialsFlow destinations={destinations} initial={initial} />
    </AppPage>
  );
}
