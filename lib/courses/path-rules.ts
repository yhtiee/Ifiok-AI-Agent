// The course Path (F5-FR6, 07 §5.2, 10 MVP-02): rules kept free of I/O so they are unit tested.

export type MasteryLevel = "not_started" | "familiar" | "proficient" | "mastered";
export type LessonState = "ready" | "building" | "not_started";

export type PathTopic = {
  topicId: string;
  title: string;
  week: number | null;
  conceptId: string | null;
  lesson: LessonState;
  /** The student's own lesson from their materials is ready. */
  fromNotes: boolean;
  /** Their materials cover the topic (a lesson from them is built or on the way). */
  covered: boolean;
  mastery: MasteryLevel;
  /** The student has answered at least one question on it. */
  tried: boolean;
  /** Published practice questions the student can use (shared and their own). */
  practice: number;
  /** Approved student explainers for the topic (F18, MVP-06). */
  explainers: number;
};

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  not_started: "Not started",
  familiar: "Familiar",
  proficient: "Proficient",
  mastered: "Mastered",
};

/**
 * The level in words. A topic the student has tried but is still below Familiar reads
 * "Getting started", not "Not started" (owner decision, 12 §4 Q54); the stored level is unchanged.
 */
export function masteryText(level: MasteryLevel, tried: boolean): string {
  return level === "not_started" && tried ? "Getting started" : MASTERY_LABELS[level];
}

/** "Next up": the first topic in outline order that isn't Proficient yet (and can be opened). */
export function nextUp(topics: readonly PathTopic[]): PathTopic | null {
  return topics.find((t) => t.conceptId && t.mastery !== "proficient" && t.mastery !== "mastered") ?? null;
}

export function lessonStateText(t: Pick<PathTopic, "lesson" | "fromNotes" | "covered">): string {
  if (t.lesson === "building") return t.covered ? "Building from your notes" : "Lesson building";
  if (t.lesson === "ready") return t.fromNotes ? "Lesson from your notes" : "Lesson ready";
  return t.covered ? "Built from your notes on first open" : "Built on first open";
}
