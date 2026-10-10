"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/Button";
import { StepScreen } from "@/components/ui/StepScreen";
import { acceptConsents, type StepState } from "../actions";

const POINTS = [
  {
    title: "Ifiok is an AI, and it can be wrong.",
    body: "Maths is checked by an engine and marks are always estimates. Flag anything that looks off.",
    link: { href: "/ai", label: "How Ifiok uses AI" },
  },
  {
    title: "What you send the AI is shared with Google.",
    body: "Ifiok uses Google's Gemini AI on its free plan. Google may keep your questions, photos and notes, use them to improve its products, and have people review them. Don't include your name, phone number, matric or ID number, even in photos.",
    link: { href: "/ai", label: "How Ifiok uses AI" },
  },
  {
    title: "Your account data is stored outside Nigeria.",
    body: "Your account and progress are stored with our database provider in Ireland (EU), only to run Ifiok.",
    link: { href: "/privacy", label: "Privacy notice" },
  },
  {
    title: "You're 18 or older and learning for yourself.",
    body: "No cheating during exams, and no uploading books or notes you don't have the right to share.",
    link: { href: "/terms", label: "Terms of use" },
  },
];

export function ConsentForm({ returning }: { returning: boolean }) {
  const [state, action] = useActionState<StepState, FormData>(() => acceptConsents(), { status: "idle" });

  return (
    <StepScreen
      step={returning ? undefined : { current: 2, total: 5 }}
      title={returning ? "Our terms have changed" : "Before you start"}
      intro="Four things to know. Tap a link to read more."
      action={
        <form action={action} className="grid gap-2">
          {state.status === "error" ? (
            <p role="alert" className="text-sm text-bad">
              {state.message}
            </p>
          ) : null}
          <SubmitButton pendingLabel="Saving…">I agree</SubmitButton>
        </form>
      }
    >
      <ol className="grid gap-5">
        {POINTS.map((p, i) => (
          <li key={p.title} className="grid grid-cols-[auto_1fr] gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-quantity-soft text-sm font-semibold text-quantity tabular-nums"
            >
              {i + 1}
            </span>
            <div className="grid gap-1">
              <p className="text-base font-semibold">{p.title}</p>
              <p className="text-base text-ink-2">{p.body}</p>
              <Link
                href={p.link.href}
                target="_blank"
                className="inline-flex min-h-11 items-center text-base font-semibold text-quantity underline underline-offset-4"
              >
                {p.link.label}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </StepScreen>
  );
}
