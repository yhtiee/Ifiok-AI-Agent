import "server-only";
import { redirect } from "next/navigation";
import { RouteError } from "@/lib/api/route";
import { createClient } from "@/lib/supabase/server";
import { STEP_PATHS, canOpenStep, requiredStep, type OnboardingStep } from "./onboarding";
import { getViewer, type Viewer } from "./viewer";

// ---- Route handlers (CLAUDE.md: requireUser / requireAdult / requireAdmin first, then zod) ----

export async function requireUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new RouteError(401, "Sign in to continue.", "unauthenticated");
  if (viewer.profile.status !== "active") throw new RouteError(403, "This account is not active.", "inactive");
  return viewer;
}

/** Every AI route calls this (guardrail 8): adult, active and agreed to the current terms. */
export async function requireAdult(): Promise<Viewer> {
  const viewer = await requireUser();
  if (!viewer.profile.is_adult) throw new RouteError(403, "Ifiok is for students 18 and older.", "not_adult");
  if (!viewer.consented) throw new RouteError(403, "Agree to the terms to continue.", "consent_required");
  return viewer;
}

/** Admins must be signed in with MFA (is_admin() checks the aal2 claim, 03 §8). */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireUser();
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new RouteError(403, "Admins must sign in with two-step verification.", "not_admin");
  return viewer;
}

// ---- Pages: redirect instead of throwing ----

/** For signed-in app pages: signed out → sign-in; not finished onboarding → the right step. */
export async function requireOnboardedPage(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const step = requiredStep(viewer);
  if (step) redirect(STEP_PATHS[step]);
  return viewer;
}

/** For an onboarding step page: keeps users on the step they need, and sends finished users on. */
export async function requireOnboardingStep(step: OnboardingStep): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (!canOpenStep(step, viewer)) {
    const required = requiredStep(viewer);
    redirect(required ? STEP_PATHS[required] : "/today");
  }
  return viewer;
}
