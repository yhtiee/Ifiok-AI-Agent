import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CONFIG_SCHEMAS, type ConfigKey, type ConfigReader } from "@/lib/config-schema";
import { createGateway, GatewayError, type AiCallRow, type GatewayStore } from "./gateway";
import { defineSkill, type SkillDefinition } from "./skills/types";
import { ProviderError, type Provider, type ProviderName, type ProviderRequest, type ProviderResponse } from "./types";

// P0-10 "Done when", with mocked providers and an in-memory store.

const NOW = new Date("2026-10-10T11:00:00Z");
const USER = "00000000-0000-0000-0000-0000000000aa";

const rawConfig: Record<ConfigKey, unknown> = {
  ai_routes: {
    moderate: { provider: "gemini", model: "flash-lite", thinking: "minimal", max_output_tokens: 200 },
    tutor_chat: { provider: "gemini", model: "flash-lite", thinking: "minimal", max_output_tokens: 700 },
    lesson_generate: { provider: "gemini", model: "flash", thinking: "low", max_output_tokens: 6000 },
    brief_rewrite: { provider: "gemini", model: "flash-lite" },
    _fallback: { provider: "anthropic", model: "haiku" },
  },
  ai_prices: [
    { provider: "gemini", model: "flash-lite", effective_from: "2026-01-01", input: 0.25, output: 1.5 },
    { provider: "gemini", model: "flash", effective_from: "2026-01-01", input: 0.75, output: 3.75 },
    { provider: "gemini", model: "flash", effective_from: "2027-01-01", input: 1.5, output: 7.5 },
    { provider: "anthropic", model: "haiku", effective_from: "2026-01-01", input: 1, output: 5 },
  ],
  ai_quotas: { tutor: { limit: 2 } },
  ai_caps: { global_daily_usd: 3, library_daily_usd: 20, per_user_monthly_usd: 0.3, alert_ratio: 0.8 },
  kill_switches: { skills: [], models: [] },
  ai_billing: { gemini: "paid", anthropic: "paid" },
  economy_enabled: false,
};

function configReader(overrides: Partial<Record<ConfigKey, unknown>> = {}): ConfigReader {
  return (async (key: ConfigKey) => CONFIG_SCHEMAS[key].parse(overrides[key] ?? rawConfig[key])) as ConfigReader;
}

// Test skills (real skills register themselves in lib/ai/skills).
const out = z.object({ answer: z.string() });
const mk = (name: SkillDefinition["name"], extra: Partial<SkillDefinition> = {}): SkillDefinition => ({
  ...(defineSkill({
    name,
    inputSchema: z.object({ q: z.string().min(1) }),
    outputSchema: out,
    promptVersion: 3,
    buildPrompt: ({ q }) => ({ system: "sys", user: q }),
  }) as SkillDefinition),
  ...extra,
});

const registry = {
  tutor_chat: mk("tutor_chat", { quotaFeature: "tutor", quotaMessage: (n) => `You've used today's ${n} questions.` }),
  moderate: mk("moderate", { capExempt: true }),
  brief_rewrite: mk("brief_rewrite"),
  lesson_generate: mk("lesson_generate", { library: true }),
};

type Step = ProviderResponse | ProviderError;
const ok = (text: string, usage = { input: 1000, output: 200, thinking: 100 }): ProviderResponse => ({
  text,
  usage,
  finish: "stop",
});

function fakeProvider(name: ProviderName, steps: Step[], available = true) {
  const requests: ProviderRequest[] = [];
  const provider: Provider = {
    name,
    available: () => available,
    async generate(req) {
      requests.push(req);
      const step = steps.shift();
      if (!step) throw new Error(`${name}: no more scripted replies`);
      if (step instanceof ProviderError) throw step;
      return step;
    },
  };
  return { provider, requests };
}

function memoryStore(
  opts: { adult?: boolean; consented?: boolean; spendMicros?: number; monthSpendMicros?: number } = {},
) {
  const usage = new Map<string, number>();
  const calls: AiCallRow[] = [];
  const refunds: string[] = [];
  const store: GatewayStore = {
    async loadUserPolicy() {
      return { active: true, adult: opts.adult ?? true, consented: opts.consented ?? true };
    },
    async consumeQuota(userId, feature, limit) {
      // Same semantics as SQL consume_quota: atomic check-and-increment.
      const key = `${userId}:${feature}`;
      const used = usage.get(key) ?? 0;
      if (limit <= 0 || used >= limit) return false;
      usage.set(key, used + 1);
      return true;
    },
    async refundQuota(userId, feature) {
      const key = `${userId}:${feature}`;
      usage.set(key, Math.max(0, (usage.get(key) ?? 0) - 1));
      refunds.push(feature);
    },
    async spendSince(_since, filter) {
      if (filter.userId) return opts.monthSpendMicros ?? 0;
      return opts.spendMicros ?? 0;
    },
    async recordCall(row) {
      calls.push(row);
    },
  };
  return { store, usage, calls, refunds };
}

