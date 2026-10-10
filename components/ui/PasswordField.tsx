"use client";

import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

// Password input with a Show/Hide toggle (students type on small phone keyboards; seeing the
// password avoids typos). Labelled, with hint and announced error like the other fields.

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
};

export function PasswordField({ label, hint, error, className = "", ...props }: Props) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-base font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={Boolean(error)}
          autoCapitalize="none"
          spellCheck={false}
          className={`min-h-12 w-full rounded-[var(--radius-input)] border border-line bg-surface pr-14 pl-3 text-base text-ink aria-[invalid=true]:border-bad ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[var(--radius-input)] text-ink-2 hover:text-ink"
        >
          {visible ? <EyeSlashIcon size={20} aria-hidden="true" /> : <EyeIcon size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-2">
          {hint}
        </p>
      ) : null}
      <p id={errorId} role="alert" className={error ? "text-sm text-bad" : "sr-only"}>
        {error ?? ""}
      </p>
    </div>
  );
}
