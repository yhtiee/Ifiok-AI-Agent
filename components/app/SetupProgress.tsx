"use client";

import { usePathname } from "next/navigation";

// Desktop left panel on sign-in and onboarding: the setup steps on a vertical Ink Line (07 §3.1):
// finished steps in green (built up), the current one in camwood (the action), the rest in ink.

const STEPS = [
  { path: "/sign-in", label: "Sign in" },
  { path: "/onboarding", label: "Your age" },
  { path: "/onboarding/consent", label: "Before you start" },
  { path: "/onboarding/university", label: "Your university" },
  { path: "/onboarding/level", label: "Your level" },
  { path: "/onboarding/minutes", label: "Your study time" },
];

export function SetupProgress() {
  const pathname = usePathname();
  // Password reset (/sign-in/reset) is part of the sign-in step.
  const current = STEPS.findIndex((s) => s.path === (pathname.startsWith("/sign-in/") ? "/sign-in" : pathname));
  if (current === -1) return null;

  return (
    <ol aria-label="Setup steps" className="grid">
      {STEPS.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={step.path} className="relative flex min-h-12 items-start gap-3">
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute top-6 left-[11px] h-[calc(100%-12px)] w-0.5 rounded-full ${
                  i < current ? "bg-built" : "bg-line"
                }`}
              />
            ) : null}
            <span
              aria-hidden="true"
              className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                state === "done"
                  ? "border-built bg-built"
                  : state === "current"
                    ? "border-change bg-surface"
                    : "border-line bg-surface"
              }`}
            >
              {state === "done" ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="var(--surface)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : null}
            </span>
            <span
              className={`pt-0.5 text-base ${
                state === "current" ? "font-semibold text-ink" : state === "done" ? "text-ink-2" : "text-ink-3"
              }`}
              aria-current={state === "current" ? "step" : undefined}
            >
              {step.label}
              {state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
