import "server-only";
import { getConfig } from "@/lib/config";
import { serverEnv } from "@/lib/env/server";
import { createGateway, type Gateway } from "./gateway";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import { createSupabaseGatewayStore } from "./store";

export { GatewayError } from "./gateway";

let gateway: Gateway | null = null;

/** The AI gateway with real providers and the Supabase store. Server only (guardrail 1). */
export function getGateway(): Gateway {
  gateway ??= createGateway({
    config: getConfig,
    providers: {
      gemini: createGeminiProvider(serverEnv.GEMINI_API_KEY),
      anthropic: createAnthropicProvider(serverEnv.ANTHROPIC_API_KEY),
      groq: createGroqProvider(serverEnv.GROQ_API_KEY),
    },
    store: createSupabaseGatewayStore(),
    // Metadata only, never prompts or outputs (04 §2.7). Sentry/alerts arrive in P0-14.
    log: (event) => {
      if (
        event.type === "cap_alert" ||
        event.type === "missing_price" ||
        event.type === "refund_failed" ||
        event.type === "provider_error" ||
        event.type === "fallback_used"
      ) {
        console.warn("[ai]", event);
      }
    },
  });
  return gateway;
}
