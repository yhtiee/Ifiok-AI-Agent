import type { Database, Json } from "../db/types";
import type { GeneratedItem, ItemSolveInput, ItemSolveOutput } from "../ai/skills/items";
import { numericMatches } from "../dsl/numeric";
import { mathEvaluate } from "../verify/tools";

// The two checks before a generated practice item can be published (05 §4, 10 MVP-02):
// 1. self-consistency: the engine's value of answer_expr must equal the stated answer;
// 2. an independent solve (item_solve, without the answer) must agree.
// Anything that fails either check is dropped: students never see it.

export type DroppedItem = { index: number; reason: string };

const fix = (e: string) => e.replace(/\*\*/g, "^");

/** The engine's value of a numeric item's answer_expr, or null if it can't be evaluated safely. */
export function engineValue(answerExpr: string): number | null {
  try {
    return mathEvaluate(fix(answerExpr));
  } catch {
    return null;
  }
}

export function selfConsistent(item: GeneratedItem): boolean {
  if (item.type !== "numeric") return true;
  const value = engineValue(item.answer_expr);
  return value !== null && numericMatches(value, item.stated, item.tolerance);
}

/** The questions as the solver sees them: no answers, no explanations. */
export function solveQuestions(items: GeneratedItem[]): ItemSolveInput["questions"] {
  return items.map((item, index) =>
    item.type === "mcq"
      ? { index, type: "mcq", stem_md: item.stem_md, options: item.options.map((o) => ({ id: o.id, md: o.md })) }
      : { index, type: "numeric", stem_md: item.stem_md, ...(item.unit ? { unit: item.unit } : {}) },
  );
}

/** Items that pass both checks, plus why each other one was dropped. Duplicated stems are dropped too. */
export function checkItems(
  items: GeneratedItem[],
  solved: ItemSolveOutput["answers"],
): { accepted: GeneratedItem[]; dropped: DroppedItem[] } {
  const answers = new Map(solved.map((a) => [a.index, a]));
  const seen = new Set<string>();
  const accepted: GeneratedItem[] = [];
  const dropped: DroppedItem[] = [];

  items.forEach((item, index) => {
    const stemKey = item.stem_md.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(stemKey)) return dropped.push({ index, reason: "duplicate" });
    if (!selfConsistent(item)) return dropped.push({ index, reason: "self_consistency" });
    const answer = answers.get(index);
    if (!answer) return dropped.push({ index, reason: "unsolved" });
    if (item.type === "mcq") {
      if (answer.option_id !== item.correct) return dropped.push({ index, reason: "solve_disagrees" });
    } else {
      const solvedValue = answer.answer_expr ? engineValue(answer.answer_expr) : null;
      if (solvedValue === null || !numericMatches(solvedValue, item.stated, item.tolerance)) {
        return dropped.push({ index, reason: "solve_disagrees" });
      }
    }
    seen.add(stemKey);
    accepted.push(item);
  });
  return { accepted, dropped };
}

type ItemInsert = Database["public"]["Tables"]["items"]["Insert"];

/** Checked items as `items` rows: published, owned by the student when grounded in their materials. */
export function itemRows(
  items: GeneratedItem[],
  ctx: { conceptId: string; ownerId: string | null; courseId: string | null },
): ItemInsert[] {
  return items.map((item) => {
    const base = {
      concept_id: ctx.conceptId,
      owner_id: ctx.ownerId,
      course_id: ctx.courseId,
      difficulty: item.difficulty,
      micro_skills: item.micro_skills,
      origin: "generated",
      status: "published",
    } as const;
    if (item.type === "mcq") {
      return {
        ...base,
        type: "mcq",
        stem: { prompt: item.stem_md, options: item.options.map((o) => ({ id: o.id, text: o.md })) } as Json,
        answer: {
          correct_option_id: item.correct,
          feedback: Object.fromEntries(item.options.map((o) => [o.id, o.why])),
          source_refs: item.source_refs,
        } as Json,
        verification: { type: "mcq", checks: ["independent_solve"] } as Json,
      };
    }
    return {
      ...base,
      type: "numeric",
      stem: { prompt: item.stem_md, ...(item.unit ? { unit: item.unit } : {}) } as Json,
      answer: {
        expected: item.stated,
        answer_expr: fix(item.answer_expr),
        why: item.why,
        source_refs: item.source_refs,
      } as Json,
      verification: {
        type: "numeric",
        answer_expr: fix(item.answer_expr),
        stated: item.stated,
        tolerance: item.tolerance ?? null,
        checks: ["self_consistency", "independent_solve"],
      } as Json,
    };
  });
}
