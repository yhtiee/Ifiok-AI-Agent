// Today's "Next" block (app-overhaul §5.1, flow d), kept free of I/O so it is unit tested: the
// topic last worked on (server evidence, MVP-03) if it is still in the student's courses or topics
// ("Continue"), else the newest course's Next up (or its Set up step), else the newest topic.

export type TodayCourse = {
  id: string;
  code: string;
  title: string;
  topics: number;
  conceptIds: string[];
  next: { conceptId: string; title: string } | null;
};

export type TodayNext =
  | { kind: "course"; label: "Continue" | "Next up"; course: TodayCourse; conceptId: string; title: string }
  | { kind: "setup"; course: TodayCourse }
  | { kind: "done"; course: TodayCourse }
  | { kind: "topic"; label: "Continue" | "Next up"; conceptId: string; title: string };

/** Courses newest enrolment first, topics newest follow first; at least one of them is non-empty. */
export function pickNext(
  courses: TodayCourse[],
  topics: { id: string; title: string }[],
  stored: { kind: "course" | "topic"; courseId?: string; conceptId: string; title: string } | null,
): TodayNext {
  if (stored?.kind === "course" && stored.courseId) {
    const course = courses.find((c) => c.id === stored.courseId);
    if (course?.conceptIds.includes(stored.conceptId)) {
      return { kind: "course", label: "Continue", course, conceptId: stored.conceptId, title: stored.title };
    }
  }
  if (stored?.kind === "topic") {
    const topic = topics.find((t) => t.id === stored.conceptId);
    if (topic) return { kind: "topic", label: "Continue", conceptId: topic.id, title: topic.title };
  }
  const course = courses[0];
  if (course) {
    if (!course.topics) return { kind: "setup", course };
    if (!course.next) return { kind: "done", course };
    return { kind: "course", label: "Next up", course, conceptId: course.next.conceptId, title: course.next.title };
  }
  const topic = topics[0];
  if (!topic) throw new Error("pickNext needs at least one course or topic");
  return { kind: "topic", label: "Next up", conceptId: topic.id, title: topic.title };
}