function setup(
  steps: { gemini?: Step[]; anthropic?: Step[]; anthropicAvailable?: boolean } = {},
  storeOpts: Parameters<typeof memoryStore>[0] = {},
  configOverrides: Partial<Record<ConfigKey, unknown>> = {},
) {
  const gemini = fakeProvider("gemini", steps.gemini ?? []);
  const anthropic = fakeProvider("anthropic", steps.anthropic ?? [], steps.anthropicAvailable ?? true);
  const mem = memoryStore(storeOpts);
  const events: unknown[] = [];
  const gateway = createGateway({
    config: configReader(configOverrides),
    providers: { gemini: gemini.provider, anthropic: anthropic.provider },
    store: mem.store,
    registry,
    now: () => NOW,
    log: (e) => events.push(e),
  });
  return { gateway, gemini, anthropic, ...mem, events };
}

const run = (g: ReturnType<typeof setup>["gateway"], skill: keyof typeof registry, userId: string | null = USER) =>
  g.run<{ answer: string }>(skill, { userId, input: { q: "What is a limit?" } });

async function expectCode(promise: Promise<unknown>, code: string) {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(GatewayError);
  expect((err as GatewayError).code).toBe(code);
  return err as GatewayError;
}

describe("policy", () => {
  it("blocks minors and users without consent before any model call", async () => {
    for (const storeOpts of [{ adult: false }, { consented: false }]) {
      const t = setup({ gemini: [ok('{"answer":"x"}')] }, storeOpts);
      await expectCode(run(t.gateway, "tutor_chat"), "not_allowed");
      expect(t.gemini.requests).toHaveLength(0);
      expect(t.usage.size).toBe(0);
    }
  });

  it("blocks kill-switched skills and skips kill-switched models", async () => {
    const t = setup({}, {}, { kill_switches: { skills: ["tutor_chat"], models: [] } });
    await expectCode(run(t.gateway, "tutor_chat"), "kill_switched");

    const m = setup(
      { anthropic: [ok('{"answer":"from fallback"}')] },
      {},
      { kill_switches: { skills: [], models: ["flash-lite"] } },
    );
    const result = await run(m.gateway, "tutor_chat");
    expect(result.provider).toBe("anthropic");
    expect(m.gemini.requests).toHaveLength(0);
  });

  it("rejects input that fails the skill's schema", async () => {
    const t = setup();
    await expectCode(t.gateway.run("tutor_chat", { userId: USER, input: { q: "" } }), "invalid_input");
  });
});

describe("budgets", () => {
  it("parallel requests can't exceed a quota", async () => {
    const replies = Array.from({ length: 6 }, () => ok('{"answer":"ok"}'));
    const t = setup({ gemini: replies });
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => run(t.gateway, "tutor_chat")));
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(2); // limit 2
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => (r.reason as GatewayError).code === "quota_exhausted")).toBe(true);
    expect((rejected[0]!.reason as GatewayError).message).toBe("You've used today's 2 questions.");
  });

  it("a failed call refunds the quota", async () => {
    const fail = () => new ProviderError("down", "http", 500);
    const t = setup({ gemini: [fail(), fail()], anthropicAvailable: false });
    await expectCode(run(t.gateway, "tutor_chat"), "provider_failed");
    expect(t.refunds).toEqual(["tutor"]);
    expect(t.usage.get(`${USER}:tutor`)).toBe(0);
  });

  it("invalid output after the repair retry also refunds the quota", async () => {
    const t = setup({ gemini: [ok("not json"), ok("still not json")] });
    await expectCode(run(t.gateway, "tutor_chat"), "invalid_output");
    expect(t.refunds).toEqual(["tutor"]);
  });

  it("the global cap switches off non-essential skills, but not cap-exempt safety checks", async () => {
    const t = setup({ gemini: [ok('{"answer":"safe"}')] }, { spendMicros: 3_000_000 });
    const err = await expectCode(run(t.gateway, "brief_rewrite"), "ai_resting");
    expect(err.message).toBe("Ifiok's AI is resting until tomorrow. Your lessons, labs and practice still work.");
    await expectCode(run(t.gateway, "tutor_chat"), "ai_resting");
    await expect(run(t.gateway, "moderate")).resolves.toMatchObject({ output: { answer: "safe" } });
  });

  it("raises a cap alert at 80% of the daily cap", async () => {
    const t = setup({ gemini: [ok('{"answer":"x"}')] }, { spendMicros: 2_500_000 });
    await run(t.gateway, "brief_rewrite");
    expect(t.events).toContainEqual({ type: "cap_alert", spentMicros: 2_500_000, capMicros: 3_000_000 });
  });

  it("library skills use their own budget", async () => {
    const t = setup({}, { spendMicros: 20_000_000 });
    await expectCode(run(t.gateway, "lesson_generate", null), "library_budget");
  });

  it("stops at the per-user monthly ceiling", async () => {
    const t = setup({}, { monthSpendMicros: 300_000 });
    const err = await expectCode(run(t.gateway, "brief_rewrite"), "quota_exhausted");
    expect(err.message).toContain("resets on the 1st");
  });
});

