import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from "../types";

// Groq via OpenAI-compatible chat completions endpoint (https://api.groq.com/openai/v1/chat/completions).
// Used alongside Gemini for fast skills (claim_check), lesson generation, and instant failover.

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Groq counts input + max_completion_tokens against the tokens-per-minute limit before it runs a
// request (free tier: 8,000/min for gpt-oss-120b), and with no max it falls back to a small default
// that cuts lessons off mid-JSON. So with no configured cap (12 §4 Q27) we ask for what the minute
// leaves after the prompt. Raise GROQ_TPM_BUDGET with a paid tier.
const GROQ_TPM_BUDGET = 7_800;
const MIN_COMPLETION = 1_024;
const MAX_COMPLETION = 32_000;

/** Rough token estimate (≈ 4 characters per token) for the request's prompt. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function completionBudget(req: Pick<ProviderRequest, "system" | "user" | "maxOutputTokens">): number {
  if (req.maxOutputTokens) return req.maxOutputTokens;
  const room = GROQ_TPM_BUDGET - estimateTokens(req.system) - estimateTokens(req.user);
  return Math.min(MAX_COMPLETION, Math.max(MIN_COMPLETION, room));
}

/** gpt-oss models reason before answering; their hidden reasoning shares the completion budget. */
function isReasoningModel(model: string): boolean {
  return model.startsWith("openai/gpt-oss");
}

function reasoningEffort(level: ProviderRequest["thinking"]): "low" | "medium" | "high" {
  return level === "high" ? "high" : level === "medium" ? "medium" : "low";
}

type GroqUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
};

type GroqChoice = {
  message?: {
    content?: string;
  };
  finish_reason?: string;
};

type GroqResponse = {
  choices?: GroqChoice[];
  usage?: GroqUsage;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export function createGroqProvider(apiKey: string | undefined): Provider {
  return {
    name: "groq",
    available: () => Boolean(apiKey),
    async generate(req: ProviderRequest): Promise<ProviderResponse> {
      if (!apiKey) throw new ProviderError("GROQ_API_KEY is not set", "config");

      const send = async (json: boolean) => {
        const body = {
          model: req.model,
          messages: [
            { role: "system", content: req.system },
            { role: "user", content: req.user },
          ],
          ...(json ? { response_format: { type: "json_object" } } : {}),
          max_completion_tokens: completionBudget(req),
          ...(isReasoningModel(req.model) ? { reasoning_effort: reasoningEffort(req.thinking) } : {}),
          temperature: 0.2,
        };
        try {
          return await fetch(ENDPOINT, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(req.timeoutMs),
          });
        } catch (err) {
          const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
          throw new ProviderError(timedOut ? "Groq timed out" : "Groq unreachable", timedOut ? "timeout" : "network");
        }
      };

      let res = await send(Boolean(req.json));
      if (req.json && res.status === 400) {
        // Groq's JSON mode sometimes rejects its own reply ("json_validate_failed"). Ask once more
        // without it: the gateway still extracts and validates the JSON itself.
        const err = (await res
          .clone()
          .json()
          .catch(() => ({}))) as GroqResponse;
        if (err.error?.code === "json_validate_failed") res = await send(false);
      }

      const json = (await res.json().catch(() => ({}))) as GroqResponse;
      if (!res.ok) {
        throw new ProviderError(`Groq ${res.status}: ${json.error?.message ?? "error"}`, "http", res.status);
      }

      const choice = json.choices?.[0];
      const reasoningTokens = json.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
      const totalCompletion = json.usage?.completion_tokens ?? 0;
      const outputTokens = Math.max(0, totalCompletion - reasoningTokens);

      const usage = {
        input: json.usage?.prompt_tokens ?? 0,
        output: outputTokens,
        thinking: reasoningTokens,
      };

      if (choice?.finish_reason === "content_filter") {
        throw new ProviderError("Groq blocked the content", "blocked", 200, usage);
      }

      const finish: ProviderResponse["finish"] =
        choice?.finish_reason === "stop"
          ? "stop"
          : choice?.finish_reason === "length"
            ? "length"
            : choice?.finish_reason === "content_filter"
              ? "blocked"
              : "other";

      return {
        text: choice?.message?.content ?? "",
        usage,
        finish,
      };
    },
  };
}
