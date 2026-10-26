"use client";

import { CheckCircleIcon, TimerIcon, XCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ActionBar, EmptyState } from "@/components/app/Page";
import { MathHtmlProvider, RichText } from "@/components/lesson/RichText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupRow } from "@/components/ui/radio-group";
import { useAnswer, type AttemptResult } from "@/lib/queries/practice";
import { ApiError } from "@/lib/query/api";
import { SolutionReveal } from "./WorkedSolution";

// A timed practice paper (10 MVP-04): past questions are answered on paper, then self-marked against
// the worked solution (Got it / Partly / Missed); multiple choice and numeric questions are marked by
// the server. Every answer goes through /api/sync and moves mastery, which re-orders the study plan.
// Time running out never throws work away: the student can still mark what they answered.

export type PaperQuestion =
  | {
      kind: "past";
      itemId: string;
      questionId: string;
      text: string;
      marks: number | null;
      topic: string | null;
      label: string;
    }
  | { kind: "mcq"; itemId: string; text: string; options: { id: string; text: string }[]; topic: string | null }
  | { kind: "numeric"; itemId: string; text: string; unit: string | null; topic: string | null };

type Outcome = { kind: "auto"; correct: boolean } | { kind: "self"; mark: "got" | "partly" | "missed" };

const SELF = [
  { mark: "got", label: "Got it" },
  { mark: "partly", label: "Partly" },
  { mark: "missed", label: "Missed" },
] as const;

