import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResponse } from "../types";

// Anthropic (Claude) via the official SDK: the fallback provider (04 §3). The gateway owns
// retries and fallbacks, so the SDK's own retries are off. No thinking is requested: the
// fallback route uses Claude Haiku 4.5 for short structured replies.

export function createAnthropicProvider(apiKey: string | undefined): Provider {
  const client = apiKey ? new Anthropic({ apiKey, maxRetries: 0 }) : null;

  return {
    name: "anthropic",
    available: () => client !== null,
    async generate(req: ProviderRequest): Promise<ProviderResponse> {
      if (!client) throw new ProviderError("ANTHROPIC_API_KEY is not set", "config");

      const content: Anthropic.ContentBlockParam[] = [
        ...(req.images ?? []).map((img): Anthropic.ContentBlockParam => {
          const data = Buffer.from(img.data).toString("base64");
          return img.mime === "application/pdf"
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
            : { type: "image", source: { type: "base64", media_type: img.mime, data } };
        }),
        { type: "text", text: req.user },
      ];

      let message: Anthropic.Message;
      try {
        message = await client.messages.create(
          {
            model: req.model,
            max_tokens: req.maxOutputTokens,
            system: req.json ? `${req.system}\n\nReply with a single JSON object and nothing else.` : req.system,
            messages: [{ role: "user", content }],
          },
          { timeout: req.timeoutMs },
        );
      } catch (err) {
        if (err instanceof Anthropic.APIConnectionTimeoutError) throw new ProviderError("Claude timed out", "timeout");
        if (err instanceof Anthropic.APIConnectionError) throw new ProviderError("Claude unreachable", "network");
        if (err instanceof Anthropic.APIError) {
          throw new ProviderError(`Claude ${err.status ?? "error"}`, "http", err.status);
        }
        throw err;
      }

      const usage = { input: message.usage.input_tokens, output: message.usage.output_tokens, thinking: 0 };
      if (message.stop_reason === "refusal")
        throw new ProviderError("Claude declined the request", "blocked", 200, usage);

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const finish =
        message.stop_reason === "end_turn" ? "stop" : message.stop_reason === "max_tokens" ? "length" : "other";
      return { text, usage, finish };
    },
  };
}
