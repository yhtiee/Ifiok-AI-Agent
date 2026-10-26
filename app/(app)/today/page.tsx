import { APP_TIME_ZONE } from "@ifiok/core";
import type { Metadata } from "next";
import { AppPage } from "@/components/app/AppPage";
import { TodayLearning, type TodayCourse } from "@/components/app/today/TodayLearning";
import { requireOnboardedPage } from "@/lib/auth/guards";
import { greeting } from "@/lib/auth/names";
import { getCoursePath } from "@/lib/courses/path";
import { getCourseNextUps, getFollowedTopics, getMyCourses } from "@/lib/courses/read";
import { getLastStudied, getWeakAreas } from "@/lib/learning/progress";
import { masteryText } from "@/lib/courses/path-rules";
import { nextHref } from "@/lib/learning/weak-areas";
import { Row, RowList, SectionHeading } from "@/components/app/Page";
import { CalendarCheckIcon, WarningCircleIcon } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTodayStudy } from "@/lib/exam/service";
import { SESSION_WORDS, sessionHref } from "@/lib/exam/sessions";

export const metadata: Metadata = { title: "Today", robots: { index: false } };

// Today (app-overhaul §5.1): the greeting, one "Next" block that opens a lesson in one tap, and a
// short list of the student's courses and topics. Before they have any, one way in: find your
// course. Only what works today is shown (no plan, streak or setup checklist until they're live).
// MVP-03: "Continue" comes from server evidence, and the top 3 weak areas follow.
export default async function TodayPage() {
  const viewer = await requireOnboardedPage();
  const supabase = await createClient();
  const [courses, topics, { data: university }, lastStudied, weak, study] = await Promise.all([
    getMyCourses(viewer),
    getFollowedTopics(viewer),
    viewer.profile.university_id
      ? supabase.from("universities").select("name").eq("id", viewer.profile.university_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getLastStudied(viewer),
    getWeakAreas(viewer, 3),
    getTodayStudy(viewer),
  ]);
  const nextUps = await getCourseNextUps(
    viewer,
    courses.map((c) => c.id),
  );
  // The Path's lesson states for the newest course only (one call); the device may pick another
  // course it opened last, whose line then loads on the client.
  const newest = courses[0];
  const newestPath = newest && newest.topics ? await getCoursePath(viewer, newest.id) : null;

  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const todayCourses: TodayCourse[] = courses.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    topics: c.topics,
    conceptIds: nextUps.get(c.id)?.conceptIds ?? [],
    next: nextUps.get(c.id)?.next ?? null,
  }));

  return (
    <AppPage
      crumbs={[{ label: "Today" }]}
      eyebrow={date}
      title={<span data-testid="greeting">{greeting(viewer.profile.first_name)}</span>}
    >
      <TodayLearning
        lastStudied={lastStudied}
        courses={todayCourses}
        topics={topics.map((t) => ({ id: t.id, title: t.title }))}
        newestPath={newest && newestPath ? { courseId: newest.id, path: newestPath } : null}
        universityName={university?.name ?? null}
      />

      {study.length ? (
        <section aria-labelledby="study-today" className="mt-8 grid gap-3">
          <SectionHeading id="study-today">Study plan today</SectionHeading>
          <RowList labelledBy="study-today">
            {study.flatMap((c) =>
              c.sessions.map((s, i) => (
                <Row
                  key={`${c.courseId}-${i}`}
                  href={sessionHref(c.courseId, s)}
                  icon={<CalendarCheckIcon size={22} />}
                  tone="course"
                  title={`${SESSION_WORDS[s.kind]}: ${s.title}`}
                  meta={`${c.code} · exam in ${c.daysLeft} ${c.daysLeft === 1 ? "day" : "days"} · ${s.minutes} min`}
                />
              )),
            )}
          </RowList>
        </section>
      ) : null}

      {weak.length ? (
        <section aria-labelledby="weak-areas" className="mt-8 grid gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <SectionHeading id="weak-areas">Weak areas</SectionHeading>
            <Link href="/practice" className="text-sm font-semibold text-quantity hover:underline">
              All practice
            </Link>
          </div>
          <RowList labelledBy="weak-areas">
            {weak.map((w) => (
              <Row
                key={w.conceptId}
                href={nextHref(w)}
                icon={<WarningCircleIcon size={22} />}
                tone="add"
                title={w.title}
                meta={`${w.evidence} · ${masteryText(w.level, true)} · ${w.next.label}`}
              />
            ))}
          </RowList>
        </section>
      ) : null}
    </AppPage>
  );
}
