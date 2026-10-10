"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/onboarding";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { passwordResetEnabled } from "@/lib/auth/sign-in-mode";
import { createClient } from "@/lib/supabase/server";

// Forgot password (12 §4 Q29): Supabase emails a 6-digit recovery code; the student types it
// with a new password on the same screen. Codes, not links, so it works when the email is
// opened on another phone or app (a reset link only works in the browser that asked for it).

export type RequestResetState =
  | { status: "idle" }
  | { status: "sent"; email: string; sentAt: number }
  | { status: "error"; message: string; email?: string };

export type ResetState = { status: "idle" } | { status: "error"; message: string; field: "code" | "password" };

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);

export async function requestPasswordReset(_prev: RequestResetState, form: FormData): Promise<RequestResetState> {
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a full email address, like ada@gmail.com." };
  const email = parsed.data;
  if (!passwordResetEnabled()) {
    return { status: "error", email, message: "Password reset isn't available yet. Contact support to get back in." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    return { status: "error", email, message: "Too many codes requested. Wait a minute, then try again." };
  }
  // Any other outcome looks the same, so the form can't be used to find out who has an account.
  return { status: "sent", email, sentAt: Date.now() };
}

export async function resetPassword(_prev: ResetState, form: FormData): Promise<ResetState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = codeSchema.safeParse(String(form.get("code") ?? "").replace(/\s/g, ""));
  const password = String(form.get("password") ?? "");
  if (!email.success) return { status: "error", field: "code", message: "Start again with your email address." };
  if (!code.success) {
    return { status: "error", field: "code", message: "The code is 6 digits. Check the email and type it again." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      field: "password",
      message: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "recovery",
  });
  if (verifyError) {
    // A code works once. If an earlier try verified it but the password was refused, that
    // session is still here: let the student pick a different password without a new code.
    const { data } = await supabase.auth.getUser();
    if (data.user?.email?.toLowerCase() !== email.data) {
      return {
        status: "error",
        field: "code",
        message: "That code is wrong or has expired. Use the code in the newest email, or send a new one.",
      };
    }
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return {
        status: "error",
        field: "password",
        message: "That's already your password. Choose a different one, or go back and sign in with it.",
      };
    }
    if (error.code === "weak_password") {
      return {
        status: "error",
        field: "password",
        message: "Choose a stronger password: longer, and not a common one.",
      };
    }
    return { status: "error", field: "password", message: "Couldn't save the new password. Try again in a minute." };
  }
  redirect(safeNextPath(String(form.get("next") ?? "")));
}
