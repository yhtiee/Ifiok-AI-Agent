import { BooksIcon, TargetIcon } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageBody, PageHeader, Panel } from "@/components/app/Page";
import { LearnSearch } from "@/components/app/LearnSearch";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { getFollowedTopics, getMyCourses } from "@/lib/courses/read";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Courses", robots: { index: false } };

// Courses (07 §4, §5.1b): search first, then the student's courses and followed topics.
export default async function CoursesPage() {
  const viewer = await requireOnboardedPage();
  const supabase = await createClient();
  const [courses, topics, { data: university }] = await Promise.all([
    getMyCourses(viewer),
    getFollowedTopics(viewer),
    viewer.profile.university_id
      ? supabase.from("universities").select("name").eq("id", viewer.profile.university_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <PageBody>
      <PageHeader
        title="Courses"
        description="Find your course or any topic, and Ifiok builds the lessons around it."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
        <div className="grid content-start gap-4 lg:gap-6">
          <section
            aria-label="Search"
            className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5"
          >
            <LearnSearch universityName={university?.name ?? null} myCourseIds={courses.map((c) => c.id)} />
          </section>

          <Panel title="Your courses">
            {courses.length ? (
              <ul className="grid divide-y divide-line">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/courses/${c.id}`} className="flex min-h-14 items-center gap-3 py-3 hover:underline">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-quantity-soft text-quantity"
                      >
                        <BooksIcon size={22} />
                      </span>
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-base font-semibold">
                          {c.code} · {c.title}
                        </span>
                        <span className="text-sm text-ink-2">
                          {c.topics ? `${c.topics} ${c.topics === 1 ? "topic" : "topics"}` : "No outline yet: add it"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No courses yet"
                body="Search for your course above. If nobody has added it yet, add it: it takes a minute, and classmates can join you."
              />
            )}
          </Panel>
        </div>

        <Panel title="Topics you follow">
          {topics.length ? (
            <ul className="grid divide-y divide-line">
              {topics.map((t) => (
                <li key={t.id} className="flex min-h-14 items-start gap-3 py-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-built-soft text-built"
                  >
                    <TargetIcon size={22} />
                  </span>
                  <span className="grid gap-0.5">
                    <span className="text-base font-semibold">{t.title}</span>
                    {t.description ? <span className="text-sm text-ink-2">{t.description}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base text-ink-2">
              Learning something outside a course? Type it in the search, like “Fourier series”, and follow it.
            </p>
          )}
        </Panel>
      </div>
    </PageBody>
  );
}
