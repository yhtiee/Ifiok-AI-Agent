import { lagosDay } from "@ifiok/core";
import type { ConfigReader } from "@/lib/config-schema";
import { costMicros, priceFor } from "./cost";
import { extractJson, findControlCharIssues } from "./json";
import { redactPersonalData } from "./redact";
import { LIBRARY_SKILLS, SKILL_REGISTRY } from "./skills";
import type { SkillDefinition } from "./skills/types";
import {
  ProviderError,
  SKILLS,
  type ImageInput,
  type Provider,
  type ProviderName,
  type ProviderResponse,
  type SkillName,
  type ThinkingLevel,
} from "./types";

// The AI gateway (specifications/04-ai.md §2). Every model call in Ifiok goes through here, on
// the server. Dependencies are injected so the policy, budget and retry rules are unit-tested
// with fake providers; lib/ai/index.ts wires the real ones.

// ---------------------------------------------------------------------------
// Errors: each carries a user-facing message (what happened, what still works)
// ---------------------------------------------------------------------------

export type GatewayErrorCode =
  | "not_allowed"
  | "unavailable"
  | "kill_switched"
  | "invalid_input"
  | "quota_exhausted"
  | "ai_resting"
  | "library_budget"
  | "blocked"
  | "provider_failed"
  | "invalid_output"
  | "busy";

const STATUS: Record<GatewayErrorCode, number> = {
  not_allowed: 403,
  unavailable: 503,
  kill_switched: 503,
  invalid_input: 422,
  quota_exhausted: 429,
  ai_resting: 503,
  library_budget: 503,
  blocked: 422,
  provider_failed: 502,
  invalid_output: 502,
  busy: 503,
};

export class GatewayError extends Error {
  readonly status: number;
  constructor(
    readonly code: GatewayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GatewayError";
    this.status = STATUS[code];
  }
}

const MESSAGES = {
  not_allowed: "Ifiok's AI is for students 18 and older who have agreed to the terms.",
  unavailable: "This AI feature isn't available yet.",
  kill_switched: "This feature is paused for now. Your lessons, labs and practice still work.",
  ai_resting: "Ifiok's AI is resting until tomorrow. Your lessons, labs and practice still work.",
  library_budget: "Your lesson will be ready by tomorrow morning.",
  monthly_ceiling:
    "You've used this month's free AI allowance. It resets on the 1st. Lessons, labs and practice are still free.",
  blocked: "Ifiok can't help with that request.",
  failed: "Ifiok's AI couldn't answer just now. Try again in a minute.",
  busy: "Ifiok's AI is busy right now. Try again in a minute.",
} as const;

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type AiCallRow = {
  user_id: string | null;
  feature: SkillName;
  prompt_version: number;
  provider: ProviderName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  tool_rounds: number;
  /** Actual spend: 0 on a free tier. Drives the budget caps. */
  cost_micros: number;
  /** What the call would cost at paid list prices: the pilot's cost-per-learner metric. */
  list_cost_micros: number;
  ok: boolean;
};

export interface GatewayStore {
  /** null when the profile doesn't exist. */
  loadUserPolicy(userId: string): Promise<{ active: boolean; adult: boolean; consented: boolean } | null>;
  /** Atomic reserve (SQL consume_quota). False when the allowance is used up. */
  consumeQuota(userId: string, feature: string, limit: number): Promise<boolean>;
  refundQuota(userId: string, feature: string): Promise<void>;
  /** Sum of ai_calls.cost_micros since a time (SQL ai_spend_micros). */
  spendSince(since: Date, filter: { userId?: string; features?: readonly string[] }): Promise<number>;
  recordCall(row: AiCallRow): Promise<void>;
}

export type GatewayEvent =
  | { type: "cap_alert"; spentMicros: number; capMicros: number }
  | { type: "provider_error"; skill: SkillName; provider: ProviderName; kind: string; status?: number }
  | { type: "refund_failed"; skill: SkillName }
  | { type: "missing_price"; provider: ProviderName; model: string }
  | { type: "redacted"; skill: SkillName; count: number };

export type GatewayDeps = {
  config: ConfigReader;
  providers: Record<ProviderName, Provider>;
  store: GatewayStore;
  registry?: Partial<Record<SkillName, SkillDefinition>>;
  now?: () => Date;
  /** Metadata only: never prompts, outputs or user content (04 §2.7, CLAUDE.md guardrail 10). */
  log?: (event: GatewayEvent) => void;
};

