import type { Profile } from "./viewer";

export const ONBOARDING_STEPS = ["birth", "consent", "university", "level", "minutes"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_PATHS: Record<OnboardingStep, string> = {
  birth: "/onboarding",
  consent: "/onboarding/consent",
  university: "/onboarding/university",
  level: "/onboarding/level",
  minutes: "/onboarding/minutes",
};

type OnboardingState = { profile: Pick<Profile, "is_adult" | "onboarded_at">; consented: boolean };

/**
 * Where a signed-in user belongs (F0-FR4): the date-of-birth step comes first, then consents,
 * then the study profile. Returns null once onboarding is finished.
 * (P1-01 inserts "What do you want to learn?" before the daily minutes step.)
 */
export function requiredStep({ profile, consented }: OnboardingState): OnboardingStep | null {
  if (!profile.is_adult) return "birth";
  if (!consented) return "consent";
  if (!profile.onboarded_at) return "university";
  return null;
}

const STUDY_PROFILE_STEPS: readonly OnboardingStep[] = ["university", "level", "minutes"];

/**
 * Whether a user may open this step now. Nobody skips the age gate or consent; once past them,
 * the study-profile steps (university, level, minutes) can be opened in any order, including
 * after onboarding, to change those settings (the "Change" link on Me).
 */
export function canOpenStep(step: OnboardingStep, state: OnboardingState): boolean {
  const required = requiredStep(state);
  if (required === "birth" || required === "consent") return step === required;
  return STUDY_PROFILE_STEPS.includes(step);
}

/** Only same-site paths are allowed as a post-sign-in destination. */
export function safeNextPath(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
