import { z } from "zod";
import {
  CURATE_CLASSIFY_PROMPT_VERSION,
  CURATE_CLASSIFY_SYSTEM,
  EXPLAINER_FRAMES_PROMPT_VERSION,
  EXPLAINER_FRAMES_SYSTEM,
  EXPLAINER_REVIEW_PROMPT_VERSION,
  EXPLAINER_REVIEW_SYSTEM,
} from "../prompts/contribute";
import { defineSkill } from "./types";

// Contribute and teach (10 MVP-06). curate_classify checks material shared to the contribution
// pool (F11-FR2); explainer_review and explainer_frames check a student explainer before an admin
// approves it (F18-FR4, 08 §7b). Outputs are advice to deterministic code and a human, never final.

export const curateClassifyInput = z.object({
  kind: z.string().max(40),
  course: z.object({ code: z.string(), title: z.string() }).nullable(),
  candidates: z.array(z.object({ id: z.string(), title: z.string() })).max(40),
  text: z.string().min(1).max(12_000),
});

export const curateClassifyOutput = z.object({
  readable: z.boolean(),
  concept_ids: z.array(z.string()).max(20).catch([]),
  copyrighted: z.boolean().catch(false),
  personal_data: z.boolean().catch(false),
  injection: z.boolean().catch(false),
  reason: z.string().trim().max(300).nullable().catch(null),
});
export type CurateClassifyOutput = z.infer<typeof curateClassifyOutput>;

export const curateClassify = defineSkill({
  name: "curate_classify",
  inputSchema: curateClassifyInput,
  outputSchema: curateClassifyOutput,
  promptVersion: CURATE_CLASSIFY_PROMPT_VERSION,
  // Once per shared material, in a job: library work (04 §5).
  library: true,
  buildPrompt: (input) => ({
    system: CURATE_CLASSIFY_SYSTEM,
    user: [
      `Kind: ${input.kind}${input.course ? ` · course ${input.course.code} · ${input.course.title}` : ""}`,
      `Candidate topics:\n${input.candidates.map((c) => `- ${c.id}: ${c.title}`).join("\n") || "(none)"}`,
      `The material:\n<source id="upload">\n${input.text}\n</source>`,
    ].join("\n\n"),
  }),
});

export const explainerReviewInput = z.object({
  concept: z.object({ title: z.string(), subject: z.string().nullable() }),
  kind: z.enum(["text", "voice", "video"]),
  text: z.string().min(1).max(20_000),
});

export const explainerReviewOutput = z.object({
  on_topic: z.boolean(),
  accurate: z.boolean(),
  safe: z.boolean(),
  contact_or_personal: z.boolean().catch(false),
  copied: z.boolean().catch(false),
  numbers: z
    .array(z.object({ claim: z.string().max(300), value: z.number(), expr: z.string().max(200).nullable() }))
    .max(20)
    .catch([]),
  issues: z.array(z.string().max(300)).max(10).catch([]),
});
export type ExplainerReviewOutput = z.infer<typeof explainerReviewOutput>;

export const explainerReview = defineSkill({
  name: "explainer_review",
  inputSchema: explainerReviewInput,
  outputSchema: explainerReviewOutput,
  promptVersion: EXPLAINER_REVIEW_PROMPT_VERSION,
  quotaFeature: "explainers",
  quotaMessage: (limit) => `You've sent ${limit} explainers for review today. Send more tomorrow.`,
  buildPrompt: (input) => ({
    system: EXPLAINER_REVIEW_SYSTEM,
    user: `Topic: ${input.concept.title}${input.concept.subject ? ` (${input.concept.subject})` : ""}\nFormat: ${input.kind}\n\n<source id="explainer">\n${input.text}\n</source>`,
  }),
});

export const explainerFramesInput = z.object({ concept: z.string().max(200) });

export const explainerFramesOutput = z.object({
  safe: z.boolean(),
  other_people: z.boolean().catch(false),
  personal_data: z.boolean().catch(false),
  copied_slides: z.boolean().catch(false),
  issues: z.array(z.string().max(300)).max(10).catch([]),
});
export type ExplainerFramesOutput = z.infer<typeof explainerFramesOutput>;

export const explainerFrames = defineSkill({
  name: "explainer_frames",
  inputSchema: explainerFramesInput,
  outputSchema: explainerFramesOutput,
  promptVersion: EXPLAINER_FRAMES_PROMPT_VERSION,
  buildPrompt: (input) => ({
    system: EXPLAINER_FRAMES_SYSTEM,
    user: `Frames from a video explaining: ${input.concept}`,
  }),
});