export type RunOptions = {
  userId: string | null;
  input: unknown;
  images?: ImageInput[];
  /**
   * "interactive" (route handlers): 25 s timeout, one retry, then the fallback provider.
   * "job" (queued work): one call per invocation, ≤ 100 s; the queue retries, and attempt 2+
   * goes to the fallback provider (04 §2 step 4).
   */
  mode?: "interactive" | "job";
  attempt?: number;
};

export type RunResult<O> = {
  output: O;
  provider: ProviderName;
  model: string;
  costMicros: number;
  calls: number;
  repaired: boolean;
};

const INTERACTIVE_TIMEOUT_MS = 25_000;
const JOB_TIMEOUT_MS = 100_000;
/** The most a truncated reply's retry may ask for. */
const MAX_OUTPUT_CEILING = 16_000;
const USD = 1_000_000; // micro-USD per USD

/** Midnight in Lagos (UTC+1, no daylight saving) for the day / month containing `now`. */
function lagosStart(now: Date, unit: "day" | "month"): Date {
  const day = lagosDay(now);
  return new Date(`${unit === "day" ? day : `${day.slice(0, 7)}-01`}T00:00:00+01:00`);
}

const PER_LEARNER_SKILLS = SKILLS.filter((s) => !LIBRARY_SKILLS.includes(s));

type Candidate = {
  provider: Provider;
  model: string;
  thinking?: ThinkingLevel;
  price: { input: number; output: number };
  /** Free tier: costs nothing, and personal details are stripped before sending (12 §4 Q25). */
  free: boolean;
};

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

