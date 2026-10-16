import type { LessonSpec } from "@ifiok/core";

// The visible trust label on a shared lesson (F2-FR5). Kept apart from the pipeline so client
// components import it without pulling in the verifier (mathjs, KaTeX).

export function lessonLabel(lesson: {
  trust: "new" | "trusted";
  sources_used: number;
  spec: Pick<LessonSpec, "subject_profile">;
}): string {
  if (lesson.trust === "trusted") return "Trusted lesson";
  if (lesson.spec.subject_profile === "stem") return "New lesson. Checked by Ifiok's maths engine";
  if (lesson.sources_used > 0) {
    return `New lesson. Based on ${lesson.sources_used} source${lesson.sources_used === 1 ? "" : "s"}`;
  }
  return "General explanation (not from course material)";
}
