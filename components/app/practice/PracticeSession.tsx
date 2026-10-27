"use client";

import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { RichText } from "@/components/lesson/RichText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupRow } from "@/components/ui/radio-group";
import { MASTERY_LABELS, masteryText, type MasteryLevel } from "@/lib/courses/path-rules";
import { useAnswer, type AttemptResult } from "@/lib/queries/practice";
import { ApiError } from "@/lib/query/api";

// A practice session (10 MVP-03): one question at a time; the server marks each answer (/api/sync)
// and returns the verdict, the right answer and why. The phone never has the answer beforehand.
// One camwood action: Check, then Next.

export type PracticeQuestion =
  | { id: string; type: "mcq"; prompt: string; options: { id: string; text: string }[] }
  | { id: string; type: "numeric"; prompt: string; unit: string | null };

type Marked = Extract<AttemptResult, { status: "recorded" | "duplicate" }>;

export function PracticeSession(props: {
  questions: PracticeQuestion[];
  back: { href: string; label: string };
  lessonHref: string;
  /** Student explainers for the topic, offered after a wrong answer (F18-FR6, MVP-06). */
  explainersHref?: string | null;
}) {
  const { questions, back, lessonHref } = props;
  const router = useRouter();
  const answer = useAnswer();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [marked, setMarked] = useState<Marked | null>(null);
  const [right, setRight] = useState(0);
  const [level, setLevel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // When the current question appeared (answer time is evidence metadata, not marking).
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  if (questions.length === 0) {
    return (
      <EmptyState
        title="No practice questions yet"
        body="They're written after the topic's lesson is ready. Open the lesson first; questions follow in a minute or two."
        action={
          <Button asChild variant="outline">
            <Link href={lessonHref}>Open the lesson</Link>
          </Button>
        }
      />
    );
  }

  if (index >= questions.length) {
    return (
      <section aria-labelledby="practice-done" className="grid max-w-2xl gap-5">
        <h2 id="practice-done" className="font-display text-xl font-semibold">
          {right} of {questions.length} right
        </h2>
        {level ? (
          <p className="text-base text-ink-2">
            This topic is now{" "}
            <span className="font-semibold text-ink">
              {level in MASTERY_LABELS ? masteryText(level as MasteryLevel, true) : level}
            </span>
            .
          </p>
        ) : null}
        <ActionBar over="screen">
          <Button asChild>
            <Link href={back.href}>{back.label}</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setRight(0);
              setMarked(null);
              setChoice("");
              router.refresh();
            }}
          >
            Practise again
          </Button>
        </ActionBar>
      </section>
    );
  }

  const q = questions[index]!;

  const check = () => {
    if (!choice.trim()) return;
    setError(null);
    answer.mutate(
      {
        id: crypto.randomUUID(),
        item_id: q.id,
        response: q.type === "mcq" ? { option_id: choice } : { value: choice.trim() },
        duration_ms: Math.min(3_600_000, Date.now() - shownAt.current),
      },
      {
        onSuccess: (r) => {
          if (r.status === "not_found") {
            setError("This question is no longer available. Go to the next one.");
            return;
          }
          setMarked(r);
          setLevel(r.mastery.level);
          if (r.correct) setRight((n) => n + 1);
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Your answer wasn't sent. Try again."),
      },
    );
  };

  const next = () => {
    setIndex((i) => i + 1);
    setChoice("");
    setMarked(null);
    setError(null);
  };

  return (
    <div className="grid max-w-2xl gap-5">
      <div className="grid gap-2">
        <Progress
          value={((index + 1) / questions.length) * 100}
          aria-label={`Question ${index + 1} of ${questions.length}`}
        />
        <p className="text-sm text-ink-2 tabular-nums">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <p className="text-lg leading-relaxed">
        <RichText text={q.prompt} />
      </p>

      {q.type === "mcq" ? (
        <RadioGroup
          value={choice}
          onValueChange={setChoice}
          disabled={Boolean(marked) || answer.isPending}
          aria-label="Your answer"
          className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line"
        >
          {q.options.map((o) => (
            <RadioGroupRow key={o.id} value={o.id} label={o.text} />
          ))}
        </RadioGroup>
      ) : (
        <label className="grid max-w-xs gap-1.5">
          <span className="text-base font-semibold">Your answer{q.unit ? ` (${q.unit})` : ""}</span>
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={choice}
            disabled={Boolean(marked) || answer.isPending}
            onChange={(e) => setChoice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !marked) check();
            }}
          />
        </label>
      )}

      {marked ? (
        <div
          role="status"
          className={`grid gap-1 rounded-[var(--radius-input)] border-l-4 px-4 py-3 ${
            marked.correct ? "border-ok bg-built-soft" : "border-bad bg-change-soft"
          }`}
        >
          <p className="flex items-center gap-2 font-semibold">
            {marked.correct ? (
              <CheckCircleIcon size={20} weight="fill" className="text-ok" aria-hidden="true" />
            ) : (
              <XCircleIcon size={20} weight="fill" className="text-bad" aria-hidden="true" />
            )}
            {marked.correct ? "Correct." : `Not quite.${marked.answer ? ` The answer is ${marked.answer}.` : ""}`}
          </p>
          {marked.why ? (
            <p className="text-base">
              <RichText text={marked.why} />
            </p>
          ) : null}
          {!marked.correct && props.explainersHref ? (
            <Link
              href={props.explainersHref}
              className="inline-flex min-h-11 items-center text-base font-semibold text-quantity hover:underline"
            >
              A student explains this
            </Link>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}

      <ActionBar over="screen">
        {marked || error?.startsWith("This question") ? (
          <Button onClick={next}>{index + 1 === questions.length ? "See how you did" : "Next question"}</Button>
        ) : (
          <Button onClick={check} disabled={!choice.trim() || answer.isPending} aria-busy={answer.isPending}>
            {answer.isPending ? "Checking…" : "Check"}
          </Button>
        )}
      </ActionBar>
    </div>
  );
}
