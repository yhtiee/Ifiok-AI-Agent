"use server";

import { isAdultByBirthMonth, isPlausibleBirthMonth } from "@ifiok/core";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONSENT_VERSION, REQUIRED_CONSENTS } from "@/lib/auth/consent";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type StepState = { status: "idle" } | { status: "error"; message: string };

const TRY_AGAIN = "Couldn't save that. Check your connection and try again.";

// ---------------------------------------------------------------------------
// Step 1: date of birth, the 18+ gate (F0-FR2, 08 §3)
// ---------------------------------------------------------------------------

const birthSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1900),
});

export async function submitBirthDate(_prev: StepState, form: FormData): Promise<StepState> {
  const viewer = await requireOnboardingStep("birth");
  const parsed = birthSchema.safeParse({ month: form.get("month"), year: form.get("year") });
  if (!parsed.success || !isPlausibleBirthMonth(parsed.data.year, parsed.data.month)) {
    return { status: "error", message: "Pick the month and year you were born." };
  }
  const { year, month } = parsed.data;
  const admin = createAdminClient();

  if (!isAdultByBirthMonth(year, month)) {
    // Under 18: keep nothing. Deleting the auth user cascades to the profile and every other row.
    const { error } = await admin.auth.admin.deleteUser(viewer.userId);
    if (error) return { status: "error", message: TRY_AGAIN };
    await clearSession();
    redirect("/onboarding/not-yet");
  }

  // Adults: store month and year only; is_adult is server-written (column grants block clients).
  const { error } = await admin
    .from("profiles")
    .update({ birth_year: year, birth_month: month, is_adult: true })
    .eq("id", viewer.userId);
  if (error) return { status: "error", message: TRY_AGAIN };
  redirect("/onboarding/consent");
}

async function clearSession() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  // The user no longer exists, so also drop any auth cookie the sign-out couldn't clear.
  const store = await cookies();
  for (const c of store.getAll()) if (c.name.startsWith("sb-")) store.delete(c.name);
}

// ---------------------------------------------------------------------------
// Step 2: consents (F0-FR3). Recorded with version and time, by the server.
// ---------------------------------------------------------------------------

export async function acceptConsents(): Promise<StepState> {
  const viewer = await requireOnboardingStep("consent");
  const admin = createAdminClient();
  const { error } = await admin.from("consents").upsert(
    REQUIRED_CONSENTS.map((kind) => ({ user_id: viewer.userId, kind, version: CONSENT_VERSION })),
    { onConflict: "user_id,kind,version", ignoreDuplicates: true },
  );
  if (error) return { status: "error", message: TRY_AGAIN };
  redirect(viewer.profile.onboarded_at ? "/today" : "/onboarding/university");
}

// ---------------------------------------------------------------------------
// Steps 3–5: study profile. Written by the user under RLS (these columns are user-editable).
// ---------------------------------------------------------------------------

const universitySchema = z.union([z.literal("none"), z.uuid()]);

export async function saveUniversity(form: FormData) {
  const viewer = await requireOnboardingStep("university");
  const parsed = universitySchema.safeParse(form.get("university"));
  if (!parsed.success) redirect("/onboarding/university?error=1");
  const universityId = parsed.data === "none" ? null : parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ university_id: universityId }).eq("id", viewer.userId);
  if (error) redirect("/onboarding/university?error=1");
  // Not at a university: no level to ask about.
  redirect(universityId ? "/onboarding/level" : "/onboarding/minutes");
}

const levelSchema = z.coerce
  .number()
  .int()
  .refine((n) => [100, 200, 300, 400, 500, 600, 700].includes(n));

export async function saveLevel(form: FormData) {
  const viewer = await requireOnboardingStep("level");
  const parsed = levelSchema.safeParse(form.get("level"));
  if (!parsed.success) redirect("/onboarding/level?error=1");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ level: parsed.data }).eq("id", viewer.userId);
  if (error) redirect("/onboarding/level?error=1");
  redirect("/onboarding/minutes");
}

const minutesSchema = z.coerce
  .number()
  .int()
  .refine((n): n is 15 | 30 | 45 | 60 => [15, 30, 45, 60].includes(n));

/** Last step: saves daily minutes and marks onboarding finished (server-written). */
export async function saveMinutes(form: FormData) {
  const viewer = await requireOnboardingStep("minutes");
  const parsed = minutesSchema.safeParse(form.get("minutes"));
  if (!parsed.success) redirect("/onboarding/minutes?error=1");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ daily_minutes: parsed.data }).eq("id", viewer.userId);
  if (error) redirect("/onboarding/minutes?error=1");

  const admin = createAdminClient();
  const done = await admin
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", viewer.userId)
    .is("onboarded_at", null);
  if (done.error) redirect("/onboarding/minutes?error=1");
  redirect("/today");
}