export function createGateway(deps: GatewayDeps) {
  const registry = deps.registry ?? SKILL_REGISTRY;
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});

  async function run<O>(skillName: SkillName, options: RunOptions): Promise<RunResult<O>> {
    const skill = registry[skillName] as SkillDefinition<unknown, O> | undefined;
    if (!skill) throw new GatewayError("unavailable", MESSAGES.unavailable);

    const input = skill.inputSchema.safeParse(options.input);
    if (!input.success) {
      throw new GatewayError(
        "invalid_input",
        `That request isn't valid: ${input.error.issues[0]?.message ?? "bad input"}.`,
      );
    }

    // 1. Policy: adult, active, agreed to the current terms (guardrail 8). System jobs pass null.
    if (options.userId) {
      const policy = await deps.store.loadUserPolicy(options.userId);
      if (!policy || !policy.active || !policy.adult || !policy.consented) {
        throw new GatewayError("not_allowed", MESSAGES.not_allowed);
      }
    }

    const [{ routes, fallback }, prices, caps, kills, quotas, billing] = await Promise.all([
      deps.config("ai_routes"),
      deps.config("ai_prices"),
      deps.config("ai_caps"),
      deps.config("kill_switches"),
      deps.config("ai_quotas"),
      deps.config("ai_billing"),
    ]);
    if (kills.skills.includes(skillName)) throw new GatewayError("kill_switched", MESSAGES.kill_switched);

    // Route: the skill's model, then the fallback provider (04 §3). Skip providers without keys,
    // killed models, and anything without a price (we never spend money we can't count).
    const route = routes[skillName];
    if (!route) throw new GatewayError("unavailable", MESSAGES.unavailable);
    const at = now();
    const candidates: Candidate[] = [];
    for (const c of [
      { provider: route.provider, model: route.model, thinking: route.thinking },
      ...(fallback && !(fallback.provider === route.provider && fallback.model === route.model) ? [fallback] : []),
    ]) {
      const provider = deps.providers[c.provider];
      if (!provider.available() || kills.models.includes(c.model)) continue;
      const price = priceFor(prices, c.provider, c.model, at);
      if (!price) {
        log({ type: "missing_price", provider: c.provider, model: c.model });
        continue;
      }
      candidates.push({
        provider,
        model: c.model,
        thinking: "thinking" in c ? c.thinking : undefined,
        price,
        free: billing[c.provider] === "free",
      });
    }
    if (candidates.length === 0) throw new GatewayError("unavailable", MESSAGES.unavailable);

    // 2. Budgets: check the caps, then reserve the user's allowance before calling (04 §5).
    const dayStart = lagosStart(at, "day");
    if (skill.library) {
      const spent = await deps.store.spendSince(dayStart, { features: LIBRARY_SKILLS });
      if (spent >= caps.library_daily_usd * USD) throw new GatewayError("library_budget", MESSAGES.library_budget);
    } else if (!skill.capExempt) {
      const spent = await deps.store.spendSince(dayStart, { features: PER_LEARNER_SKILLS });
      const cap = caps.global_daily_usd * USD;
      if (spent >= cap) throw new GatewayError("ai_resting", MESSAGES.ai_resting);
      if (spent >= cap * caps.alert_ratio) log({ type: "cap_alert", spentMicros: spent, capMicros: cap });
    }
    if (options.userId && !skill.library && !skill.capExempt) {
      const monthSpent = await deps.store.spendSince(lagosStart(at, "month"), { userId: options.userId });
      if (monthSpent >= caps.per_user_monthly_usd * USD) {
        throw new GatewayError("quota_exhausted", MESSAGES.monthly_ceiling);
      }
    }

    let reserved: { userId: string; feature: string } | null = null;
    if (options.userId && skill.quotaFeature) {
      const limit = quotas[skill.quotaFeature]?.limit ?? 0;
      const ok = await deps.store.consumeQuota(options.userId, skill.quotaFeature, limit);
      if (!ok) {
        throw new GatewayError(
          "quota_exhausted",
          skill.quotaMessage?.(limit) ?? "You've used today's free allowance. It resets at midnight.",
        );
      }
      reserved = { userId: options.userId, feature: skill.quotaFeature };
    }

    // 3–6. Call, validate, record. Refund the reservation if nothing usable comes back.
    try {
      return await callAndValidate(skillName, skill, input.data, options, candidates, route.max_output_tokens);
    } catch (err) {
      if (reserved) {
        await deps.store
          .refundQuota(reserved.userId, reserved.feature)
          .catch(() => log({ type: "refund_failed", skill: skillName }));
      }
      throw err;
    }
  }

  async function callAndValidate<O>(
    skillName: SkillName,
    skill: SkillDefinition<unknown, O>,
    input: unknown,
    options: RunOptions,
    candidates: Candidate[],
    maxOutput: number | undefined,
  ): Promise<RunResult<O>> {
    const prompt = skill.buildPrompt(input);
    const mode = options.mode ?? "interactive";
    let calls = 0;
    let totalCost = 0;

    const call = async (
      candidate: Candidate,
      rawUser: string,
      maxTokens: number | undefined = maxOutput,
    ): Promise<ProviderResponse> => {
      calls++;
      // Free tier: never send personal details (Gemini terms for Unpaid Services).
      let user = rawUser;
      if (candidate.free) {
        const redaction = redactPersonalData(rawUser);
        user = redaction.text;
        if (redaction.redacted) log({ type: "redacted", skill: skillName, count: redaction.redacted });
      }
      const row = (usage: { input: number; output: number; thinking: number }, ok: boolean): AiCallRow => {
        const listCost = costMicros(candidate.price, usage);
        const cost = candidate.free ? 0 : listCost;
        totalCost += cost;
        return {
          user_id: options.userId,
          feature: skillName,
          prompt_version: skill.promptVersion,
          provider: candidate.provider.name,
          model: candidate.model,
          input_tokens: usage.input,
          output_tokens: usage.output,
          thinking_tokens: usage.thinking,
          tool_rounds: 0,
          cost_micros: cost,
          list_cost_micros: listCost,
          ok,
        };
      };
      try {
        const response = await candidate.provider.generate({
          model: candidate.model,
          system: prompt.system,
          user,
          images: options.images,
          maxOutputTokens: maxTokens,
          thinking: candidate.thinking,
          json: true,
          timeoutMs: mode === "job" ? JOB_TIMEOUT_MS : INTERACTIVE_TIMEOUT_MS,
        });
        await deps.store.recordCall(row(response.usage, true));
        return response;
      } catch (err) {
        const pe = err instanceof ProviderError ? err : new ProviderError("Unexpected provider error", "network");
        await deps.store.recordCall(row(pe.usage ?? { input: 0, output: 0, thinking: 0 }, false));
        log({
          type: "provider_error",
          skill: skillName,
          provider: candidate.provider.name,
          kind: pe.kind,
          status: pe.status,
        });
        throw pe;
      }
    };

    // Which candidates to try, in order.
    const primary = candidates[0]!;
    const backup = candidates[1];
    const plan: Candidate[] =
      mode === "job"
        ? [(options.attempt ?? 1) >= 2 && backup ? backup : primary]
        : [primary, primary, ...(backup ? [backup] : [])];

    let response: ProviderResponse | null = null;
    let used: Candidate = primary;
    let lastError: ProviderError | null = null;
    for (let i = 0; i < plan.length; i++) {
      const candidate = plan[i]!;
      // The same-provider retry only happens after a retryable error, and never straight after a
      // rate limit (429): retrying at once only burns the free tier's per-minute allowance.
      if (i === 1 && candidate === primary && lastError && (!lastError.retryable || lastError.status === 429)) continue;
      try {
        response = await call(candidate, prompt.user);
        used = candidate;
        break;
      } catch (err) {
        lastError = err as ProviderError;
        if (lastError.kind === "blocked") throw new GatewayError("blocked", MESSAGES.blocked);
      }
    }
    if (!response) {
      if (lastError?.status === 429) throw new GatewayError("busy", MESSAGES.busy);
      throw new GatewayError("provider_failed", MESSAGES.failed);
    }

    // 5. Parse and validate; one repair retry with the validator's messages, then fail.
    const first = parseOutput(response.text, skill);
    if (first.ok) {
      return {
        output: first.value,
        provider: used.provider.name,
        model: used.model,
        costMicros: totalCost,
        calls,
        repaired: false,
      };
    }

    const retry = async (user: string, maxTokens: number | undefined) => {
      try {
        return await call(used, user, maxTokens);
      } catch (err) {
        if (err instanceof ProviderError && err.kind === "blocked") throw new GatewayError("blocked", MESSAGES.blocked);
        throw new GatewayError("provider_failed", MESSAGES.failed);
      }
    };

    // A reply cut off at a configured token cap can't be repaired at the same cap: ask again once
    // with double the budget instead. Uncapped skills (the default, 12 §4 Q27) skip this.
    let budget = maxOutput;
    if (response.finish === "length" && budget !== undefined) {
      budget = Math.min(budget * 2, MAX_OUTPUT_CEILING);
      const longer = await retry(prompt.user, budget);
      const reparsed = parseOutput(longer.text, skill);
      if (reparsed.ok) {
        return {
          output: reparsed.value,
          provider: used.provider.name,
          model: used.model,
          costMicros: totalCost,
          calls,
          repaired: true,
        };
      }
      if (longer.finish === "length") throw new GatewayError("invalid_output", MESSAGES.failed);
      response = longer;
    }

    const latest = parseOutput(response.text, skill);
    const errors = latest.ok ? first.errors : latest.errors;
    const repairResponse = await retry(repairPrompt(prompt.user, response.text, errors), budget);
    const second = parseOutput(repairResponse.text, skill);
    if (!second.ok) throw new GatewayError("invalid_output", MESSAGES.failed);
    return {
      output: second.value,
      provider: used.provider.name,
      model: used.model,
      costMicros: totalCost,
      calls,
      repaired: true,
    };
  }

  return { run };
}

export type Gateway = ReturnType<typeof createGateway>;

// ---------------------------------------------------------------------------

function parseOutput<O>(
  text: string,
  skill: SkillDefinition<unknown, O>,
): { ok: true; value: O } | { ok: false; errors: string[] } {
  let json: unknown;
  try {
    json = extractJson(text);
  } catch {
    return {
      ok: false,
      errors: ["The reply was not valid JSON (it may have been cut off). Return one complete JSON object."],
    };
  }
  const controlIssues = findControlCharIssues(json);
  if (controlIssues.length) return { ok: false, errors: controlIssues };
  const parsed = skill.outputSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  }
  return { ok: true, value: parsed.data };
}

function repairPrompt(originalUser: string, badReply: string, errors: string[]): string {
  return [
    originalUser,
    "",
    "Your previous reply could not be used:",
    ...errors.slice(0, 20).map((e) => `- ${e}`),
    "",
    "Previous reply:",
    badReply.slice(0, 8000),
    "",
    "Return the corrected JSON only.",
  ].join("\n");
}
