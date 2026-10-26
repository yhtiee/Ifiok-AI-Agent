import type { Session, SessionKind } from "@/lib/agent/planner";

// Words and links for study-plan sessions, shared by the plan page, the Exam prep tab and Today.

export const SESSION_WORDS: Record<SessionKind, string> = {
  lesson: "Lesson",
  practice: "Practice",
  past_questions: "Past questions",
  paper: "Practice paper",
};

export function sessionHref(courseId: string, s: Pick<Session, "kind" | "conceptId">): string {
  if (s.kind === "paper" || !s.conceptId) return `/courses/${courseId}/exam/paper`;
  if (s.kind === "practice") return `/practice/${s.conceptId}?course=${courseId}`;
  if (s.kind === "past_questions") return `/courses/${courseId}/exam/questions#topic-${s.conceptId}`;
  return `/learn/${s.conceptId}?course=${courseId}`;
}
