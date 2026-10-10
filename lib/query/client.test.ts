import { MutationObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { makeQueryClient, shouldRetry } from "./client";
import { queryKeys } from "./keys";

describe("makeQueryClient", () => {
  it("invalidates the keys a mutation declares in meta.invalidates, including nested keys", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.courses.detail("c1"), { id: "c1" });
    qc.setQueryData(queryKeys.courses.outline("c1"), []);
    qc.setQueryData(queryKeys.me(), { id: "u1" });

    const observer = new MutationObserver(qc, {
      mutationFn: async () => "ok",
      meta: { invalidates: [queryKeys.courses.detail("c1")] },
    });
    await observer.mutate();

    expect(qc.getQueryState(queryKeys.courses.detail("c1"))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.courses.outline("c1"))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.me())?.isInvalidated).toBe(false);
  });

  it("also invalidates when the mutation fails, so optimistic updates get corrected", async () => {
    const qc = makeQueryClient();
    qc.setQueryData(queryKeys.plan.day("2026-10-10"), []);
    const observer = new MutationObserver(qc, {
      mutationFn: async () => {
        throw new ApiError(500, "Server error");
      },
      meta: { invalidates: [queryKeys.plan.all()] },
    });
    await expect(observer.mutate()).rejects.toThrow("Server error");
    expect(qc.getQueryState(queryKeys.plan.day("2026-10-10"))?.isInvalidated).toBe(true);
  });
});

describe("shouldRetry", () => {
  it("does not retry client errors that can't succeed", () => {
    expect(shouldRetry(0, new ApiError(403, "Forbidden"))).toBe(false);
    expect(shouldRetry(0, new ApiError(422, "Invalid"))).toBe(false);
  });

  it("retries server errors, timeouts, rate limits and network failures up to twice", () => {
    for (const status of [0, 408, 429, 503]) {
      expect(shouldRetry(0, new ApiError(status, "x"))).toBe(true);
      expect(shouldRetry(2, new ApiError(status, "x"))).toBe(false);
    }
    expect(shouldRetry(1, new Error("unknown"))).toBe(true);
  });
});
