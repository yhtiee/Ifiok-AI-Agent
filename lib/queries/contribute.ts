"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Contribute, teach and earn on the client (10 MVP-06): explainers (create, upload, submit, play,
// finish, withdraw), the tutor profile, and admin review decisions. Pages are server-rendered;
// mutations invalidate the contribute prefix and pages refresh.

const upload = z.object({ path: z.string(), token: z.string() });
const created = z.object({
  id: z.string(),
  uploads: z.nullable(z.object({ audio: z.optional(upload), video: z.optional(upload), frames: z.array(upload) })),
});
export type CreatedExplainer = z.infer<typeof created>;

export type NewExplainer = {
  concept_id: string;
  kind: "text" | "voice" | "video";
  title: string;
  body_md?: string;
  media?: { audio_bytes: number; video_bytes?: number; mime: "webm" | "mp4" };
};

export function useCreateExplainer() {
  return useMutation({
    mutationFn: (body: NewExplainer) => apiFetch("/api/explainers", { method: "POST", body, schema: created }),
    meta: { invalidates: [queryKeys.contribute.all()] },
  });
}

export function useSubmitExplainer() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/explainers/${id}/submit`, { method: "POST", body: {}, schema: z.object({ status: z.string() }) }),
    meta: { invalidates: [queryKeys.contribute.all()] },
  });
}

export function explainerMediaUrl(id: string, part: "audio" | "video") {
  return apiFetch(`/api/explainers/${id}/media`, {
    method: "POST",
    body: { part },
    schema: z.object({ url: z.string() }),
  });
}

export function finishExplainer(id: string) {
  return apiFetch(`/api/explainers/${id}/finish`, {
    method: "POST",
    body: {},
    schema: z.object({ recorded: z.boolean() }),
  });
}

export function useWithdrawExplainer() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/explainers/${id}`, { method: "DELETE", schema: z.object({ withdrawn: z.boolean() }) }),
    meta: { invalidates: [queryKeys.contribute.all()] },
  });
}

export function useSaveTutor() {
  return useMutation({
    mutationFn: (body: { availability: string; concept_ids: string[]; active: boolean }) =>
      apiFetch("/api/tutor", { method: "PUT", body, schema: z.object({ saved: z.boolean() }) }),
    meta: { invalidates: [queryKeys.contribute.all()] },
  });
}

export function useAdminDecision() {
  return useMutation({
    mutationFn: (v: {
      target: "explainers" | "shares";
      id: string;
      decision: "approve" | "keep" | "reject";
      reason?: string;
    }) =>
      apiFetch(`/api/admin/${v.target}/${v.id}`, {
        method: "POST",
        body: { decision: v.decision, reason: v.reason },
        schema: z.object({ saved: z.boolean() }),
      }),
    meta: { invalidates: [queryKeys.contribute.all()] },
  });
}

export function useReportExplainer() {
  return useMutation({
    mutationFn: (v: { id: string; reason: string }) =>
      apiFetch(`/api/explainers/${v.id}/report`, {
        method: "POST",
        body: { reason: v.reason },
        schema: z.object({ reported: z.boolean() }),
      }),
  });
}
