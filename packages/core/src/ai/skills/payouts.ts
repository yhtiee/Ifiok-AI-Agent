import { z } from "zod";
import { PAYOUT_EXPLAIN_PROMPT_VERSION, PAYOUT_EXPLAIN_SYSTEM } from "../prompts/payouts";
import { defineSkill } from "./types";

// payout_explain (10 MVP-07): "You earned 14 points this month: 9 from your Kinematics notes, 5 from
// your video explainer…" from the server-written payout line. Numbers are passed in pre-formatted.

export const payoutExplainInput = z.object({
  month: z.string(),
  points: z.number().int(),
  sources: z.array(z.object({ title: z.string().max(140), kind: z.string(), points: z.number().int() })).max(20),
  pool: z.string(),
  total_points: z.number().int(),
  amount: z.string(),
  capped: z.boolean(),
});

export const payoutExplainOutput = z.object({ text: z.string().min(1).max(600) });
export type PayoutExplainOutput = z.infer<typeof payoutExplainOutput>;

export const payoutExplain = defineSkill({
  name: "payout_explain",
  inputSchema: payoutExplainInput,
  outputSchema: payoutExplainOutput,
  promptVersion: PAYOUT_EXPLAIN_PROMPT_VERSION,
  quotaFeature: "payout_explain",
  quotaMessage: () => "Ifiok has explained enough payouts for today. The amounts are shown as they are.",
  buildPrompt: (input) => ({ system: PAYOUT_EXPLAIN_SYSTEM, user: JSON.stringify(input) }),
});
