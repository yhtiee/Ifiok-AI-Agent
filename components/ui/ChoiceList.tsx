"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "./submit-button";

// Full-width rows, not cards (07 §3.4 rule 2). Each row is a submit button, so picking an option
// is one tap and works without JavaScript. On large screens rows can flow into two columns
// (still rows, separated by hairlines) to cut scrolling.

type ChoiceListProps = {
  label: string;
  children: ReactNode;
  /** Two columns from the lg breakpoint. */
  columns?: 1 | 2;
  /** Cap the height on large screens and scroll inside (for long lists). */
  scroll?: boolean;
};

export function ChoiceList({ label, children, columns = 1, scroll = false }: ChoiceListProps) {
  return (
    <ul
      aria-label={label}
      className={`grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line ${
        columns === 2 ? "lg:grid-cols-2 lg:[&>li:last-child:nth-child(odd)]:col-span-2" : ""
      } ${scroll ? "lg:max-h-[min(28rem,55vh)] lg:overflow-y-auto" : ""}`}
    >
      {children}
    </ul>
  );
}

type ChoiceRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "name" | "value"> & {
  name: string;
  value: string | number;
  title: ReactNode;
  detail?: ReactNode;
  selected?: boolean;
};

export function ChoiceRow({ name, value, title, detail, selected = false, ...props }: ChoiceRowProps) {
  // While the form submits, the tapped row says "Saving…" and every row is locked.
  const { pending, data } = useFormStatus();
  const isSaving = pending && data?.get(name) === String(value);

  return (
    <li className="bg-surface">
      <button
        type="submit"
        name={name}
        value={value}
        aria-pressed={selected}
        aria-busy={isSaving}
        disabled={pending}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper disabled:cursor-wait aria-pressed:bg-quantity-soft"
        {...props}
      >
        <span className="grid gap-0.5">
          <span className="text-base font-semibold">{title}</span>
          {isSaving ? (
            <span className="text-sm text-ink-2">Saving…</span>
          ) : detail ? (
            <span className="text-sm text-ink-2">{detail}</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="shrink-0 text-ink-2">
          {isSaving ? (
            <Spinner className="text-change" />
          ) : selected ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M4 10.5l4 4 8-9"
                stroke="var(--quantity)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M8 5l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        {selected ? <span className="sr-only">(current choice)</span> : null}
      </button>
    </li>
  );
}
