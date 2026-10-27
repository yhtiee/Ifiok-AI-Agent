import type { SkillName } from "../types";
import { claimCheck } from "./claim-check";
import { outlineDraft, schemeExtract, topicResolve } from "./courses";
import { curateClassify, explainerFrames, explainerReview } from "./contribute";
import { examClassify, examExtract, workedSolution } from "./exam";
import { explainError } from "./explain-error";
import { labExtract } from "./labs";
import { itemSolve, itemsGenerate } from "./items";
import { lessonGenerate } from "./lesson-generate";
import { lessonRepair } from "./lesson-repair";
import { moderate } from "./moderate";
import type { SkillDefinition } from "./types";

// Skill registry (04 §4). Each ticket adds its skills here: P1-01 topic_resolve and
// outline_draft, P1-02 lesson_generate, P1-07 tutor_chat, and so on.
export const SKILL_REGISTRY: Partial<Record<SkillName, SkillDefinition>> = {
  moderate: moderate as SkillDefinition,
  topic_resolve: topicResolve as SkillDefinition,
  outline_draft: outlineDraft as SkillDefinition,
  scheme_extract: schemeExtract as SkillDefinition,
  lesson_generate: lessonGenerate as unknown as SkillDefinition,
  claim_check: claimCheck as unknown as SkillDefinition,
  lesson_repair: lessonRepair as unknown as SkillDefinition,
  items_generate: itemsGenerate as unknown as SkillDefinition,
  item_solve: itemSolve as unknown as SkillDefinition,
  explain_error: explainError as unknown as SkillDefinition,
  exam_extract: examExtract as unknown as SkillDefinition,
  exam_classify: examClassify as unknown as SkillDefinition,
  worked_solution: workedSolution as unknown as SkillDefinition,
  lab_extract: labExtract as unknown as SkillDefinition,
  curate_classify: curateClassify as unknown as SkillDefinition,
  explainer_review: explainerReview as unknown as SkillDefinition,
  explainer_frames: explainerFrames as unknown as SkillDefinition,
};

/** Skills that spend the library generation budget rather than the per-learner cap (04 §5). */
export const LIBRARY_SKILLS: readonly SkillName[] = [
  "lesson_generate",
  "lesson_repair",
  "claim_check",
  "items_generate",
  "item_solve",
  "exam_extract",
  "exam_classify",
  "outline_draft",
  "curate_classify",
];