describe("routing and retries", () => {
  it("retries once on a 5xx, then uses the fallback provider", async () => {
    const t = setup({
      gemini: [new ProviderError("down", "http", 503), new ProviderError("down", "http", 503)],
      anthropic: [ok('{"answer":"from claude"}', { input: 500, output: 50, thinking: 0 })],
    });
    const result = await run(t.gateway, "tutor_chat");
    expect(result).toMatchObject({
      provider: "anthropic",
      model: "haiku",
      output: { answer: "from claude" },
      calls: 3,
    });
    expect(t.calls.map((c) => [c.provider, c.ok])).toEqual([
      ["gemini", false],
      ["gemini", false],
      ["anthropic", true],
    ]);
  });

  it("doesn't retry the same provider after a non-retryable error", async () => {
    const t = setup({ gemini: [new ProviderError("bad", "http", 400)], anthropic: [ok('{"answer":"ok"}')] });
    await run(t.gateway, "tutor_chat");
    expect(t.gemini.requests).toHaveLength(1);
  });

  it("skips a fallback provider that has no API key", async () => {
    const t = setup({
      gemini: [new ProviderError("x", "timeout"), new ProviderError("x", "timeout")],
      anthropicAvailable: false,
    });
    await expectCode(run(t.gateway, "tutor_chat"), "provider_failed");
    expect(t.anthropic.requests).toHaveLength(0);
  });

  it("queued jobs make one call per attempt and use the fallback from attempt 2", async () => {
    const t = setup({ gemini: [new ProviderError("down", "http", 500)], anthropic: [ok('{"answer":"ok"}')] });
    await expectCode(
      t.gateway.run("lesson_generate", { userId: null, input: { q: "x" }, mode: "job" }),
      "provider_failed",
    );
    expect(t.gemini.requests).toHaveLength(1);
    expect(t.gemini.requests[0]!.timeoutMs).toBe(100_000);
    const second = await t.gateway.run("lesson_generate", { userId: null, input: { q: "x" }, mode: "job", attempt: 2 });
    expect(second.provider).toBe("anthropic");
  });

  it("passes the route's model, thinking level and token limit to the provider", async () => {
    const t = setup({ gemini: [ok('{"answer":"ok"}')] });
    await run(t.gateway, "tutor_chat");
    expect(t.gemini.requests[0]).toMatchObject({
      model: "flash-lite",
      thinking: "minimal",
      maxOutputTokens: 700,
      json: true,
      timeoutMs: 25_000,
    });
  });

  it("a blocked prompt fails without falling back", async () => {
    const t = setup({ gemini: [new ProviderError("blocked", "blocked", 200)], anthropic: [ok('{"answer":"x"}')] });
    await expectCode(run(t.gateway, "tutor_chat"), "blocked");
    expect(t.anthropic.requests).toHaveLength(0);
  });
});

describe("output validation", () => {
  it("invalid JSON triggers one repair retry with the errors, then succeeds", async () => {
    const t = setup({ gemini: [ok("Sure! Here you go"), ok('```json\n{"answer":"fixed"}\n```')] });
    const result = await run(t.gateway, "tutor_chat");
    expect(result).toMatchObject({ output: { answer: "fixed" }, repaired: true, calls: 2 });
    expect(t.gemini.requests[1]!.user).toContain("could not be used");
  });

  it("control characters next to letters (an unescaped LaTeX backslash) trigger the repair retry", async () => {
    // "\frac" written without escaping the backslash arrives as form feed + "rac".
    const t = setup({ gemini: [ok('{"answer":"\\frac{1}{2}"}'), ok('{"answer":"\\\\frac{1}{2}"}')] });
    const result = await run(t.gateway, "tutor_chat");
    expect(result.repaired).toBe(true);
    expect(result.output.answer).toBe("\\frac{1}{2}");
    expect(t.gemini.requests[1]!.user).toContain("control character");
  });

  it("fails after one repair attempt", async () => {
    const t = setup({ gemini: [ok("{}"), ok('{"wrong":1}')] });
    await expectCode(run(t.gateway, "tutor_chat"), "invalid_output");
    expect(t.gemini.requests).toHaveLength(2);
  });
});

