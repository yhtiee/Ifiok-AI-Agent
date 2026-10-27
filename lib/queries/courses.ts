"use client";

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod/mini";
import { ApiError, apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Courses, outlines and topics on the client (P1-01). Response shapes are checked with zod/mini
// (small client bundle, CLAUDE.md performance budgets); mutations declare what they invalidate.

const course = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  subject: z.nullable(z.string()),
  level: z.nullable(z.number()),
  members: z.number(),
});
export type CourseSummary = z.infer<typeof course>;

const searchResponse = z.object({ courses: z.array(course) });

export const courseSearchQuery = (term: string) =>
  queryOptions({
    queryKey: queryKeys.courses.search(term),
    queryFn: ({ signal }) => apiFetch(`/api/courses?q=${encodeURIComponent(term)}`, { schema: searchResponse, signal }),
    staleTime: 30_000,
  });

export function useCourseSearch(term: string) {
  return useQuery({ ...courseSearchQuery(term), enabled: term.trim().length >= 2 });
}

const createResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("created"), course }),
  z.object({ status: z.literal("exists"), course }),
  z.object({ status: z.literal("similar"), candidates: z.array(course) }),
]);
export type CreateCourseResponse = z.infer<typeof createResponse>;

export function useCreateCourse() {
  return useMutation({
    mutationFn: (body: { code: string; title: string; subject: string; level?: number | null; confirmNew?: boolean }) =>
      apiFetch("/api/courses", { method: "POST", body, schema: createResponse }),
    meta: { invalidates: [queryKeys.courses.all()] },
  });
}

const joinResponse = z.object({ joined: z.boolean() });

export function useJoinCourse() {
  return useMutation({
    mutationFn: (courseId: string) =>
      apiFetch(`/api/courses/${courseId}/join`, { method: "POST", schema: joinResponse }),
    meta: { invalidates: [queryKeys.courses.all()] },
  });
}

// ---- Outline ----

export type OutlineTopicDraft = {
  topic_id?: string | null;
  title: string;
  week?: number | null;
  description?: string | null;
};

const saveResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("applied"), revisionId: z.number() }),
  z.object({ status: z.literal("pending"), revisionId: z.number() }),
  z.object({
    status: z.literal("too_broad"),
    topics: z.array(z.object({ index: z.number(), title: z.string(), suggestions: z.array(z.string()) })),
  }),
]);
export type SaveOutlineResponse = z.infer<typeof saveResponse>;

export function useSaveOutline(courseId: string) {
  return useMutation({
    mutationFn: async (body: { source: "upload" | "typed" | "ai_draft" | "edit"; topics: OutlineTopicDraft[] }) => {
      // too_broad comes back as 422 with a usable body; read it rather than throwing.
      const res = await fetch(`/api/courses/${courseId}/outline`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json: unknown = await res.json().catch(() => null);
      const parsed = saveResponse.safeParse(json);
      if (parsed.success) return parsed.data;
      return apiFetchError(res, json);
    },
    meta: { invalidates: [queryKeys.courses.detail(courseId)] },
  });
}

const draftResponse = z.object({
  topics: z.array(z.object({ week: z.number(), title: z.string(), description: z.string() })),
});

export function useDraftOutline(courseId: string) {
  return useMutation({
    mutationFn: () => apiFetch(`/api/courses/${courseId}/outline/draft`, { method: "POST", schema: draftResponse }),
  });
}

const extractResponse = z.object({
  course_code: z.nullable(z.string()),
  course_title: z.nullable(z.string()),
  topics: z.array(
    z.object({
      week: z.nullable(z.number()),
      title: z.string(),
      description: z.nullable(z.string()),
      confidence: z.number(),
    }),
  ),
});

export function useExtractOutline(courseId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(`/api/courses/${courseId}/outline/extract`, { method: "POST", body: form });
      const json: unknown = await res.json().catch(() => null);
      if (res.ok) return extractResponse.parse(json);
      return apiFetchError(res, json);
    },
  });
}

const decideResponse = z.object({ status: z.enum(["applied", "pending", "rejected"]), revisionId: z.number() });

export function useDecideRevision(courseId: string) {
  return useMutation({
    mutationFn: ({ revisionId, action }: { revisionId: number; action: "confirm" | "reject" | "revert" }) =>
      apiFetch(`/api/courses/${courseId}/outline/revisions/${revisionId}`, {
        method: "POST",
        body: { action },
        schema: decideResponse,
      }),
    meta: { invalidates: [queryKeys.courses.detail(courseId)] },
  });
}

// ---- Path (MVP-02) ----

const pathTopic = z.object({
  topicId: z.string(),
  title: z.string(),
  week: z.nullable(z.number()),
  conceptId: z.nullable(z.string()),
  lesson: z.enum(["ready", "building", "not_started"]),
  fromNotes: z.boolean(),
  covered: z.boolean(),
  tried: z.boolean(),
  explainers: z.number(),
  mastery: z.enum(["not_started", "familiar", "proficient", "mastered"]),
  practice: z.number(),
});
const pathResponse = z.object({ topics: z.array(pathTopic), nextUpTopicId: z.nullable(z.string()) });
export type CoursePathData = z.infer<typeof pathResponse>;

export const coursePathQuery = (courseId: string) =>
  queryOptions({
    queryKey: queryKeys.courses.path(courseId),
    queryFn: ({ signal }) => apiFetch(`/api/courses/${courseId}/path`, { schema: pathResponse, signal }),
  });

/** Polls while any lesson on the Path is being built, or while the caller expects new ones (`watch`). */
export function useCoursePath(courseId: string, initialData: CoursePathData, watch = false) {
  return useQuery({
    ...coursePathQuery(courseId),
    initialData,
    refetchInterval: (q) => (watch || q.state.data?.topics.some((t) => t.lesson === "building") ? 5_000 : false),
  });
}

// ---- Free-standing topics ----

const learnResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("following"),
    concept: z.object({ id: z.string(), title: z.string(), subject: z.string() }),
  }),
  z.object({ status: z.literal("too_broad"), suggestions: z.array(z.string()) }),
]);
export type LearnResponse = z.infer<typeof learnResponse>;

export function useLearnTopic() {
  return useMutation({
    mutationFn: async (topic: string) => {
      const res = await fetch("/api/learn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const json: unknown = await res.json().catch(() => null);
      const parsed = learnResponse.safeParse(json);
      if (parsed.success) return parsed.data;
      return apiFetchError(res, json);
    },
    meta: { invalidates: [queryKeys.concepts.followed()] },
  });
}

// Shared: turn an error body into the ApiError apiFetch would throw.
function apiFetchError(res: Response, json: unknown): never {
  const error = (json as { error?: { message?: string; code?: string } } | null)?.error;
  throw new ApiError(
    res.status,
    error?.message ?? `The request failed (${res.status}). Try again in a moment.`,
    error?.code,
  );
}
