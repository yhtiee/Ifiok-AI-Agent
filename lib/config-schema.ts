import { z } from "zod";

// Schemas for app_config values (03 §5, 04 §3, 04 §5, 09 §6). Every value read from the table is
// validated, so a bad admin edit fails loudly instead of silently changing behaviour.

export const providerNameSchema = z.enum(["gemini", "anthropic"]);
export const thinkingLevelSchema = z.enum(["minimal", "low", "medium", "high"]);

export const routeSchema = z.object({
  provider: providerNameSchema,
  model: z.string().min(1),
  thinking: thinkingLevelSchema.optional(),
  max_output_tokens: z.number().int().positive().max(65_536).optional(),
  batch: z.boolean().optional(),
});

export const fallbackRouteSchema = z.object({ provider: providerNameSchema, model: z.string().min(1) });

/** `_fallback` is the default fallback; any other key is a skill name. */
export const aiRoutesSchema = z.record(z.string(), z.unknown()).transform((raw, ctx) => {
  const routes: Record<string, z.infer<typeof routeSchema>> = {};
  let fallback: z.infer<typeof fallbackRouteSchema> | null = null;
  for (const [key, value] of Object.entries(raw)) {
    const parsed = (key === "_fallback" ? fallbackRouteSchema : routeSchema).safeParse(value);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: `ai_routes.${key}: ${parsed.error.issues[0]?.message}` });
      return z.NEVER;
    }
    if (key === "_fallback") fallback = parsed.data;
    else routes[key] = parsed.data as z.infer<typeof routeSchema>;
  }
  return { routes, fallback };
});

export const aiPricesSchema = z.array(
  z.object({
    provider: providerNameSchema,
    model: z.string().min(1),
    effective_from: z.iso.date(),
    /** USD per 1M input tokens */
    input: z.number().nonnegative(),
    /** USD per 1M output tokens (thinking is billed as output) */
    output: z.number().nonnegative(),
  }),
);

export const aiQuotasSchema = z.record(z.string(), z.object({ limit: z.number().int().nonnegative() }));

export const aiCapsSchema = z.object({
  global_daily_usd: z.number().nonnegative(),
  library_daily_usd: z.number().nonnegative(),
  per_user_monthly_usd: z.number().nonnegative(),
  alert_ratio: z.number().min(0).max(1),
});

export const killSwitchesSchema = z.object({
  skills: z.array(z.string()).default([]),
  models: z.array(z.string()).default([]),
});

/** Billing tier per provider key (12 §4 Q25). "free" → actual cost 0 and personal details stripped. */
export const aiBillingSchema = z.object({
  gemini: z.enum(["free", "paid"]).default("paid"),
  anthropic: z.enum(["free", "paid"]).default("paid"),
});

export const CONFIG_SCHEMAS = {
  ai_routes: aiRoutesSchema,
  ai_prices: aiPricesSchema,
  ai_quotas: aiQuotasSchema,
  ai_caps: aiCapsSchema,
  kill_switches: killSwitchesSchema,
  ai_billing: aiBillingSchema,
  economy_enabled: z.boolean(),
} as const;

export type ConfigKey = keyof typeof CONFIG_SCHEMAS;
export type ConfigValue<K extends ConfigKey> = z.output<(typeof CONFIG_SCHEMAS)[K]>;
export type ConfigReader = <K extends ConfigKey>(key: K) => Promise<ConfigValue<K>>;
