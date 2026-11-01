"use client";

import { UserCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sessionTime } from "@/lib/payments/booking-words";
import { SANDBOX_LABEL, usd } from "@/lib/payments/money";
import { useDismissProposal, useRunTutorAgent, useSetSpendLimit, type AgentProposalView } from "@/lib/queries/payments";
import { ApiError } from "@/lib/query/api";

// Ifiok's tutoring agent on Practice (12 §4 Q63, 10 MVP-07 agentic commerce). The student asks; the
// agent looks at their weak topics and the tutors within their own limit, and drafts a booking with
// its reasons and what it looked at. "Review and approve" opens the booking; PayPal asks for the
// student's approval before anything is held. The limit is the student's, and the agent can't exceed it.

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : "That didn't work. Try again.");

export function TutorAgent(props: { proposal: AgentProposalView | null; limitCents: number }) {
  const router = useRouter();
  const run = useRunTutorAgent();
  const dismiss = useDismissProposal();
  const setLimit = useSetSpendLimit();
  const limitId = useId();
  const [proposal, setProposal] = useState(props.proposal);
  const [editing, setEditing] = useState(false);
  const [limit, setLimitValue] = useState((props.limitCents / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);

  const ask = () => {
    setError(null);
    run.mutate(undefined, { onSuccess: (r) => setProposal(r.proposal), onError: (err) => setError(errorText(err)) });
  };

  return (
    <aside aria-labelledby="tutor-agent" className="grid gap-3 border-t border-line pt-4">
      <h3 id="tutor-agent" className="flex items-center gap-2 text-base font-semibold">
        <UserCircleIcon size={22} className="text-quantity" aria-hidden="true" /> Ifiok&apos;s tutoring agent
      </h3>

      {proposal ? (
        <div className="grid gap-2" aria-live="polite">
          <p className="text-sm text-ink-2">
            Looked at {proposal.considered.weakTopics} weak {proposal.considered.weakTopics === 1 ? "topic" : "topics"}{" "}
            and {proposal.considered.tutors} {proposal.considered.tutors === 1 ? "tutor" : "tutors"} within your{" "}
            {proposal.limit} limit
            {proposal.considered.overLimit ? ` (${proposal.considered.overLimit} more cost too much)` : ""}.
          </p>
          <p className="text-base">{proposal.reason}</p>
          <p className="text-sm">
            <span className="font-semibold">Draft:</span> {proposal.concept.title} with {proposal.tutor.name},{" "}
            {sessionTime(proposal.startsAt)}, {proposal.price}.{" "}
            <span className="text-ink-2">
              {SANDBOX_LABEL}. Nothing is booked or paid until you approve it on PayPal.
            </span>
          </p>
          <span className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/tutoring/new?proposal=${proposal.id}`}>Review and approve</Link>
            </Button>
            <Button
              variant="ghost"
              disabled={dismiss.isPending}
              onClick={() =>
                dismiss.mutate(proposal.id, {
                  onSuccess: () => {
                    setProposal(null);
                    router.refresh();
                  },
                  onError: (err) => setError(errorText(err)),
                })
              }
            >
              Not now
            </Button>
            <Button variant="ghost" disabled={run.isPending} aria-busy={run.isPending} onClick={ask}>
              {run.isPending ? "Looking…" : "Ask again"}
            </Button>
          </span>
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-base">
            Stuck on a topic? Ifiok can look at where you&apos;re struggling and find a student tutor for it, within
            your limit. You approve before anything is paid.
          </p>
          <Button
            variant="outline"
            className="justify-self-start"
            disabled={run.isPending}
            aria-busy={run.isPending}
            onClick={ask}
          >
            {run.isPending ? "Looking at your topics and tutors…" : "Find me a tutor"}
          </Button>
        </div>
      )}

      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setLimit.mutate(Math.round(Number(limit) * 100), {
              onSuccess: () => {
                setEditing(false);
                router.refresh();
              },
              onError: (err) => setError(errorText(err)),
            });
          }}
        >
          <label htmlFor={limitId} className="grid gap-1">
            <span className="text-sm font-semibold">Most per session (USD)</span>
            <Input
              id={limitId}
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimitValue(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-28"
            />
          </label>
          <Button type="submit" variant="outline" disabled={setLimit.isPending}>
            Save limit
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-2">
          Your limit: {usd(props.limitCents)} a session.{" "}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-11 items-center font-semibold text-quantity underline-offset-4 hover:underline"
          >
            Change
          </button>
        </p>
      )}
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
