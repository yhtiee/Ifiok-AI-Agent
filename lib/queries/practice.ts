"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Answers and finished lesson screens go to POST /api/sync (MVP-03, guardrail 6): the server marks
// them and records them once per client UUID. The client never decides what's correct.

const attemptResult = z.union([
  z.object({
    id: z.string(),
    status: z.enum(["recorded", "duplicate"]),
    correct: z.boolean(),
    why: z.nullable(z.string()),
    answer: z.nullable(z.string()),
    conceptId: z.string(),
    mastery: z.object({ m: z.number(), level: z.string() }),
  }),
  z.object({ id: z.string(), status: z.literal("not_found") }),
]);
const syncResponse = z.object({ attempts: z.array(attemptResult), screens: z.number() });
export type AttemptResult = z.infer<typeof attemptResult>;

export type AttemptInput = {
  id: string;
  item_id?: string;
  lesson_id?: string;
  block_id?: string;
  response:
    | { option_id: string }
    | { value: number | string }
    | { expr: string }
    | { order: string[] }
    | { pairs: [string, string][] }
    | { self: "got" | "partly" | "missed" };
  duration_ms?: number;
};
export type ScreenInput = { id: string; lesson_id: string; screen_id: string; completed_at: string };

export function postSync(body: { attempts?: AttemptInput[]; screens?: ScreenInput[] }) {
  return apiFetch("/api/sync", { method: "POST", body, schema: syncResponse });
}

/** One answer, marked by the server. Progress, weak areas and the Path refresh after it. */
export function useAnswer() {
  return useMutation({
    mutationFn: async (attempt: AttemptInput) => {
      const { attempts } = await postSync({ attempts: [attempt] });
      const result = attempts[0];
      if (!result) throw new Error("The answer wasn't recorded. Try again.");
      return result;
    },
    meta: { invalidates: [queryKeys.practice.all(), queryKeys.courses.all()] },
  });
}
