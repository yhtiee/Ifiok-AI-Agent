"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveTutor } from "@/lib/queries/contribute";
import { ApiError } from "@/lib/query/api";

// Become a tutor (F17-FR1, profile only, 10 MVP-06): pick the topics you'll teach and say when you're
// free. No mastery required (12 §4 Q52); learners see your Ifiok mastery when you have it.

export type TutorTopic = { conceptId: string; title: string; group: string };

export function TutorForm(props: {
  topics: TutorTopic[];
  initial: { availability: string; active: boolean; conceptIds: string[] } | null;
}) {
  const router = useRouter();
  const save = useSaveTutor();
  const availabilityId = useId();
  const [picked, setPicked] = useState<Set<string>>(new Set(props.initial?.conceptIds ?? []));
  const [availability, setAvailability] = useState(props.initial?.availability ?? "");
  const [active, setActive] = useState(props.initial?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(props.topics.map((t) => t.group))];

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    setError(null);
    if (!picked.size) return setError("Pick at least one topic.");
    if (availability.trim().length < 3) return setError("Say when you're usually free.");
    save.mutate(
      { availability: availability.trim(), concept_ids: [...picked], active },
      {
        onSuccess: () => {
          toast(active ? "Saved. Learners see you on these topics." : "Saved. Your profile is hidden.");
          router.refresh();
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "That didn't save. Try again."),
      },
    );
  };

  return (
    <div className="grid max-w-2xl gap-6">
      {groups.map((g) => (
        <fieldset key={g} className="grid gap-1">
          <legend className="mb-1 text-base font-semibold">{g}</legend>
          {props.topics
            .filter((t) => t.group === g)
            .map((t) => (
              <label key={`${g}:${t.conceptId}`} className="flex min-h-11 items-center gap-3 text-base">
                <input
                  type="checkbox"
                  checked={picked.has(t.conceptId)}
                  onChange={() => toggle(t.conceptId)}
                  className="h-5 w-5"
                />
                {t.title}
              </label>
            ))}
        </fieldset>
      ))}
      <label htmlFor={availabilityId} className="grid gap-1.5">
        <span className="text-base font-semibold">When you&apos;re free</span>
        <Textarea
          id={availabilityId}
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Weekday evenings after 6 pm, Saturday mornings"
        />
      </label>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5" />
        Show my profile to learners
      </label>
      <p className="text-sm text-ink-2">
        Bookings and payments open after launch. Only your name and these topics show.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <ActionBar>
        <Button onClick={submit} disabled={save.isPending} aria-busy={save.isPending}>
          {save.isPending ? "Saving…" : "Save tutor profile"}
        </Button>
      </ActionBar>
    </div>
  );
}
