// Weak areas (10 MVP-03, F5): topics where the student is struggling, kept free of I/O so the
// ranking is unit tested. Evidence comes only from server-written attempts and mastery (guardrail 6).

export type MasteryLevel = "not_started" | "familiar" | "proficient" | "mastered";

export type TopicEvidence = {
  conceptId: string;
  title: string;
  m: number;
  level: MasteryLevel;
  /** Answers in the last 7 days. */
  right7: number;
  total7: number;
  /** Wrong answers in the last 14 days. */
  wrong14: number;
  /** The most frequent error tag in the last 14 days and its title, if any. */
  mistake: { title: string; count: number } | null;
  practice: number;
};

export type WeakArea = TopicEvidence & {
  evidence: string;
  next: { kind: "lesson" | "practice"; label: string };
};

/**
 * A topic is weak when it has been tried and is below Proficient, or has recent wrong answers.
 * Lowest mastery first; ties go to the topic with more recent wrong answers.
 */
export function rankWeakAreas(topics: TopicEvidence[], limit = 20): WeakArea[] {
  return topics
    .filter((t) => (t.total7 > 0 || t.wrong14 > 0) && (t.m < 0.6 || t.wrong14 > 0))
    .sort((a, b) => a.m - b.m || b.wrong14 - a.wrong14 || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((t) => ({ ...t, evidence: evidenceText(t), next: nextStep(t) }));
}

export function evidenceText(t: Pick<TopicEvidence, "right7" | "total7" | "wrong14">): string {
  if (t.total7 > 0) return `${t.right7} of ${t.total7} right this week`;
  return `${t.wrong14} wrong in the last two weeks`;
}

/** Mostly wrong (or no practice yet): back to the lesson. Otherwise: practise. */
export function nextStep(t: Pick<TopicEvidence, "right7" | "total7" | "practice">): WeakArea["next"] {
  const struggling = t.total7 >= 3 && t.right7 / t.total7 < 0.5;
  if (struggling || t.practice === 0) return { kind: "lesson", label: "Go through the lesson again" };
  return { kind: "practice", label: "Practise this topic" };
}

export const withCourse = (path: string, courseId: string | null) => (courseId ? `${path}?course=${courseId}` : path);

/** Where a weak area's next step goes: practice, or the lesson again. */
export const nextHref = (w: Pick<WeakArea, "conceptId" | "next"> & { courseId: string | null }) =>
  withCourse(w.next.kind === "practice" ? `/practice/${w.conceptId}` : `/learn/${w.conceptId}`, w.courseId);
