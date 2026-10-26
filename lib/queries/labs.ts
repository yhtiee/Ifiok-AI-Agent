"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Virtual labs on the client (10 MVP-05): requesting a lab, starting a run, comparing a result.

export function useRequestLab() {
  return useMutation({
    mutationFn: (body: { topic: string; course_id: string | null }) =>
      apiFetch("/api/labs", {
        method: "POST",
        body,
        schema: z.discriminatedUnion("status", [
          z.object({ status: z.literal("added"), labId: z.string() }),
          z.object({ status: z.literal("building"), jobId: z.string() }),
        ]),
      }),
    meta: { invalidates: [queryKeys.labs.all()] },
  });
}

const runSchema = z.object({
  seed: z.number(),
  settings: z.array(z.object({ value: z.number(), readings: z.array(z.number()) })),
});
export type LabRunData = z.infer<typeof runSchema>;

export function useStartRun(labId: string) {
  return useMutation({
    mutationFn: () => apiFetch(`/api/labs/${labId}/run`, { method: "POST", body: {}, schema: runSchema }),
  });
}

const comparisonSchema = z.object({
  accepted: z.number(),
  unit: z.string(),
  stated: z.number(),
  errorPct: z.number(),
  withinTolerance: z.boolean(),
  tolerancePct: z.number(),
  fromReadings: z.nullable(z.number()),
  notes: z.array(z.string()),
});
export type LabComparisonView = z.infer<typeof comparisonSchema>;

export function useCompareLab(labId: string) {
  return useMutation({
    mutationFn: (body: { run_id: string; seed: number; taken: { value: number; count: number }[]; stated: number }) =>
      apiFetch(`/api/labs/${labId}/compare`, { method: "POST", body, schema: comparisonSchema }),
    meta: { invalidates: [queryKeys.labs.all()] },
  });
}
