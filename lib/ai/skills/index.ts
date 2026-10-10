import type { SkillName } from "../types";
import { outlineDraft, schemeExtract, topicResolve } from "./courses";
import { moderate } from "./moderate";
import type { SkillDefinition } from "./types";

// Skill registry (04 §4). Each ticket adds its skills here: P1-01 topic_resolve and
// outline_draft, P1-02 lesson_generate, P1-07 tutor_chat, and so on.
export const SKILL_REGISTRY: Partial<Record<SkillName, SkillDefinition>> = {
  moderate: moderate as SkillDefinition,
  topic_resolve: topicResolve as SkillDefinition,
  outline_draft: outlineDraft as SkillDefinition,
  scheme_extract: schemeExtract as SkillDefinition,
};

/** Skills that spend the library generation budget rather than the per-learner cap (04 §5). */
export const LIBRARY_SKILLS: readonly SkillName[] = [
  "lesson_generate",
  "lesson_repair",
  "items_generate",
  "outline_draft",
];
