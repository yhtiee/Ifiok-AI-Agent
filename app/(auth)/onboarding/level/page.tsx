import type { Metadata } from "next";
import { ChoiceList, ChoiceRow } from "@/components/ui/ChoiceList";
import { StepScreen } from "@/components/ui/StepScreen";
import { requireOnboardingStep } from "@/lib/auth/guards";
import { saveLevel } from "../actions";

export const metadata: Metadata = { title: "Your level", robots: { index: false } };

const LEVELS = [
  { value: 100, title: "100 level" },
  { value: 200, title: "200 level" },
  { value: 300, title: "300 level" },
  { value: 400, title: "400 level" },
  { value: 500, title: "500 level" },
  { value: 600, title: "600 level" },
  { value: 700, title: "Postgraduate" },
];

// Step 4 of 5. Lessons are pitched at this level by default (03 §2 level bands).
export default async function LevelPage({ searchParams }: PageProps<"/onboarding/level">) {
  const viewer = await requireOnboardingStep("level");
  const { error } = await searchParams;

  return (
    <StepScreen
      step={{ current: 4, total: 5 }}
      title="What level are you in?"
      intro="Ifiok pitches lessons at your level. You can change it later."
    >
      {error === "1" ? (
        <p role="alert" className="mb-4 text-sm text-bad">
          Couldn&apos;t save that. Check your connection and try again.
        </p>
      ) : null}
      <form action={saveLevel}>
        <ChoiceList label="Levels" columns={2}>
          {LEVELS.map((l) => (
            <ChoiceRow
              key={l.value}
              name="level"
              value={l.value}
              title={l.title}
              selected={viewer.profile.level === l.value}
            />
          ))}
        </ChoiceList>
      </form>
    </StepScreen>
  );
}
