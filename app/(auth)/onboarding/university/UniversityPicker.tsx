"use client";

import { useState } from "react";
import { ChoiceList, ChoiceRow } from "@/components/ui/ChoiceList";
import { TextField } from "@/components/ui/Field";
import { StepScreen } from "@/components/ui/StepScreen";
import { saveUniversity } from "../actions";

type University = { id: string; name: string; short_name: string };

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function UniversityPicker({
  universities,
  currentId,
  failed,
  back,
}: {
  universities: University[];
  currentId: string | null;
  failed: boolean;
  /** Set when a finished student is changing their study profile from Me. */
  back?: { href: string; label: string };
}) {
  const [query, setQuery] = useState("");
  const q = normalise(query);
  const matches = q
    ? universities.filter((u) => normalise(u.name).includes(q) || normalise(u.short_name).includes(q))
    : universities;

  return (
    <StepScreen
      step={back ? undefined : { current: 3, total: 5 }}
      back={back}
      title="Where do you study?"
      intro="Tap your university, so you find the same courses as your classmates."
    >
      <div className="grid gap-4">
        <TextField
          label="Search"
          type="search"
          placeholder="For example, Uniuyo or University of Lagos"
          className="sm:max-w-md"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          error={failed ? "Couldn't save that. Check your connection and try again." : null}
        />
        <form action={saveUniversity}>
          <ChoiceList label="Universities" columns={2} scroll>
            {matches.map((u) => (
              <ChoiceRow
                key={u.id}
                name="university"
                value={u.id}
                title={u.name}
                detail={u.short_name}
                selected={u.id === currentId}
              />
            ))}
            {matches.length === 0 ? (
              <li className="px-4 py-3 text-base text-ink-2">No university matches “{query.trim()}”.</li>
            ) : null}
            <ChoiceRow
              name="university"
              value="none"
              title="Not listed, or not at a university"
              detail="You can still learn any course or topic."
            />
          </ChoiceList>
        </form>
      </div>
    </StepScreen>
  );
}
