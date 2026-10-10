"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/onboarding";
import { parseNames } from "@/lib/auth/names";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { emailCodesEnabled } from "@/lib/auth/sign-in-mode";
import { siteOrigin } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// Sign-in (F0-FR1, with 12 §4 Q28): email and password, in every environment. Emailed 6-digit
// codes are an extra option once an email provider is connected (AUTH_EMAIL_CODES=true).

/** `field` says which input the message belongs under. */
export type PasswordState =
  { status: "idle" } | { status: "error"; field: "first_name" | "last_name" | "email" | "password"; message: string };

export type SendCodeState =
  | { status: "idle" }
  | { status: "sent"; email: string; sentAt: number }
  | { status: "error"; message: string; email?: string };

export type VerifyState = { status: "idle" } | { status: "error"; message: string };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

const BAD_EMAIL = "Enter a full email address, like ada@gmail.com.";
const TOO_MANY = "Too many attempts. Wait a minute, then try again.";

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}

function readCredentials(form: FormData) {
  return {
    email: emailSchema.safeParse(form.get("email")),
    password: String(form.get("password") ?? ""),
    next: safeNextPath(String(form.get("next") ?? "")),
  };
}

// ---------------------------------------------------------------------------
// Email and password
// ---------------------------------------------------------------------------

/** Sign in an existing account. Onboarding guards send new or unfinished accounts to their next step. */
export async function signInWithPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const { email, password, next } = readCredentials(form);
  if (!email.success) return { status: "error", field: "email", message: BAD_EMAIL };
  if (!password) return { status: "error", field: "password", message: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) {
    if (error.status === 429) return { status: "error", field: "password", message: TOO_MANY };
    // One message for a wrong email or password: don't reveal which accounts exist.
    return {
      status: "error",
      field: "password",
      message: "That email and password don't match. Check both, or create an account if you're new.",
    };
  }
  redirect(next);
}

const ALREADY_EXISTS = "There's already an account with this email. Sign in instead.";

/** Create an account. With no confirmation email (Q28), the account is active and signed in at once. */
export async function signUpWithPassword(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const names = parseNames(form.get("first_name"), form.get("last_name"));
  if (!names.ok) return { status: "error", field: names.field, message: names.message };
  const { email, password, next } = readCredentials(form);
  if (!email.success) return { status: "error", field: "email", message: BAD_EMAIL };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      field: "password",
      message: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password,
    options: {
      emailRedirectTo: callbackUrl(await siteOrigin(), next),
      // Copied to the profile by handle_new_user (Q30).
      data: { first_name: names.first, last_name: names.last },
    },
  });
  if (error) {
    if (error.status === 429) return { status: "error", field: "password", message: TOO_MANY };
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "error", field: "email", message: ALREADY_EXISTS };
    }
    if (error.code === "weak_password") {
      return {
        status: "error",
        field: "password",
        message: "Choose a stronger password: longer, and not a common one.",
      };
    }
    return {
      status: "error",
      field: "password",
      message: "Couldn't create the account. Check the details and try again.",
    };
  }
  // Supabase hides whether an email is taken by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0) {
    return { status: "error", field: "email", message: ALREADY_EXISTS };
  }
  if (!data.session) {
    // Only happens if email confirmation is switched back on in Supabase.
    return {
      status: "error",
      field: "email",
      message: "Account created. Check your email to confirm it, then sign in.",
    };
  }
  redirect(next);
}

// ---------------------------------------------------------------------------
// Emailed 6-digit codes (only when an email provider is connected)
// ---------------------------------------------------------------------------

export async function sendCode(_prev: SendCodeState, form: FormData): Promise<SendCodeState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: BAD_EMAIL };
  const email = parsed.data;
  if (!emailCodesEnabled()) {
    return { status: "error", email, message: "Sign-in codes aren't available yet. Use your password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: callbackUrl(await siteOrigin(), String(form.get("next") ?? "")),
    },
  });
  if (error) {
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { status: "error", email, message: "Too many codes requested. Wait a minute, then try again." };
    }
    return { status: "error", email, message: "Couldn't send the code. Check the address and try again." };
  }
  return { status: "sent", email, sentAt: Date.now() };
}

export async function verifyCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = codeSchema.safeParse(String(form.get("code") ?? "").replace(/\s/g, ""));
  if (!email.success) return { status: "error", message: "Start again with your email address." };
  if (!code.success) return { status: "error", message: "The code is 6 digits. Check the email and type it again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error) {
    return {
      status: "error",
      message: "That code is wrong or has expired. Use the code in the newest email, or send a new one.",
    };
  }
  redirect(safeNextPath(String(form.get("next") ?? "")));
}

/** Google sign-in (F0-FR1). Shown only when the provider is enabled in Supabase. */
export async function signInWithGoogle(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(await siteOrigin(), String(form.get("next") ?? "")) },
  });
  if (error || !data.url) redirect("/sign-in?error=google");
  redirect(data.url);
}
