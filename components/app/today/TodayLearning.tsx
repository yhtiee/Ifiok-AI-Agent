"use client";

import { BooksIcon, TargetIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionBar, EmptyState, Panel, Row, RowList, SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonStateText, masteryText } from "@/lib/courses/path-rules";
import { pickNext, type TodayCourse, type TodayNext as Next } from "@/lib/learning/today";
import { coursePathQuery, type CoursePathData } from "@/lib/queries/courses";

// Today's Next block and "Your learning" list (app-overhaul §5.1, flow d). The Next block is the
// topic the student last worked on, from server evidence (MVP-03: a finished screen or an answer),
// else the newest course's Next up, else the newest topic. Its button is the screen's one camwood
// action.

type Props = {
  /** The topic last worked on, from the server (getLastStudied). */
  lastStudied: { conceptId: string; title: string; courseId: string | null } | null;
  courses: TodayCourse[];
  topics: { id: string; title: string }[];
  newestPath: { courseId: string; path: CoursePathData } | null;
  universityName: string | null;
};

const MAX_ROWS = 5;

const verbed = (verb: "Continue" | "Start", title: string) => `${verb} ${title.length > 28 ? "lesson" : title}`;

export type { TodayCourse };

export function TodayLearning({ lastStudied, courses, topics, newestPath, universityName }: Props) {
  const stored = lastStudied
    ? {
        kind: lastStudied.courseId ? ("course" as const) : ("topic" as const),
        ...lastStudied,
        courseId: lastStudied.courseId ?? undefined,
      }
    : null;

  if (!courses.length && !topics.length) return <StartState universityName={universityName} />;

  const next = pickNext(courses, topics, stored);
  const nextKey = next.kind === "topic" ? `topic:${next.conceptId}` : `course:${next.course.id}`;
  const rows = [
    ...courses.map((c) => ({ key: `course:${c.id}`, course: c })),
    ...topics.map((t) => ({ key: `topic:${t.id}`, topic: t })),
  ]
    .filter((r) => r.key !== nextKey)
    .slice(0, MAX_ROWS);

  return (
    <div className="grid gap-8">
      <NextBlock next={next} newestPath={newestPath} />

      {rows.length ? (
        <section aria-labelledby="your-learning" className="grid gap-3">
          <SectionHeading id="your-learning">Your learning</SectionHeading>
          <RowList labelledBy="your-learning">
            {rows.map((r) =>
              "course" in r && r.course ? (
                <Row
                  key={r.key}
                  href={`/courses/${r.course.id}`}
                  icon={<BooksIcon size={22} />}
                  tone="course"
                  title={`${r.course.code} · ${r.course.title}`}
                  meta={
                    r.course.next
                      ? `Next: ${r.course.next.title}`
                      : r.course.topics
                        ? `${r.course.topics} ${r.course.topics === 1 ? "topic" : "topics"}`
                        : "No outline yet"
                  }
                />
              ) : "topic" in r && r.topic ? (
                <Row
                  key={r.key}
                  href={`/learn/${r.topic.id}`}
                  icon={<TargetIcon size={22} />}
                  tone="topic"
                  title={r.topic.title}
                  meta="Topic"
                />
              ) : null,
            )}
          </RowList>
        </section>
      ) : null}

      {/* Quiet links, not a second camwood button: notes go in through /materials/add (owner, 12 §4 Q54). */}
      <p className="flex flex-wrap gap-x-6">
        <Link href="/materials/add" className={QUIET_LINK}>
          Add notes
        </Link>
        {rows.length ? (
          <Link href="/courses" className={QUIET_LINK}>
            All courses
          </Link>
        ) : null}
      </p>
    </div>
  );
}

const QUIET_LINK =
  "inline-flex min-h-11 items-center text-base text-ink-2 underline-offset-4 hover:text-ink hover:underline";

function NextBlock({ next, newestPath }: { next: Next; newestPath: Props["newestPath"] }) {
  const courseId = next.kind === "topic" ? null : next.course.id;
  const usesNewest = courseId !== null && newestPath?.courseId === courseId;
  // Another course than the newest: its lesson-state line loads here.
  const path = useQuery({ ...coursePathQuery(courseId ?? ""), enabled: next.kind === "course" && !usesNewest });
  const pathData = usesNewest ? newestPath!.path : path.data;

  let label: string;
  let title: string;
  let meta: ReactNode;
  let action: { href: string; text: string } | null;

  if (next.kind === "setup") {
    label = "Set up";
    title = `Add the ${next.course.code} outline`;
    meta = "Topics become your Path";
    action = { href: `/courses/${next.course.id}`, text: "Add outline" };
  } else if (next.kind === "done") {
    label = next.course.code;
    title = "Every topic is Proficient or better.";
    meta = null;
    action = null;
  } else if (next.kind === "topic") {
    label = next.label;
    title = next.title;
    meta = "Topic";
    action = {
      href: `/learn/${next.conceptId}`,
      text: verbed(next.label === "Continue" ? "Continue" : "Start", next.title),
    };
  } else {
    label = next.label;
    title = next.title;
    const topic = pathData?.topics.find((t) => t.conceptId === next.conceptId);
    meta = topic ? (
      `${next.course.code} · ${lessonStateText(topic)} · ${masteryText(topic.mastery, topic.tried)}`
    ) : pathData ? (
      next.course.code
    ) : (
      <Skeleton className="h-4 w-48" />
    );
    action = {
      href: `/learn/${next.conceptId}?course=${next.course.id}`,
      text: verbed(next.label === "Continue" ? "Continue" : "Start", next.title),
    };
  }

  return (
    <Panel>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid min-w-0 gap-0.5">
          <p className="text-sm text-ink-2">{label}</p>
          <p className="text-lg font-semibold [overflow-wrap:anywhere]">{title}</p>
          {meta ? <div className="text-sm text-ink-2">{meta}</div> : null}
        </div>
        {action ? (
          <ActionBar>
            <Button asChild>
              <Link href={action.href}>{action.text}</Link>
            </Button>
          </ActionBar>
        ) : next.kind === "done" ? (
          <Button asChild variant="outline">
            <Link href={`/courses/${next.course.id}`}>Open {next.course.code}</Link>
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function StartState({ universityName }: { universityName: string | null }) {
  return (
    <div className="grid gap-2">
      <EmptyState
        title="What are you studying?"
        body={
          universityName
            ? `Find your course at ${universityName} and Ifiok turns its outline into a path of lessons.`
            : "Type any topic and Ifiok builds a lesson you can move."
        }
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <ActionBar>
          <Button asChild>
            <Link href={universityName ? "/courses?focus=1" : "/courses?focus=1&mode=topic"}>
              {universityName ? "Find your course" : "Learn a topic"}
            </Link>
          </Button>
        </ActionBar>
        {universityName ? (
          <Link
            href="/courses?focus=1&mode=topic"
            className="inline-flex min-h-11 items-center text-base text-ink-2 underline-offset-4 hover:text-ink hover:underline"
          >
            Or learn a single topic
          </Link>
        ) : null}
      </div>
    </div>
  );
}
