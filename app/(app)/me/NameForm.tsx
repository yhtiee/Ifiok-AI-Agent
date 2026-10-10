"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { NAME_MAX } from "@/lib/auth/name-limits";
import { updateName, type NameState } from "./actions";

export function NameForm({ firstName, lastName }: { firstName: string; lastName: string }) {
  const [state, action, saving] = useActionState<NameState, FormData>(updateName, { status: "idle" });
  // Controlled, so a refused save keeps what was typed (React resets forms after an action).
  const [first, setFirst] = useState(firstName);
  const [last, setLast] = useState(lastName);
  const changed = first.trim() !== firstName || last.trim() !== lastName;
  const error = state.status === "error" ? state : null;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="First name"
          name="first_name"
          autoComplete="given-name"
          autoCapitalize="words"
          maxLength={NAME_MAX}
          required
          value={first}
          onChange={(e) => setFirst(e.currentTarget.value)}
          error={error?.field === "first_name" ? error.message : null}
        />
        <TextField
          label="Last name"
          name="last_name"
          autoComplete="family-name"
          autoCapitalize="words"
          maxLength={NAME_MAX}
          required
          value={last}
          onChange={(e) => setLast(e.currentTarget.value)}
          error={error?.field === "last_name" ? error.message : null}
        />
      </div>
      <p className="text-sm text-ink-2">
        Other students only see your first name and last initial, for example on course outline history.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SubmitButton full={false} pending={saving} pendingLabel="Saving…" disabled={!changed && !error}>
          Save name
        </SubmitButton>
        <p role="status" className="text-sm">
          {error && error.field === null ? (
            <span className="text-bad">{error.message}</span>
          ) : state.status === "saved" && !changed ? (
            <span className="font-semibold text-built">Name saved.</span>
          ) : null}
        </p>
      </div>
    </form>
  );
}