describe("cost records", () => {
  it("writes an ai_calls row for every call, with thinking tokens billed as output", async () => {
    const t = setup({ gemini: [ok('{"answer":"ok"}', { input: 1000, output: 200, thinking: 100 })] });
    const result = await run(t.gateway, "tutor_chat");
    // flash-lite: 1000 × $0.25 + (200 + 100) × $1.50 per 1M = 250 + 450 micro-USD
    expect(t.calls).toEqual([
      {
        user_id: USER,
        feature: "tutor_chat",
        prompt_version: 3,
        provider: "gemini",
        model: "flash-lite",
        input_tokens: 1000,
        output_tokens: 200,
        thinking_tokens: 100,
        tool_rounds: 0,
        cost_micros: 700,
        list_cost_micros: 700,
        ok: true,
      },
    ]);
    expect(result.costMicros).toBe(700);
  });

  it("uses the price in force on the day (the January 2027 Flash change applies automatically)", async () => {
    const usage = { input: 1_000_000, output: 0, thinking: 0 };
    const before = setup({ gemini: [ok('{"answer":"ok"}', usage)] });
    await before.gateway.run("lesson_generate", { userId: null, input: { q: "x" } });
    expect(before.calls[0]!.cost_micros).toBe(750_000);

    const after = createGateway({
      config: configReader(),
      providers: {
        gemini: fakeProvider("gemini", [ok('{"answer":"ok"}', usage)]).provider,
        anthropic: fakeProvider("anthropic", []).provider,
      },
      store: memoryStore().store,
      registry,
      now: () => new Date("2027-01-02T10:00:00Z"),
    });
    const res = await after.run("lesson_generate", { userId: null, input: { q: "x" } });
    expect(res.costMicros).toBe(1_500_000);
  });

  it("never calls a model it has no price for", async () => {
    const t = setup({}, {}, { ai_prices: [] });
    await expectCode(run(t.gateway, "tutor_chat"), "unavailable");
    expect(t.events).toContainEqual({ type: "missing_price", provider: "gemini", model: "flash-lite" });
  });
});

describe("free tier (12 §4 Q25)", () => {
  const free = { ai_billing: { gemini: "free", anthropic: "paid" } };

  it("records zero actual cost but the paid list price, so caps don't bite and the pilot still measures cost", async () => {
    const t = setup({ gemini: [ok('{"answer":"ok"}', { input: 1000, output: 200, thinking: 100 })] }, {}, free);
    const result = await run(t.gateway, "tutor_chat");
    expect(t.calls[0]).toMatchObject({ cost_micros: 0, list_cost_micros: 700 });
    expect(result.costMicros).toBe(0);
  });

  it("strips personal details from text before it reaches a free-tier provider", async () => {
    const t = setup({ gemini: [ok('{"answer":"ok"}')] }, {}, free);
    await t.gateway.run("tutor_chat", {
      userId: USER,
      input: { q: "Call me on 08031234567 or ada@gmail.com about limits" },
    });
    expect(t.gemini.requests[0]!.user).toBe("Call me on [phone number removed] or [email removed] about limits");
    expect(t.events).toContainEqual({ type: "redacted", skill: "tutor_chat", count: 2 });
  });

  it("sends text unchanged to a paid provider", async () => {
    const t = setup({ gemini: [ok('{"answer":"ok"}')] });
    await t.gateway.run("tutor_chat", { userId: USER, input: { q: "Call 08031234567" } });
    expect(t.gemini.requests[0]!.user).toBe("Call 08031234567");
  });

  it("on a rate limit (429) it doesn't retry at once: it falls back, or says the AI is busy", async () => {
    const limited = () => new ProviderError("rate limited", "http", 429);
    const withFallback = setup({ gemini: [limited()], anthropic: [ok('{"answer":"ok"}')] }, {}, free);
    await expect(run(withFallback.gateway, "tutor_chat")).resolves.toMatchObject({ provider: "anthropic" });
    expect(withFallback.gemini.requests).toHaveLength(1);

    const alone = setup({ gemini: [limited()], anthropicAvailable: false }, {}, free);
    const err = await expectCode(run(alone.gateway, "tutor_chat"), "busy");
    expect(err.message).toBe("Ifiok's AI is busy right now. Try again in a minute.");
    expect(alone.gemini.requests).toHaveLength(1);
    expect(alone.refunds).toEqual(["tutor"]);
  });
});
