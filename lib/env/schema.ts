import { z } from "zod";

// Environment variables (specifications/02-architecture.md §9). Validated at boot from
// next.config.ts, so `next dev` / `next build` stop with a clear message when one is wrong.
//
// Variables needed by tickets that haven't landed yet are optional here; the ticket that
// first uses one makes it required (and reads it through `requireServerEnv`).

const url = z.url({ protocol: /^https?$/ });
const nonEmpty = z.string().trim().min(1);

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: url,
  /** Supabase publishable key (`sb_publishable_…`). Replaces the legacy anon key; see 12 §4. */
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
  /** Absolute origin for canonical and share-image URLs. */
  NEXT_PUBLIC_SITE_URL: url.optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: nonEmpty.optional(), // P2-03
  /** Contact addresses shown on legal and age-gate pages once the domain exists (12 §4 Q7). */
  NEXT_PUBLIC_PRIVACY_EMAIL: z.email().optional(),
  NEXT_PUBLIC_MINORS_EMAIL: z.email().optional(),
});

export const serverEnvSchema = publicEnvSchema.extend({
  /** Supabase secret key (`sb_secret_…`, or the legacy service_role JWT). Server only. */
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty.optional(), // P0-04
  GEMINI_API_KEY: nonEmpty.optional(), // P0-10
  ANTHROPIC_API_KEY: nonEmpty.optional(), // P0-10
  PAYSTACK_SECRET_KEY: nonEmpty.optional(), // P2-03
  RESEND_API_KEY: nonEmpty.optional(), // P0-04 (Auth SMTP)
  VAPID_PUBLIC_KEY: nonEmpty.optional(), // P1-12
  VAPID_PRIVATE_KEY: nonEmpty.optional(), // P1-12
  SENTRY_DSN: url.optional(), // P0-14
  POSTHOG_KEY: nonEmpty.optional(), // P0-14
  TURNSTILE_SITE_KEY: nonEmpty.optional(), // P0-04
  TURNSTILE_SECRET_KEY: nonEmpty.optional(), // P0-04
  GROQ_API_KEY: nonEmpty.optional(), // P3
  /** Shared secret for server-to-server Edge Function calls (embed). Also set in Supabase secrets. */
  INTERNAL_FUNCTION_SECRET: nonEmpty.optional(), // P1-01
  /** "true" once an email provider (Resend SMTP) is connected: turns on email sign-in codes. */
  AUTH_EMAIL_CODES: z.enum(["true", "false"]).optional(),
  /** "true" lets `next dev` sign in without email. Ignored in production builds. */
  AUTH_DEV_SIGN_IN: z.enum(["true", "false"]).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Treat empty strings as unset, so `KEY=` in a .env file reads as missing. */
function clean(source: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v.trim() !== ""));
}

/** Parse env vars, or throw one error that names every bad variable and how to fix it. */
export function parseEnv<S extends z.ZodType>(schema: S, source: Record<string, string | undefined>): z.infer<S> {
  const result = schema.safeParse(clean(source));
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = issue.path.join(".");
    const missing = issue.code === "invalid_type" && issue.input === undefined;
    return `  - ${name}: ${missing ? "missing" : issue.message}`;
  });
  throw new Error(
    [
      "Ifiok can't start: some environment variables are missing or invalid.",
      ...lines,
      "Add them to .env.local (see .env.example for the full list), then restart.",
    ].join("\n"),
  );
}
