import { z } from "zod";
import {
  EXAM_CLASSIFY_PROMPT_VERSION,
  EXAM_CLASSIFY_SYSTEM,
  EXAM_EXTRACT_PROMPT_VERSION,
  EXAM_EXTRACT_SYSTEM,
  WORKED_SOLUTION_PROMPT_VERSION,
  WORKED_SOLUTION_SYSTEM,
} from "../prompts/exam";
import { restoreLatexBackslashes } from "../json";
import { defineSkill } from "./types";

// Exam prep skills (04 §4.6, 10 MVP-04). exam_extract and exam_classify run in the exam_extract job
// and their output is always reviewed by the student before it is saved. worked_solution runs when
// a student first asks for a question's solution; the result is shared within the course.

export const QTYPES = ["calc", "theory", "definition", "proof", "diagram", "mcq"] as const;

export const examExtractInput = z.object({
  course: z.object({ code: z.string(), title: z.string() }),
  text: z.string().min(1).max(40_000),
});

export const extractedQuestionSchema = z.object({
  number: z.string().trim().min(1).max(20),
  sub: z.string().trim().max(20).nullable().default(null),
  text: z.string().trim().min(1).max(4000),
  marks: z.number().min(0).max(200).nullable().default(null),
  qtype: z.enum(QTYPES).catch("theory"),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;

export const examExtractOutput = z.object({
  year: z.number().int().min(1950).max(2100).nullable().catch(null),
  instructions: z.string().trim().max(500).nullable().catch(null),
  questions: z.array(extractedQuestionSchema).max(80),
});
export type ExamExtractOutput = z.infer<typeof examExtractOutput>;

export const examExtract = defineSkill({
  name: "exam_extract",
  inputSchema: examExtractInput,
  outputSchema: examExtractOutput,
  promptVersion: EXAM_EXTRACT_PROMPT_VERSION,
  // Once per uploaded paper, inside a job: library work, not a learner's allowance (04 §5).
  library: true,
  buildPrompt: (input) => ({
    system: EXAM_EXTRACT_SYSTEM,
    user: `Course: ${input.course.code} · ${input.course.title}\n\nThe past paper's text:\n<source id="paper">\n${input.text}\n</source>`,
  }),
});

export const examClassifyInput = z.object({
  topics: z.array(z.object({ id: z.string(), title: z.string() })).max(80),
  questions: z.array(z.object({ index: z.number().int(), text: z.string().max(1500) })).max(80),
});

export const examClassifyOutput = z.object({
  results: z.array(
    z.object({
      index: z.number().int(),
      topic_id: z.string().nullable(),
      confidence: z.number().min(0).max(1).catch(0),
    }),
  ),
});
export type ExamClassifyOutput = z.infer<typeof examClassifyOutput>;

export const examClassify = defineSkill({
  name: "exam_classify",
  inputSchema: examClassifyInput,
  outputSchema: examClassifyOutput,
  promptVersion: EXAM_CLASSIFY_PROMPT_VERSION,
  library: true,
  buildPrompt: (input) => ({
    system: EXAM_CLASSIFY_SYSTEM,
    user: [
      `Topics:\n${input.topics.map((t) => `- ${t.id}: ${t.title}`).join("\n")}`,
      `Questions:\n${input.questions.map((q) => `[${q.index}] ${q.text}`).join("\n\n")}`,
    ].join("\n\n"),
  }),
});

export const workedSolutionInput = z.object({
  question: z.string().max(4000),
  marks: z.number().nullable(),
  qtype: z.enum(QTYPES).nullable(),
  topic: z.string().max(200).nullable(),
  chunks: z
    .array(z.object({ id: z.number(), content: z.string() }))
    .max(8)
    .default([]),
});
export type WorkedSolutionInput = z.infer<typeof workedSolutionInput>;

export const workedSolutionOutput = z.object({
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(1500),
        latex: z
          .string()
          .max(500)
          .nullable()
          .default(null)
          .transform((l) => (l ? restoreLatexBackslashes(l) : l)),
      }),
    )
    .min(1)
    .max(14),
  final: z.object({
    text: z.string().trim().min(1).max(800),
    stated: z.number().nullable().default(null),
    answer_expr: z.string().max(300).nullable().default(null),
    unit: z.string().max(30).nullable().default(null),
  }),
});
export type WorkedSolutionOutput = z.infer<typeof workedSolutionOutput>;

export const workedSolution = defineSkill({
  name: "worked_solution",
  inputSchema: workedSolutionInput,
  outputSchema: workedSolutionOutput,
  promptVersion: WORKED_SOLUTION_PROMPT_VERSION,
  quotaFeature: "worked_solution",
  quotaMessage: (limit) =>
    `You've opened ${limit} new worked solutions today. Solutions classmates already opened are still free; more tomorrow.`,
  buildPrompt: (input) => ({
    system: WORKED_SOLUTION_SYSTEM,
    user: [
      input.topic ? `Topic: ${input.topic}` : "",
      `Question${input.marks ? ` (${input.marks} marks)` : ""}${input.qtype ? `, type ${input.qtype}` : ""}:\n${input.question}`,
      input.chunks.length
        ? `Reference material from the course:\n${input.chunks.map((c) => `<source id="${c.id}">\n${c.content}\n</source>`).join("\n\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  }),
});
