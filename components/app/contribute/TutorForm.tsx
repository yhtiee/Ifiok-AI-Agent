"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SANDBOX_LABEL, usd } from "@/lib/payments/money";
import { useSaveTutor } from "@/lib/queries/contribute";
import { ApiError } from "@/lib/query/api";

// Become a tutor (F17-FR1, 10 MVP-06, MVP-07): pick the topics you'll teach, say when you're free and
// set your price per session (PayPal sandbox). No mastery required (12 §4 Q52); learners see your
// Ifiok mastery when you have it.

export type TutorTopic = { conceptId: string; title: string; group: string };

export function TutorForm(props: {
  topics: TutorTopic[];
  initial: { availability: string; active: boolean; conceptIds: string[]; priceCents: number | null } | null;
  band: { minCents: number; maxCents: number; takeRate: number; minutes: number };
}) {
  const router = useRouter();
  const save = useSaveTutor();
  const availabilityId = useId();
  const priceId = useId();
  const [price, setPrice] = useState(props.initial?.priceCents ? (props.initial.priceCents / 100).toFixed(2) : "");
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
    const cents = price.trim() ? Math.round(Number(price) * 100) : undefined;
    if (cents !== undefined && (!Number.isFinite(cents) || cents < props.band.minCents || cents > props.band.maxCents))
      return setError(`Set a price between ${usd(props.band.minCents)} and ${usd(props.band.maxCents)}.`);
    save.mutate(
      { availability: availability.trim(), concept_ids: [...picked], active, price_cents: cents },
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
      <label htmlFor={priceId} className="grid gap-1.5">
        <span className="text-base font-semibold">Price per {props.band.minutes}-minute session (USD)</span>
        <Input
          id={priceId}
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={(props.band.minCents / 100).toFixed(2)}
          className="max-w-40"
        />
        <span className="text-sm text-ink-2">
          {SANDBOX_LABEL}. Learners pay through PayPal; you get it after the session, less Ifiok&apos;s{" "}
          {Math.round(props.band.takeRate * 100)}% commission. Leave it empty to show your profile without bookings.
        </span>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5" />
        Show my profile to learners
      </label>
      <p className="text-sm text-ink-2">
        Only your name, these topics, when you&apos;re free and your price show. Add your PayPal email on My earnings so
        Ifiok can pay you.
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
