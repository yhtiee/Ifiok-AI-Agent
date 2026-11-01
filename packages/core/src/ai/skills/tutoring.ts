import { z } from "zod";
import { TUTOR_AGENT_PROMPT_VERSION, TUTOR_AGENT_SYSTEM } from "../prompts/tutoring";
import { defineSkill } from "./types";

// tutor_agent (12 §4 Q63, 10 MVP-07 agentic commerce): chooses a weak topic, a tutor and a time
// from candidates the server already filtered to the student's spending limit. The server checks
// every ref, the time and the numbers in the reason before anything is shown; money moves only
// when the student approves on PayPal.

export const tutorAgentInput = z.object({
  now: z.string(),
  limit: z.string(),
  weak_topics: z
    .array(
      z.object({ ref: z.string(), title: z.string().max(200), evidence: z.string(), mistake: z.string().nullable() }),
    )
    .max(10),
  tutors: z
    .array(
      z.object({
        ref: z.string(),
        topic: z.string(),
        mastery: z.string().nullable(),
        price: z.string(),
        free: z.string().max(300),
        sessions_completed: z.number().int(),
      }),
    )
    .max(30),
  already_booked: z.array(z.string()),
});
export type TutorAgentInput = z.infer<typeof tutorAgentInput>;

export const tutorAgentOutput = z.object({
  decision: z.enum(["propose", "none"]),
  topic: z.string().optional(),
  tutor: z.string().optional(),
  day_offset: z.number().int().optional(),
  hour: z.number().int().optional(),
  reason: z.string().min(1).max(600),
});
export type TutorAgentOutput = z.infer<typeof tutorAgentOutput>;

export const tutorAgent = defineSkill({
  name: "tutor_agent",
  inputSchema: tutorAgentInput,
  outputSchema: tutorAgentOutput,
  promptVersion: TUTOR_AGENT_PROMPT_VERSION,
  quotaFeature: "tutor_agent",
  quotaMessage: (limit) => `Ifiok's tutoring agent has looked ${limit} times for you today. Try again tomorrow.`,
  buildPrompt: (input) => ({ system: TUTOR_AGENT_SYSTEM, user: JSON.stringify(input) }),
});
