import "server-only";
import { serverEnv } from "@/lib/env/server";

// Sign-in methods (F0-FR1, 12 §4 Q28): email and password always; emailed 6-digit codes only
// once an email provider (Resend SMTP) is connected in Supabase and AUTH_EMAIL_CODES=true.
export function emailCodesEnabled(): boolean {
  return serverEnv.AUTH_EMAIL_CODES === "true";
}

// Password reset by emailed 6-digit code (12 §4 Q29): needs the same email provider, plus the
// recovery template in supabase/config.toml (Supabase's default reset email has no code).
export function passwordResetEnabled(): boolean {
  return serverEnv.AUTH_PASSWORD_RESET === "true";
}