/** Time on a question, capped at an hour (the sync schema's limit). */
const since = (t: number) => Math.min(3_600_000, Date.now() - t);

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function PracticePaperSession(props: {
  questions: PaperQuestion[];
  minutes: number;
  math: Record<string, string>;
  courseId: string;
}) {
  const { questions, minutes, math, courseId } = props;
  const answer = useAnswer();
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState(minutes * 60);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [solutionShown, setSolutionShown] = useState(false);
  const [marked, setMarked] = useState<Extract<AttemptResult, { status: "recorded" | "duplicate" }> | null>(null);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [error, setError] = useState<string | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [started]);
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index, started]);

  if (questions.length === 0) {
    return (
      <EmptyState
        title="Nothing to put in a paper yet"
        body="Add past questions for this course and check them, then come back for a timed paper."
        action={
          <Button asChild variant="outline">
            <Link href={`/courses/${courseId}?tab=exam`}>Go to Exam prep</Link>
          </Button>
        }
      />
    );
  }

  if (!started) {
    const past = questions.filter((q) => q.kind === "past").length;
    return (
      <div className="grid max-w-2xl gap-4">
        <p className="text-base">
          {questions.length} questions · {minutes} minutes.{" "}
          {past
            ? `${past} past ${past === 1 ? "question" : "questions"}: answer on paper, then mark yourself against the worked solution.`
            : ""}{" "}
          {questions.length - past ? "The rest are marked for you." : ""}
        </p>
        <ActionBar over="screen">
          <Button onClick={() => setStarted(true)}>Start the paper</Button>
        </ActionBar>
      </div>
    );
  }

  if (index >= questions.length) {
    const auto = outcomes.filter((o): o is Extract<Outcome, { kind: "auto" }> => o.kind === "auto");
    const self = outcomes.filter((o): o is Extract<Outcome, { kind: "self" }> => o.kind === "self");
    return (
      <section aria-labelledby="paper-done" className="grid max-w-2xl gap-4">
        <h2 id="paper-done" className="font-display text-xl font-semibold">
          Paper done
        </h2>
        <ul className="grid gap-1 text-base">
          {auto.length ? (
            <li>
              Marked by Ifiok: {auto.filter((o) => o.correct).length} of {auto.length} right
            </li>
          ) : null}
          {self.length ? (
            <li>
              Marked by you: {self.filter((o) => o.mark === "got").length} got it,{" "}
              {self.filter((o) => o.mark === "partly").length} partly, {self.filter((o) => o.mark === "missed").length}{" "}
              missed
            </li>
          ) : null}
          <li className="text-ink-2">
            Time used: {clock(minutes * 60 - left)} of {minutes}:00
          </li>
        </ul>
        <p className="text-sm text-ink-2">Your study plan now puts the topics you missed earlier.</p>
        <ActionBar over="screen">
          <Button asChild>
            <Link href={`/courses/${courseId}?tab=exam`}>Back to Exam prep</Link>
          </Button>
        </ActionBar>
      </section>
    );
  }

  const q = questions[index]!;
  const record = (
    response: { option_id: string } | { value: string } | { self: "got" | "partly" | "missed" },
    outcome?: Outcome,
  ) => {
    setError(null);
    answer.mutate(
      {
        id: crypto.randomUUID(),
        item_id: q.itemId,
        response,
        duration_ms: since(shownAt.current),
      },
      {
        onSuccess: (r) => {
          if (r.status === "not_found") return setError("This question is no longer available. Go to the next one.");
          if (outcome) {
            setOutcomes((o) => [...o, outcome]);
            next();
          } else {
            setMarked(r);
            setOutcomes((o) => [...o, { kind: "auto", correct: r.correct }]);
          }
        },
        onError: (err) => setError(err instanceof ApiError ? err.message : "Your answer wasn't sent. Try again."),
      },
    );
  };
  const next = () => {
    setIndex((i) => i + 1);
    setChoice("");
    setSolutionShown(false);
    setMarked(null);
    setError(null);
  };

  return (
    <MathHtmlProvider value={math}>
      <div className="grid max-w-3xl grid-cols-1 gap-5">
        <div className="grid gap-2">
          <Progress
            value={((index + 1) / questions.length) * 100}
            aria-label={`Question ${index + 1} of ${questions.length}`}
          />
          <p className="flex justify-between text-sm text-ink-2 tabular-nums">
            <span>
              Question {index + 1} of {questions.length}
              {q.topic ? ` · ${q.topic}` : ""}
            </span>
            <span
              className={`inline-flex items-center gap-1 ${left === 0 ? "font-semibold text-bad" : ""}`}
              role="timer"
              aria-live="off"
            >
              <TimerIcon size={16} aria-hidden="true" />
              {left === 0 ? "Time's up: finish marking" : clock(left)}
            </span>
          </p>
        </div>

        {q.kind === "past" ? (
          <p className="text-sm text-ink-2">
            {[q.label, q.marks !== null ? `${q.marks} marks` : null].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className="text-lg leading-relaxed whitespace-pre-line">
          <RichText text={q.text} />
        </p>

        {q.kind === "mcq" ? (
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
        ) : q.kind === "numeric" ? (
          <label htmlFor="paper-answer" className="grid max-w-xs gap-1.5">
            <span className="text-base font-semibold">Your answer{q.unit ? ` (${q.unit})` : ""}</span>
            <Input
              id="paper-answer"
              inputMode="decimal"
              value={choice}
              disabled={Boolean(marked) || answer.isPending}
              onChange={(e) => setChoice(e.target.value)}
            />
          </label>
        ) : (
          <div className="grid gap-3">
            <p className="text-base text-ink-2">
              Write your answer on paper. When you&apos;re done, check it against the worked solution.
            </p>
            <SolutionReveal questionId={q.questionId} onShown={() => setSolutionShown(true)} />
            {solutionShown ? (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-base font-semibold">How did you do?</legend>
                <div className="flex flex-wrap gap-2">
                  {SELF.map((s) => (
                    <Button
                      key={s.mark}
                      variant="outline"
                      disabled={answer.isPending}
                      onClick={() => record({ self: s.mark }, { kind: "self", mark: s.mark })}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
            ) : null}
          </div>
        )}

        {marked ? (
          <div
            role="status"
            className={`grid gap-1 rounded-[var(--radius-input)] border-l-4 px-4 py-3 ${marked.correct ? "border-ok bg-built-soft" : "border-bad bg-change-soft"}`}
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
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}

        <ActionBar over="screen">
          {q.kind === "past" ? (
            <Button variant="outline" onClick={next}>
              Skip this question
            </Button>
          ) : marked || error ? (
            <Button onClick={next}>{index + 1 === questions.length ? "Finish the paper" : "Next question"}</Button>
          ) : (
            <Button
              onClick={() => record(q.kind === "mcq" ? { option_id: choice } : { value: choice.trim() })}
              disabled={!choice.trim() || answer.isPending}
              aria-busy={answer.isPending}
            >
              {answer.isPending ? "Checking…" : "Check"}
            </Button>
          )}
        </ActionBar>
      </div>
    </MathHtmlProvider>
  );
}
