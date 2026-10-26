"use client";

import { queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// A student's own materials (MVP-01): list with status, add (text of picked pages only), delete,
// search, and outline text for scheme_extract. Shapes checked with zod/mini.

export type MaterialScope = { courseId: string } | { conceptId: string };

const scopeKey = (scope: MaterialScope) =>
  "courseId" in scope ? `course:${scope.courseId}` : `concept:${scope.conceptId}`;
const scopeQuery = (scope: MaterialScope) =>
  "courseId" in scope ? `courseId=${scope.courseId}` : `conceptId=${scope.conceptId}`;

const material = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  pageCount: z.number(),
  createdAt: z.string(),
  status: z.enum(["processing", "ready", "failed"]),
});
export type Material = z.infer<typeof material>;

const listResponse = z.object({ materials: z.array(material) });

export const materialsQuery = (scope: MaterialScope) =>
  queryOptions({
    queryKey: queryKeys.materials.list(scopeKey(scope)),
    queryFn: ({ signal }) => apiFetch(`/api/materials?${scopeQuery(scope)}`, { schema: listResponse, signal }),
    // Poll while anything is still being embedded; stop once everything is ready or failed.
    refetchInterval: (query) => (query.state.data?.materials.some((m) => m.status === "processing") ? 4_000 : false),
  });

export function useMaterials(scope: MaterialScope) {
  return useQuery(materialsQuery(scope));
}

const createResponse = z.object({
  material: z.object({ id: z.string(), title: z.string(), pageCount: z.number(), chunks: z.number() }),
  jobId: z.string(),
  examJobId: z.optional(z.nullable(z.string())),
  labJobId: z.optional(z.nullable(z.string())),
  redacted: z.number(),
  skippedPages: z.number(),
});
export type AddMaterialResult = z.infer<typeof createResponse>;

export type AddMaterialInput = {
  kind: "notes" | "textbook" | "past_questions" | "lab_manual";
  title: string;
  pages: { page: number | null; text: string }[];
};

export function useAddMaterial(scope: MaterialScope) {
  return useMutation({
    mutationFn: (input: AddMaterialInput) =>
      apiFetch("/api/materials", { method: "POST", body: { ...scope, ...input }, schema: createResponse }),
    meta: { invalidates: [queryKeys.materials.list(scopeKey(scope))] },
  });
}

export function useDeleteMaterial() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/materials/${id}`, { method: "DELETE", schema: z.object({ deleted: z.boolean() }) }),
    meta: { invalidates: [queryKeys.materials.all()] },
  });
}

const searchResponse = z.object({
  hits: z.array(
    z.object({ sourceId: z.string(), title: z.string(), page: z.nullable(z.number()), snippet: z.string() }),
  ),
});
export type MaterialHit = z.infer<typeof searchResponse>["hits"][number];

export function useMaterialSearch(scope: MaterialScope, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: queryKeys.materials.search(scopeKey(scope), term),
    queryFn: ({ signal }) =>
      apiFetch(`/api/materials/search?${scopeQuery(scope)}&q=${encodeURIComponent(term)}`, {
        schema: searchResponse,
        signal,
      }),
    enabled: term.length >= 2,
    staleTime: 30_000,
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
export type OutlineExtract = z.infer<typeof extractResponse>;

/** Course outline pages picked on the device go to scheme_extract as text (no file is sent). */
export function useExtractOutlineText(courseId: string) {
  return useMutation({
    mutationFn: (text: string) =>
      apiFetch(`/api/courses/${courseId}/outline/extract`, { method: "POST", body: { text }, schema: extractResponse }),
  });
}
