"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Panel } from "@/components/app/Page";

type GenerationWaitingProps = {
  /** Show the build step list (the lesson is being generated now). */
  building?: boolean;
  quickExplainer?: string;
  /** Status panel content when not building (waiting, review, failed). */
  children?: ReactNode;
};

type StepStatus = "done" | "active" | "pending";

/**
 * The waiting screen (F2-FR4): the step list while a lesson is built, plus the labelled quick
 * explanation so the student can start learning straight away. Display only: LessonClient owns
 * the data.
 */
export function GenerationWaiting({ building = false, quickExplainer, children }: GenerationWaitingProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!building) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [building]);

  // Step progress is an estimate from elapsed time; the job reports only its overall status.
  const steps: { title: string; desc: string; status: StepStatus }[] = [
    { title: "Concept and level", desc: "What this lesson must cover, at your level", status: "done" },
    {
      title: "Approved course material",
      desc: "Checking notes other students have shared and Ifiok has approved",
      status: elapsed >= 4 ? "done" : "active",
    },
    {
      title: "Screens and worked examples",
      desc: "Short screens, plots and checkpoints",
      status: elapsed >= 25 ? "done" : elapsed >= 4 ? "active" : "pending",
    },
    {
      title: "Checks",
      desc: "Maths, sources and every number in the lesson",
      status: elapsed >= 25 ? "active" : "pending",
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:gap-6">
      <div className="grid content-start gap-4 lg:gap-6">
        {building ? (
          <Panel
            title="Building your lesson"
            action={<span className="text-sm text-ink-2 tabular-nums">{elapsed}s · usually under 2 minutes</span>}
          >
            <ul className="grid divide-y divide-line" aria-live="polite">
              {steps.map((s) => (
                <StepItem key={s.title} {...s} />
              ))}
            </ul>
          </Panel>
        ) : (
          <Panel title="Your lesson">{children}</Panel>
        )}
      </div>

      {quickExplainer ? (
        <Panel title="Quick explanation while your lesson is built">
          <p className="text-base leading-relaxed text-ink">{quickExplainer}</p>
        </Panel>
      ) : null}
    </div>
  );
}

const STATUS_TEXT: Record<StepStatus, string> = { done: "Done", active: "In progress", pending: "Next" };

function StepItem({ title, desc, status }: { title: string; desc: string; status: StepStatus }) {
  return (
    <li className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden="true"
        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
          status === "done" ? "bg-built" : status === "active" ? "border-2 border-change" : "border border-line"
        }`}
      />
      <div className="grid gap-0.5">
        <div className={`text-base font-semibold ${status === "pending" ? "text-ink-3" : "text-ink"}`}>
          {title} <span className="text-sm font-normal text-ink-2">· {STATUS_TEXT[status]}</span>
        </div>
        <div className="text-sm text-ink-2">{desc}</div>
      </div>
    </li>
  );
}
