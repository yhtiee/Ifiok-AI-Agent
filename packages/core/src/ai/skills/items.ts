import { z } from "zod";
import { mcqOptionSchema } from "../../dsl/schema";
import {
  ITEM_SOLVE_PROMPT_VERSION,
  ITEM_SOLVE_SYSTEM,
  ITEMS_GENERATE_PROMPT_VERSION,
  ITEMS_GENERATE_SYSTEM,
} from "../prompts/items";
import { defineSkill } from "./types";

// items_generate and item_solve (04 §4.3, 05 §4). MVP-02 practice: MCQ and numeric only. Both are
// library work (they run inside the items_gen job, once per topic and lesson).

const common = {
  stem_md: z.string().trim().min(1).max(2000),
  difficulty: z.number().int().min(1).max(3),
  micro_skills: z.array(z.string().trim().min(1).max(60)).max(5).default([]),
  source_refs: z.array(z.number().int().positive()).max(6).default([]),
};

export const generatedItemSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("mcq"),
      ...common,
      options: z.array(mcqOptionSchema).min(3).max(5),
      correct: z.string().trim().min(1),
    })
    .refine((d) => d.options.some((o) => o.id === d.correct), {
      message: "correct must be one of the option ids",
      path: ["correct"],
    }),
  z.object({
    type: z.literal("numeric"),
    ...common,
    answer_expr: z.string().trim().min(1).max(300),
    stated: z.number(),
    unit: z.string().trim().max(30).optional(),
    tolerance: z.object({ rel: z.number().positive().optional(), abs: z.number().positive().optional() }).optional(),
    why: z.string().trim().min(1).max(2000),
  }),
]);
export type GeneratedItem = z.infer<typeof generatedItemSchema>;

export const itemsGenerateInput = z.object({
  concept: z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    subject: z.string(),
    level_band: z.string().nullable().optional(),
  }),
  /** The lesson's objective and key points, so practice matches what was taught. */
  lesson_summary: z.string().max(4000),
  chunks: z.array(z.object({ id: z.number(), content: z.string() })).default([]),
  count: z.number().int().min(1).max(20),
  numeric_allowed: z.boolean(),
});
export type ItemsGenerateInput = z.infer<typeof itemsGenerateInput>;

export const itemsGenerateOutput = z.object({ items: z.array(generatedItemSchema).min(1).max(20) });
export type ItemsGenerateOutput = z.infer<typeof itemsGenerateOutput>;

export const itemsGenerate = defineSkill({
  name: "items_generate",
  inputSchema: itemsGenerateInput,
  outputSchema: itemsGenerateOutput,
  promptVersion: ITEMS_GENERATE_PROMPT_VERSION,
  library: true,
  buildPrompt: (input) => ({
    system: ITEMS_GENERATE_SYSTEM,
    user: [
      `Topic: ${input.concept.title} (${input.concept.subject}${input.concept.level_band ? `, ${input.concept.level_band}` : ""})`,
      input.concept.description ? `About: ${input.concept.description}` : "",
      `What the lesson taught:\n${input.lesson_summary}`,
      `Write ${input.count} questions: about a third at each difficulty 1, 2 and 3.${
        input.numeric_allowed ? "" : " Use mcq only (this topic has no computable answers)."
      }`,
      input.chunks.length
        ? `Reference chunks:\n${input.chunks.map((c) => `<source id="${c.id}">\n${c.content}\n</source>`).join("\n\n")}`
        : "No reference chunks.",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
});

export const itemSolveInput = z.object({
  questions: z.array(
    z.object({
      index: z.number().int().min(0),
      type: z.enum(["mcq", "numeric"]),
      stem_md: z.string(),
      options: z.array(z.object({ id: z.string(), md: z.string() })).optional(),
      unit: z.string().optional(),
    }),
  ),
});
export type ItemSolveInput = z.infer<typeof itemSolveInput>;

export const itemSolveOutput = z.object({
  answers: z.array(
    z.object({
      index: z.number().int().min(0),
      option_id: z.string().optional(),
      answer_expr: z.string().max(300).optional(),
    }),
  ),
});
export type ItemSolveOutput = z.infer<typeof itemSolveOutput>;

export const itemSolve = defineSkill({
  name: "item_solve",
  inputSchema: itemSolveInput,
  outputSchema: itemSolveOutput,
  promptVersion: ITEM_SOLVE_PROMPT_VERSION,
  library: true,
  buildPrompt: (input) => ({
    system: ITEM_SOLVE_SYSTEM,
    user: input.questions
      .map((q) =>
        [
          `Question ${q.index} (${q.type}${q.unit ? `, answer in ${q.unit}` : ""}): ${q.stem_md}`,
          ...(q.options ?? []).map((o) => `  ${o.id}) ${o.md}`),
        ].join("\n"),
      )
      .join("\n\n"),
  }),
});
