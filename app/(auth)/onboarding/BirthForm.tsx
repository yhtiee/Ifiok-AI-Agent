"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { SelectField } from "@/components/ui/Field";
import { StepScreen } from "@/components/ui/StepScreen";
import { submitBirthDate, type StepState } from "./actions";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Every year is offered (no cut-off hint), so people answer honestly.
const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 81 }, (_, i) => thisYear - i);

export function BirthForm() {
  const [state, action, checking] = useActionState<StepState, FormData>(submitBirthDate, { status: "idle" });
  const error = state.status === "error" ? state.message : null;

  return (
    <StepScreen
      step={{ current: 1, total: 5 }}
      title="When were you born?"
      intro="Ifiok is for students 18 and older. We keep only the month and year."
      action={
        <SubmitButton form="birth-form" pending={checking} pendingLabel="Checking…">
          Continue
        </SubmitButton>
      }
    >
      <form id="birth-form" action={action} className="grid grid-cols-[3fr_2fr] gap-3 sm:max-w-md" noValidate>
        <SelectField label="Month" name="month" defaultValue="" required error={error}>
          <option value="" disabled>
            Month
          </option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </SelectField>
        <SelectField label="Year" name="year" defaultValue="" required>
          <option value="" disabled>
            Year
          </option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </SelectField>
      </form>
    </StepScreen>
  );
}
