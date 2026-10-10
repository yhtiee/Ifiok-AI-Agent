import type { Metadata } from "next";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { BirthForm } from "./BirthForm";

export const metadata: Metadata = { title: "Your age", robots: { index: false } };

// Step 1 of 5: the 18+ gate comes before anything else is collected (F0-FR2).
export default async function BirthPage() {
  await requireOnboardingStep("birth");
  return <BirthForm />;
}
