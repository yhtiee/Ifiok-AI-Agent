"use client";

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod/mini";
import type { LessonRow } from "@/lib/lessons/types";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// A concept's shared lesson on the client (P1-02). The lesson spec itself was validated and
// verified on the server before saving; here only the state envelope is checked (zod/mini).

const concept = z.object({ id: z.string(), title: z.string(), subject: z.string() });
const lessonRow = z.custom<LessonRow>(
  (v) => typeof v === "object" && v !== null && "id" in v && "spec" in v && "status" in v,
);

const lessonState = z.discriminatedUnion("status", [
  z.object({ status: z.literal("published"), lesson: lessonRow }),
  z.object({ status: z.literal("none"), concept, quickExplainer: z.string() }),
  z.object({ status: z.literal("generating"), jobId: z.string(), concept, quickExplainer: z.string() }),
  z.object({
    status: z.literal("waiting"),
    jobId: z.string(),
    concept,
    quickExplainer: z.string(),
    message: z.string(),
  }),
  z.object({ status: z.literal("review"), concept, quickExplainer: z.string(), message: z.string() }),
  z.object({
    status: z.literal("failed"),
    concept,
    quickExplainer: z.string(),
    message: z.string(),
    canRetry: z.boolean(),
  }),
]);
export type LessonState = z.infer<typeof lessonState>;

/** Polls every 3 s while the lesson is being built; P0-11 swaps this for Realtime (`useJob`). */
export const conceptLessonQuery = (conceptId: string) =>
  queryOptions({
    queryKey: queryKeys.concepts.lesson(conceptId),
    queryFn: ({ signal }) => apiFetch(`/api/concepts/${conceptId}/lesson`, { schema: lessonState, signal }),
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 3000 : false),
  });

export function useConceptLesson(conceptId: string, initialData: LessonState) {
  return useQuery({ ...conceptLessonQuery(conceptId), initialData });
}

/** Opens the lesson, starting or retrying generation when there is none. */
export function useStartLesson(conceptId: string) {
  return useMutation({
    mutationFn: (courseId?: string) =>
      apiFetch(`/api/concepts/${conceptId}/lesson`, {
        method: "POST",
        body: courseId ? { course_id: courseId } : {},
        schema: lessonState,
      }),
    meta: { invalidates: [queryKeys.concepts.lesson(conceptId)] },
  });
}

const flagResponse = z.object({ status: z.literal("flagged"), id: z.number() });

export function useFlagBlock(lessonId: string) {
  return useMutation({
    mutationFn: (body: { blockId: string; reason: "wrong" | "unclear" | "offensive" | "other"; note?: string }) =>
      apiFetch(`/api/lessons/${lessonId}/flags`, { method: "POST", body, schema: flagResponse }),
    meta: { invalidates: [queryKeys.lessons.detail(lessonId)] },
  });
}
