import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/mini";
import { ApiError, apiFetch } from "./api";

const schema = z.object({ id: z.string() });

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch", () => {
  it("returns the parsed body on success and sends JSON", async () => {
    mockFetch(async () => Response.json({ id: "c1", extra: true }));
    await expect(apiFetch("/api/courses", { schema, method: "POST", body: { code: "MTH 101" } })).resolves.toEqual({
      id: "c1",
    });
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init?.body).toBe(JSON.stringify({ code: "MTH 101" }));
    expect(new Headers(init?.headers).get("content-type")).toBe("application/json");
  });

  it("turns an error body into an ApiError with the server's user-facing message", async () => {
    mockFetch(async () =>
      Response.json({ error: { message: "Daily limit reached.", code: "quota" } }, { status: 429 }),
    );
    const err = await apiFetch("/api/tutor", { schema }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 429, code: "quota", message: "Daily limit reached.", retryable: true });
  });

  it("rejects a response that doesn't match the schema", async () => {
    mockFetch(async () => Response.json({ nope: 1 }));
    await expect(apiFetch("/api/x", { schema })).rejects.toMatchObject({ code: "bad_response" });
  });

  it("reports a network failure as status 0 with a fix", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(apiFetch("/api/x", { schema })).rejects.toMatchObject({ status: 0, retryable: true });
  });
});
