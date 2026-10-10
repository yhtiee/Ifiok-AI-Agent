import "server-only";
import { serverEnv } from "@/lib/env/server";

/**
 * How email sign-in works right now:
 * - "code": 6-digit email codes (needs an email provider connected in Supabase).
 * - "dev":  `next dev` only, no email: the server signs the address in directly.
 * - "off":  no email provider yet and not in development; only Google (if enabled).
 */
export type EmailSignInMode = "code" | "dev" | "off";

export function emailSignInMode(): EmailSignInMode {
  if (serverEnv.AUTH_EMAIL_CODES === "true") return "code";
  // NODE_ENV is "production" in every `next build`, so this can never be on in a deployment.
  if (process.env.NODE_ENV === "development" && serverEnv.AUTH_DEV_SIGN_IN === "true") return "dev";
  return "off";
}
