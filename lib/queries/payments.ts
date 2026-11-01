"use client";

import { useMutation } from "@tanstack/react-query";
import { z } from "zod/mini";
import { apiFetch } from "@/lib/query/api";
import { queryKeys } from "@/lib/query/keys";

// Get paid (MVP-07): the PayPal (sandbox) email, "why this amount", tutoring bookings and the
// admin's payouts and disputes. The screens are server-rendered; callers refresh after success.

const saved = z.object({ saved: z.boolean() });
const meta = { invalidates: [queryKeys.payments.all()] };

export function useSavePayoutAccount() {
  return useMutation({
    mutationFn: (email: string | null) =>
      email === null
        ? apiFetch("/api/payouts/account", { method: "DELETE", schema: saved })
        : apiFetch("/api/payouts/account", { method: "PUT", body: { paypal_email: email }, schema: saved }),
    meta,
  });
}

export function useExplainPayout() {
  return useMutation({
    mutationFn: (lineId: string) =>
      apiFetch(`/api/payouts/${lineId}/explain`, { method: "POST", schema: z.object({ text: z.string() }) }),
  });
}

export type BookingInput = { tutor_id: string; concept_id: string; starts_at: string; proposal_id?: string };

const proposalSchema = z.object({
  id: z.string(),
  concept: z.object({ id: z.string(), title: z.string() }),
  tutor: z.object({ id: z.string(), name: z.string() }),
  startsAt: z.string(),
  price: z.string(),
  limit: z.string(),
  reason: z.string(),
  considered: z.object({ weakTopics: z.number(), tutors: z.number(), overLimit: z.number() }),
  decidedBy: z.enum(["ai", "rules"]),
});
export type AgentProposalView = z.infer<typeof proposalSchema>;

/** Ifiok's tutoring agent drafts a booking; nothing is booked until the student approves on PayPal. */
export function useRunTutorAgent() {
  return useMutation({
    mutationFn: () =>
      apiFetch("/api/tutoring/agent", { method: "POST", schema: z.object({ proposal: proposalSchema }) }),
    meta,
  });
}

export function useDismissProposal() {
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/tutoring/agent/${id}`, { method: "DELETE", schema: saved }),
    meta,
  });
}

export function useSetSpendLimit() {
  return useMutation({
    mutationFn: (cents: number) =>
      apiFetch("/api/tutoring/preferences", { method: "PUT", body: { spend_limit_cents: cents }, schema: saved }),
    meta,
  });
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: (body: BookingInput) =>
      apiFetch("/api/tutoring/bookings", {
        method: "POST",
        body,
        schema: z.object({ id: z.string(), approveUrl: z.string() }),
      }),
    meta,
  });
}

export type BookingAction =
  { action: "authorize" | "cancel" | "confirm" | "no_show" } | { action: "dispute"; reason: string };

export function useBookingAction(id: string) {
  return useMutation({
    mutationFn: (body: BookingAction) =>
      apiFetch(`/api/tutoring/bookings/${id}`, { method: "POST", body, schema: z.unknown() }),
    meta,
  });
}

export function useClosePeriod() {
  return useMutation({
    mutationFn: (body: { month: string; pool_cents: number }) =>
      apiFetch("/api/admin/payouts", { method: "POST", body, schema: z.object({ periodId: z.string() }) }),
    meta,
  });
}

export function useSendPayouts() {
  return useMutation({
    mutationFn: (periodId: string) =>
      apiFetch(`/api/admin/payouts/${periodId}/send`, {
        method: "POST",
        body: { action: "send" },
        schema: z.object({ sent: z.number(), waiting: z.number() }),
      }),
    meta,
  });
}

export function usePeriodAction() {
  return useMutation({
    mutationFn: (v: { periodId: string; action: "refresh" | "retry" }) =>
      apiFetch(`/api/admin/payouts/${v.periodId}/send`, {
        method: "POST",
        body: { action: v.action },
        schema: z.object({ changed: z.optional(z.number()), reopened: z.optional(z.number()) }),
      }),
    meta,
  });
}

export function useResolveBooking() {
  return useMutation({
    mutationFn: (v: { id: string; outcome: "release" | "refund" }) =>
      apiFetch(`/api/admin/bookings/${v.id}`, { method: "POST", body: { outcome: v.outcome }, schema: saved }),
    meta,
  });
}
