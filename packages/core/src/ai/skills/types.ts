import type { z } from "zod";
import type { SkillName } from "../types";

/**
 * A skill (04 §4): typed input and output, a versioned prompt, and its budget rules.
 * Prompts live in lib/ai/prompts/<skill>.ts with a version, recorded in ai_calls.
 */
export type SkillDefinition<I = unknown, O = unknown> = {
  name: SkillName;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  promptVersion: number;
  buildPrompt: (input: I) => { system: string; user: string };
  /** Counts against the library generation budget, not the per-learner global cap (04 §5). */
  library?: boolean;
  /** Keeps running when the global daily cap is reached (e.g. safety moderation). */
  capExempt?: boolean;
  /** Per-user daily allowance from app_config.ai_quotas[feature] (consume_quota). */
  quotaFeature?: string;
  /** Message when that allowance is used up (P1 copy: no Units). */
  quotaMessage?: (limit: number) => string;
};

/** Helper so each skill file gets full type inference. */
export function defineSkill<I, O>(skill: SkillDefinition<I, O>): SkillDefinition<I, O> {
  return skill;
}
