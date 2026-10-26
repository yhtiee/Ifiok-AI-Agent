import { BooksIcon, TargetIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { Row, RowList, SectionHeading } from "@/components/app/Page";
import { AppPage } from "@/components/app/AppPage";
import { LearnSearch } from "@/components/app/LearnSearch";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getFollowedTopics, getMyCourses } from "@/lib/courses/read";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Courses", robots: { index: false } };

// Courses (app-overhaul §5.2): the search is the action, then the student's courses and followed
// topics as plain lists (hidden while empty).
export default async function CoursesPage({ searchParams }: PageProps<"/courses">) {
  const viewer = await requireOnboardedPage();
  const supabase = await createClient();
  const [courses, topics, { data: university }, params] = await Promise.all([
    getMyCourses(viewer),
    getFollowedTopics(viewer),
    viewer.profile.university_id
      ? supabase.from("universities").select("name").eq("id", viewer.profile.university_id).maybeSingle()
      : Promise.resolve({ data: null }),
    searchParams,
  ]);

  return (
    <AppPage crumbs={[{ label: "Courses" }]} title="Courses">
      <div className="grid gap-8">
        <LearnSearch
          universityName={university?.name ?? null}
          myCourseIds={courses.map((c) => c.id)}
          focusOnOpen={params.focus === "1"}
          topicMode={params.mode === "topic"}
        />

        {courses.length || topics.length ? (
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
            {courses.length ? (
              <section aria-labelledby="your-courses" className="grid content-start gap-3">
                <SectionHeading id="your-courses">Your courses</SectionHeading>
                <RowList labelledBy="your-courses">
                  {courses.map((c) => (
                    <Row
                      key={c.id}
                      href={`/courses/${c.id}`}
                      icon={<BooksIcon size={22} />}
                      tone="course"
                      title={`${c.code} · ${c.title}`}
                      meta={c.topics ? `${c.topics} ${c.topics === 1 ? "topic" : "topics"}` : "No outline yet"}
                    />
                  ))}
                </RowList>
              </section>
            ) : null}
            {topics.length ? (
              <section aria-labelledby="your-topics" className="grid content-start gap-3">
                <SectionHeading id="your-topics">Topics you follow</SectionHeading>
                <RowList labelledBy="your-topics">
                  {topics.map((t) => (
                    <Row
                      key={t.id}
                      href={`/learn/${t.id}`}
                      icon={<TargetIcon size={22} />}
                      tone="topic"
                      title={t.title}
                      meta={t.description ?? "Topic"}
                    />
                  ))}
                </RowList>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppPage>
  );
}
