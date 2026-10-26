"use client";

import {
  CalendarBlankIcon,
  ExamIcon,
  FileTextIcon,
  HourglassMediumIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionBar, EmptyState, Row, RowList, SectionHeading } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanDay } from "@/lib/agent/planner";
import { SESSION_WORDS, sessionHref } from "@/lib/exam/sessions";
import { useSetExamDate } from "@/lib/queries/exam";
import { ApiError } from "@/lib/query/api";

// The course's Exam prep tab (10 MVP-04, F8): papers being read or waiting for review, the exam date
// and the next days of the study plan, and topics by share of marks across the uploaded papers.
// Counts and shares only, never predictions (guardrail 13). One camwood action: a practice paper.

export type ExamPrepView = {
  courseId: string;
  papers: number;
  weighted: boolean;
  questions: number;
  unassigned: number;
  pending: { sourceId: string; title: string; status: "reading" | "review" | "failed"; found: number }[];
  topics: { conceptId: string; title: string; text: string }[];
  plan: { examDate: string; days: PlanDay[]; overflow: { titles: string[]; suggestedMinutes: number } | null } | null;
};

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

export function ExamPrepPanel({ view }: { view: ExamPrepView }) {
  const router = useRouter();
  const reading = view.pending.some((p) => p.status === "reading");
  // While Ifiok reads a paper, check back every few seconds for the review.
  useEffect(() => {
    if (!reading) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [reading, router]);

  const addHref = `/materials/add?course=${view.courseId}`;
  return (
    <div className="grid gap-8 xl:grid-cols-2 xl:gap-16">
      <div className="grid content-start gap-8">
        {view.pending.length ? (
          <section aria-labelledby="papers-pending" className="grid gap-3">
            <SectionHeading id="papers-pending">Past questions to review</SectionHeading>
            <RowList labelledBy="papers-pending">
              {view.pending.map((p) =>
                p.status === "review" ? (
                  <Row
                    key={p.sourceId}
                    href={`/courses/${view.courseId}/exam/review/${p.sourceId}`}
                    icon={<FileTextIcon size={22} />}
                    tone="add"
                    title={p.title}
                    meta={`Ifiok found ${p.found} ${p.found === 1 ? "question" : "questions"}. Check them before they're saved.`}
                  />
                ) : (
                  <Row
                    key={p.sourceId}
                    icon={p.status === "reading" ? <HourglassMediumIcon size={22} /> : <WarningCircleIcon size={22} />}
                    tone="plain"
                    title={p.title}
                    meta={
                      p.status === "reading"
                        ? "Reading the questions… about a minute"
                        : "Ifiok couldn't read questions from these pages. Delete them in Materials and add them again."
                    }
                  />
                ),
              )}
            </RowList>
          </section>
        ) : null}

        <StudyPlanSection view={view} onSaved={() => router.refresh()} />
      </div>

      <section aria-labelledby="exam-topics" className="grid content-start gap-3">
        <SectionHeading id="exam-topics">What the papers ask</SectionHeading>
        {view.papers === 0 ? (
          <EmptyState
            title="No past questions yet"
            body="Add past questions for this course. Ifiok reads them, you check the list, then you see which topics they ask and how many marks each carries."
          />
        ) : (
          <>
            <p className="text-sm text-ink-2">
              From {view.papers} {view.papers === 1 ? "paper" : "papers"} ({view.questions} questions)
              {view.weighted ? ", newer papers counting more." : ". Add more papers for a fuller picture."}
              {view.unassigned ? ` ${view.unassigned} not matched to a topic.` : ""}
            </p>
            <RowList labelledBy="exam-topics">
              {view.topics.map((t) => (
                <Row
                  key={t.conceptId}
                  href={`/courses/${view.courseId}/exam/questions#topic-${t.conceptId}`}
                  icon={<ExamIcon size={22} />}
                  tone="course"
                  title={t.title}
                  meta={t.text}
                />
              ))}
            </RowList>
            <p className="flex flex-wrap gap-x-5">
              <Link
                href={`/courses/${view.courseId}/exam/questions`}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-quantity hover:underline"
              >
                All past questions and solutions
              </Link>
              <Link
                href={addHref}
                className="inline-flex min-h-11 items-center text-sm font-semibold text-quantity hover:underline"
              >
                Add another paper
              </Link>
            </p>
          </>
        )}
      </section>

      <ActionBar>
        {view.questions ? (
          <Button asChild>
            <Link href={`/courses/${view.courseId}/exam/paper`}>Start a timed practice paper</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href={addHref}>Add past questions</Link>
          </Button>
        )}
      </ActionBar>
    </div>
  );
}

function StudyPlanSection({ view, onSaved }: { view: ExamPrepView; onSaved: () => void }) {
  const setDate = useSetExamDate(view.courseId);
  const [date, setDateValue] = useState(view.plan?.examDate ?? "");
  const [editing, setEditing] = useState(!view.plan);
  const upcoming = view.plan?.days.filter((d) => d.sessions.length).slice(0, 3) ?? [];

  return (
    <section aria-labelledby="study-plan" className="grid gap-3">
      <SectionHeading id="study-plan">Study plan</SectionHeading>
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            setDate.mutate(date, {
              onSuccess: () => {
                setEditing(false);
                onSaved();
              },
            });
          }}
        >
          <label htmlFor="exam-date" className="grid gap-1.5">
            <span className="text-base font-semibold">When is the exam?</span>
            <Input
              id="exam-date"
              type="date"
              value={date}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-48"
              required
            />
          </label>
          <Button type="submit" variant="outline" disabled={!date || setDate.isPending} aria-busy={setDate.isPending}>
            {setDate.isPending ? "Planning…" : "Plan my study"}
          </Button>
          {setDate.isError ? (
            <p role="alert" className="w-full text-sm text-bad">
              {setDate.error instanceof ApiError ? setDate.error.message : "That didn't save. Try again."}
            </p>
          ) : null}
        </form>
      ) : view.plan ? (
        <div className="grid gap-3">
          <p className="flex flex-wrap items-center gap-x-3 text-base">
            <CalendarBlankIcon size={20} className="text-ink-2" aria-hidden="true" />
            Exam on <span className="font-semibold">{dayLabel(view.plan.examDate)}</span>
            <span className="text-ink-2">· {view.plan.days.length} days to go</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-quantity hover:underline"
            >
              Change
            </button>
          </p>
          {view.plan.overflow ? (
            <p className="rounded-[var(--radius-input)] border border-line bg-paper px-4 py-3 text-sm">
              {view.plan.overflow.titles.length}{" "}
              {view.plan.overflow.titles.length === 1 ? "topic doesn't" : "topics don't"} fit before the exam at your
              daily time. About {view.plan.overflow.suggestedMinutes} minutes a day would fit them; change it in Me.
            </p>
          ) : null}
          <ol className="grid gap-3">
            {upcoming.map((d) => (
              <li key={d.date} className="grid gap-1">
                <p className="text-sm font-semibold text-ink-2">{dayLabel(d.date)}</p>
                <ul className="grid gap-1">
                  {d.sessions.map((s, i) => (
                    <li key={i}>
                      <Link href={sessionHref(view.courseId, s)} className="group grid gap-0.5 py-1 text-base">
                        <span className="group-hover:underline">
                          <span className="font-semibold">{SESSION_WORDS[s.kind]}:</span> {s.title}
                        </span>
                        <span className="text-sm text-ink-2">
                          {s.why} · {s.minutes} min
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          <Link
            href={`/courses/${view.courseId}/exam/plan`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-quantity hover:underline"
          >
            The whole plan, day by day
          </Link>
        </div>
      ) : null}
    </section>
  );
}
