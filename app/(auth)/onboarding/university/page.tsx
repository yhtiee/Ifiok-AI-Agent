import type { Metadata } from "next";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { UniversityPicker } from "./UniversityPicker";

export const metadata: Metadata = { title: "Your university", robots: { index: false } };

// Step 3 of 5 (F0-FR4). "Not listed" never blocks anyone: they can still learn anything (00 §4.6).
export default async function UniversityPage({ searchParams }: PageProps<"/onboarding/university">) {
  const viewer = await requireOnboardingStep("university");
  const supabase = await createClient();
  const { data: universities } = await supabase.from("universities").select("id, name, short_name").order("name");
  const { error } = await searchParams;

  return (
    <UniversityPicker
      universities={universities ?? []}
      currentId={viewer.profile.university_id}
      failed={error === "1"}
    />
  );
}
