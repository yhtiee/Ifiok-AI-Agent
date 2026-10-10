import type { Metadata } from "next";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = { title: "Before you start", robots: { index: false } };

// Step 2 of 5: Terms, Privacy and the AI disclosure, recorded with version and time (F0-FR3).
export default async function ConsentPage() {
  const viewer = await requireOnboardingStep("consent");
  // Users who finished onboarding see this again only when the terms change.
  return <ConsentForm returning={Boolean(viewer.profile.onboarded_at)} />;
}
