import type { Metadata } from "next";
import { ChoiceList, ChoiceRow } from "@/components/ui/ChoiceList";
import { StepScreen } from "@/components/ui/StepScreen";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { saveMinutes } from "../actions";

export const metadata: Metadata = { title: "Your study time", robots: { index: false } };

const OPTIONS = [
  { value: 15, title: "15 minutes", detail: "A quick daily habit" },
  { value: 30, title: "30 minutes", detail: "Recommended" },
  { value: 45, title: "45 minutes", detail: null },
  { value: 60, title: "60 minutes", detail: "For exam season" },
];

// Step 5 of 5 (F0-FR4: 15/30/45/60, default 30). Finishing here opens Today.
export default async function MinutesPage({ searchParams }: PageProps<"/onboarding/minutes">) {
  const viewer = await requireOnboardingStep("minutes");
  const { error } = await searchParams;

  return (
    <StepScreen
      step={{ current: 5, total: 5 }}
      back={
        viewer.profile.university_id
          ? { href: "/onboarding/level", label: "Back to level" }
          : { href: "/onboarding/university", label: "Back to university" }
      }
      title="How long can you study each day?"
      intro="Ifiok plans your day around this. You can change it any time."
    >
      {error === "1" ? (
        <p role="alert" className="mb-4 text-sm text-bad">
          Couldn&apos;t save that. Check your connection and try again.
        </p>
      ) : null}
      <form action={saveMinutes}>
        <ChoiceList label="Daily study time" columns={2}>
          {OPTIONS.map((o) => (
            <ChoiceRow key={o.value} name="minutes" value={o.value} title={o.title} detail={o.detail} />
          ))}
        </ChoiceList>
      </form>
    </StepScreen>
  );
}
