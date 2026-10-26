"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Exam prep on the client (10 MVP-04): saving a reviewed paper, the exam date, and worked solutions.

export type ReviewedQuestion = {
  number: string;
  sub: string | null;
  text: string;
  marks: number | null;
  qtype: "calc" | "theory" | "definition" | "proof" | "diagram" | "mcq";
  concept_id: string | null;
};

export function useSavePaper(courseId: string) {
  return useMutation({
    mutationFn: (body: { source_id: string; year: number | null; questions: ReviewedQuestion[] }) =>
      apiFetch(`/api/courses/${courseId}/exam/papers`, {
        method: "POST",
        body,
        schema: z.object({ saved: z.number(), unassigned: z.number() }),
      }),
    meta: { invalidates: [queryKeys.courses.detail(courseId), queryKeys.practice.all()] },
  });
}

export function useSetExamDate(courseId: string) {
  return useMutation({
    mutationFn: (examDate: string) =>
      apiFetch(`/api/courses/${courseId}/exam/date`, {
        method: "PUT",
        body: { exam_date: examDate },
        schema: z.object({ saved: z.boolean() }),
      }),
    meta: { invalidates: [queryKeys.courses.detail(courseId)] },
  });
}

const solutionResponse = z.object({
  solution: z.object({
    steps: z.array(z.object({ text: z.string(), latex: z.nullable(z.string()) })),
    final: z.object({ text: z.string(), stated: z.nullable(z.number()), unit: z.nullable(z.string()) }),
    checked: z.boolean(),
  }),
  math: z.record(z.string(), z.string()),
});
export type SolutionResponse = z.infer<typeof solutionResponse>;

export function useWorkedSolution(questionId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch(`/api/exam/questions/${questionId}/solution`, { method: "POST", schema: solutionResponse }),
  });
}
