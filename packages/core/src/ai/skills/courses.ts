import { z } from "zod";
import { OUTLINE_DRAFT_PROMPT_VERSION, OUTLINE_DRAFT_SYSTEM } from "../prompts/outline-draft";
import { SCHEME_EXTRACT_PROMPT_VERSION, SCHEME_EXTRACT_SYSTEM } from "../prompts/scheme-extract";
import { TOPIC_RESOLVE_PROMPT_VERSION, TOPIC_RESOLVE_SYSTEM } from "../prompts/topic-resolve";
import { defineSkill } from "./types";

// Skills for P1-01: topic_resolve, outline_draft, scheme_extract (04 §4.5b, §4.6).

const levelBand = z.enum(["foundation", "introductory", "intermediate", "advanced"]);

// ---- topic_resolve (batched: up to 15 topics in one call, 12 §4 Q26) ----

export const topicResolveInput = z.object({
  level_band: levelBand,
  course: z.object({ code: z.string(), title: z.string() }).nullable(),
  /** The course's subject; null for free-standing topics (the model picks one). */
  subject: z.string().nullable(),
  subjects: z.array(z.object({ code: z.string(), title: z.string() })),
  topics: z
    .array(
      z.object({
        key: z.string(),
        title: z.string().trim().min(1).max(120),
        description: z.string().max(400).nullable(),
        candidates: z.array(
          z.object({ id: z.string(), title: z.string(), description: z.string().nullable(), similarity: z.number() }),
        ),
      }),
    )
    .min(1)
    .max(15),
});
export type TopicResolveInput = z.infer<typeof topicResolveInput>;

const newConcept = z.object({
  title: z.string().trim().min(1).max(80),
  subject: z.string(),
  description: z.string().trim().min(1).max(300),
  micro_skills: z
    .array(
      z
        .string()
        .regex(/^[a-z0-9_.]+$/)
        .max(60),
    )
    .max(6),
  prerequisites: z.array(z.string().max(80)).max(4),
});

export const topicResolveOutput = z.object({
  results: z.array(
    z.object({
      key: z.string(),
      match: z.string().nullable(),
      new: newConcept.nullable(),
      too_broad: z.array(z.string().max(80)).max(6).nullable(),
    }),
  ),
});
export type TopicResolveOutput = z.infer<typeof topicResolveOutput>;

export const topicResolve = defineSkill({
  name: "topic_resolve",
  inputSchema: topicResolveInput,
  outputSchema: topicResolveOutput,
  promptVersion: TOPIC_RESOLVE_PROMPT_VERSION,
  buildPrompt: (input) => ({
    system: TOPIC_RESOLVE_SYSTEM,
    user: JSON.stringify({
      level_band: input.level_band,
      course: input.course,
      subject: input.subject ?? "choose from allowed_subjects",
      allowed_subjects: input.subjects.map((s) => s.code),
      topics: input.topics.map((t) => ({
        key: t.key,
        topic: t.title,
        description: t.description,
        candidates: t.candidates.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          similarity: Number(c.similarity.toFixed(3)),
        })),
      })),
    }),
  }),
});

// ---- outline_draft ----

export const outlineDraftInput = z.object({
  course_code: z.string(),
  course_title: z.string(),
  level: z.number().int().nullable(),
  university: z.string().nullable(),
  subject: z.string().nullable(),
});

export const outlineDraftOutput = z.object({
  topics: z
    .array(
      z.object({
        week: z.number().int().min(1).max(20),
        title: z.string().trim().min(1).max(100),
        description: z.string().trim().max(240),
      }),
    )
    .min(6)
    .max(16),
});
export type OutlineDraftOutput = z.infer<typeof outlineDraftOutput>;

export const outlineDraft = defineSkill({
  name: "outline_draft",
  inputSchema: outlineDraftInput,
  outputSchema: outlineDraftOutput,
  promptVersion: OUTLINE_DRAFT_PROMPT_VERSION,
  library: true,
  buildPrompt: (input) => ({
    system: OUTLINE_DRAFT_SYSTEM,
    user: JSON.stringify({
      course_code: input.course_code,
      course_title: input.course_title,
      level: input.level ? `${input.level} level` : "unknown",
      university: input.university ?? "a Nigerian university",
      subject: input.subject,
    }),
  }),
});

// ---- scheme_extract (vision: photo or PDF of the outline) ----

export const schemeExtractInput = z.object({
  course_code: z.string().nullable(),
  course_title: z.string().nullable(),
});

export const schemeExtractOutput = z.object({
  course_code: z.string().nullable(),
  course_title: z.string().nullable(),
  topics: z
    .array(
      z.object({
        week: z.number().int().min(1).max(30).nullable(),
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(400).nullable(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(40),
});
export type SchemeExtractOutput = z.infer<typeof schemeExtractOutput>;

export const schemeExtract = defineSkill({
  name: "scheme_extract",
  inputSchema: schemeExtractInput,
  outputSchema: schemeExtractOutput,
  promptVersion: SCHEME_EXTRACT_PROMPT_VERSION,
  buildPrompt: (input) => ({
    system: SCHEME_EXTRACT_SYSTEM,
    user: `The student says this is the outline for ${input.course_code ?? "their course"}${
      input.course_title ? ` (${input.course_title})` : ""
    }. Read the attached document.`,
  }),
});
