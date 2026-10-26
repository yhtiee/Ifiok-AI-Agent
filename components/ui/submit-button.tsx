"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/** Small inline spinner for short pending buttons (an answer to the user's tap, 07 §3.4 rule 6). */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type SubmitButtonProps = Omit<ButtonProps, "type" | "asChild"> & {
  pendingLabel: ReactNode;
  /**
   * Pass the action's pending state when the button sits outside its <form> (linked with the
   * `form` attribute, e.g. pinned to the bottom of the screen), or when a client form submits
   * itself: useFormStatus only sees a server action on the form the button is inside.
   */
  pending?: boolean;
  /** Show the spinner while pending (sign-in and onboarding; app screens use the label only). */
  spinner?: boolean;
};

/** Submit button that disables itself and shows `pendingLabel` while the form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  spinner = true,
  full = true,
  disabled,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" full={full} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          {spinner ? <Spinner /> : null}
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
