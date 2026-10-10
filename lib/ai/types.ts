import type { z } from "zod";
import type { providerNameSchema, thinkingLevelSchema } from "@/lib/config-schema";

// AI gateway types (specifications/04-ai.md §2).

export const SKILLS = [
  "tutor_chat",
  "tutor_explain_style",
  "lesson_generate",
  "lesson_repair",
  "items_generate",
  "scheme_extract",
  "outline_draft",
  "topic_resolve",
  "page_match_rerank",
  "ocr_pages",
  "transcribe_working",
  "explain_error",
  "exam_extract",
  "exam_classify",
  "curate_classify",
  "teach_back_check",
  "answer_check",
  "item_solve",
  "claim_check",
  "brief_rewrite",
  "moderate",
] as const;
export type SkillName = (typeof SKILLS)[number];

export type ProviderName = z.infer<typeof providerNameSchema>;
export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

/** An image or PDF sent with a prompt (vision skills: scheme_extract, transcribe_working, ocr_pages). */
export type ImageInput = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; data: Uint8Array };

/** One model call, provider-neutral. */
export type ProviderRequest = {
  model: string;
  system: string;
  user: string;
  images?: ImageInput[];
  maxOutputTokens: number;
  thinking?: ThinkingLevel;
  /** Ask for a JSON-only reply. */
  json: boolean;
  timeoutMs: number;
};

export type TokenUsage = { input: number; output: number; thinking: number };

export type ProviderResponse = {
  text: string;
  usage: TokenUsage;
  finish: "stop" | "length" | "blocked" | "other";
};

export type ProviderErrorKind = "timeout" | "network" | "http" | "blocked" | "config";

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: ProviderErrorKind,
    readonly status?: number,
    /** Usage the provider still billed for, if it reported any. */
    readonly usage?: TokenUsage,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  /** Timeouts, network drops, 408/409/429 and 5xx (incl. Anthropic's 529 overloaded) may succeed on retry. */
  get retryable() {
    if (this.kind === "timeout" || this.kind === "network") return true;
    if (this.kind !== "http" || this.status === undefined) return false;
    return this.status === 408 || this.status === 409 || this.status === 429 || this.status >= 500;
  }
}

export interface Provider {
  readonly name: ProviderName;
  /** False when its API key isn't configured: the gateway skips it. */
  available(): boolean;
  generate(request: ProviderRequest): Promise<ProviderResponse>;
}
