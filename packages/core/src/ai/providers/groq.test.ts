import { describe, expect, it, vi } from "vitest";
import { completionBudget, createGroqProvider } from "./groq";
import { ProviderError } from "../types";

describe("Groq Provider", () => {
  it("reports unavailable when GROQ_API_KEY is not set", () => {
    const provider = createGroqProvider(undefined);
    expect(provider.available()).toBe(false);
  });

  it("reports available when GROQ_API_KEY is provided", () => {
    const provider = createGroqProvider("gsk_test123");
    expect(provider.available()).toBe(true);
  });

  it("sends standard chat completion request and maps token usage", async () => {
    const fakeResponse = {
      choices: [
        {
          message: { content: '{"answer": "42"}' },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 30,
        total_tokens: 80,
        completion_tokens_details: {
          reasoning_tokens: 10,
        },
      },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGroqProvider("gsk_test_key");
    const res = await provider.generate({
      model: "llama-3.3-70b-versatile",
      system: "You are an AI teacher.",
      user: "Solve x + 2 = 5",
      json: true,
      timeoutMs: 5000,
      maxOutputTokens: 1000,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.groq.com/openai/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer gsk_test_key",
        },
      }),
    );

    expect(res.text).toBe('{"answer": "42"}');
    expect(res.finish).toBe("stop");
    expect(res.usage.input).toBe(50);
    expect(res.usage.output).toBe(20); // 30 total - 10 reasoning = 20 output
    expect(res.usage.thinking).toBe(10); // reasoning tokens mapped to thinking
  });

  it("handles HTTP errors with status and error message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: { message: "Rate limit reached", type: "tokens" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGroqProvider("gsk_test_key");

    await expect(
      provider.generate({
        model: "llama-3.3-70b-versatile",
        system: "sys",
        user: "hi",
        json: false,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow(ProviderError);
  });

  it("handles content filter blocks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ finish_reason: "content_filter" }],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createGroqProvider("gsk_test_key");

    await expect(
      provider.generate({
        model: "llama-3.3-70b-versatile",
        system: "sys",
        user: "dangerous prompt",
        json: false,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow("Groq blocked the content");
  });

  it("asks for the completion budget the per-minute token limit leaves after the prompt", () => {
    const small = completionBudget({ system: "s".repeat(4000), user: "u".repeat(4000) });
    expect(small).toBe(7_800 - 2_000);
    expect(completionBudget({ system: "x".repeat(40_000), user: "" })).toBe(1_024);
    expect(completionBudget({ system: "", user: "", maxOutputTokens: 500 })).toBe(500);
  });

  it("sets a completion budget and low reasoning effort for gpt-oss models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }], usage: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await createGroqProvider("k").generate({
      model: "openai/gpt-oss-120b",
      system: "s",
      user: "u",
      json: true,
      timeoutMs: 1000,
    });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.max_completion_tokens).toBeGreaterThan(7_000);
    expect(body.reasoning_effort).toBe("low");
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("retries once without JSON mode when Groq rejects its own JSON", async () => {
    const rejected = {
      ok: false,
      status: 400,
      json: async () => ({ error: { code: "json_validate_failed", message: "Failed to generate JSON" } }),
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ...rejected, clone: () => rejected })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }], usage: {} }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const res = await createGroqProvider("k").generate({
      model: "openai/gpt-oss-120b",
      system: "s",
      user: "u",
      json: true,
      timeoutMs: 1000,
    });
    expect(res.text).toBe('{"a":1}');
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string).response_format).toBeUndefined();
  });
});
