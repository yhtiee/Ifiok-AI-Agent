"use client";

import { useId, useState } from "react";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SANDBOX_LABEL } from "@/lib/payments/money";
import { useCreateBooking } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";

// Book a tutor (F17-FR2, 10 MVP-07): pick a time, then approve the payment on PayPal (sandbox).
// The money is only held when PayPal sends you back; it's captured after you confirm the session.
// When Ifiok's tutoring agent drafted the booking, its reason shows and the learner still decides.

/** "2026-11-01T18:00" in the browser's time zone, for a datetime-local input. */
function localValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookTutor(props: {
  tutorId: string;
  conceptId: string;
  price: string;
  minutes: number;
  startsAt: string;
  /** The tutoring agent's draft this booking approves; the server takes its reason from there. */
  proposalId: string | null;
}) {
  const id = useId();
  const book = useCreateBooking();
  const [when, setWhen] = useState(localValue(props.startsAt));
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const start = new Date(when);
    if (Number.isNaN(start.getTime())) return setError("Pick a day and time.");
    book.mutate(
      {
        tutor_id: props.tutorId,
        concept_id: props.conceptId,
        starts_at: start.toISOString(),
        proposal_id: props.proposalId ?? undefined,
      },
      {
        // PayPal's own page: the learner logs in to their sandbox account and approves.
        onSuccess: (r) => window.location.assign(r.approveUrl),
        onError: (err) => setError(err instanceof ApiError ? err.message : "That didn't work. Try again."),
      },
    );
  };

  return (
    <div className="grid max-w-xl gap-5">
      <label htmlFor={id} className="grid gap-1.5">
        <span className="text-base font-semibold">When</span>
        <Input
          id={id}
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="max-w-72"
        />
        <span className="text-sm text-ink-2">
          {props.minutes} minutes. Agree the call or meeting with your tutor; Ifiok doesn&apos;t host video.
        </span>
      </label>
      <dl className="grid gap-1 text-base">
        <div className="flex gap-2">
          <dt className="text-ink-2">Price</dt>
          <dd className="font-semibold tabular-nums">{props.price}</dd>
        </div>
      </dl>
      <p className="text-sm text-ink-2">
        <span className="font-semibold text-quantity">{SANDBOX_LABEL}.</span> PayPal holds the payment; nothing is taken
        until you confirm the session happened. If the tutor doesn&apos;t show, the hold is cancelled. If you do
        nothing, it&apos;s paid 24 hours after the session.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <ActionBar>
        <Button
          onClick={submit}
          disabled={book.isPending || book.isSuccess}
          aria-busy={book.isPending || book.isSuccess}
        >
          {book.isPending || book.isSuccess ? "Opening PayPal…" : "Approve with PayPal"}
        </Button>
      </ActionBar>
    </div>
  );
}
