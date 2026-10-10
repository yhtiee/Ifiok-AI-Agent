"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonClass, type ButtonVariant as Variant } from "./button-styles";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; full?: boolean };

export function Button({ variant = "primary", full = false, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClass(variant, full)} ${className}`} {...props} />;
}

/** Small inline spinner for pending buttons (an answer to the user's tap, 07 §3.4 rule 6). */
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

type SubmitButtonProps = Omit<ButtonProps, "type"> & {
  pendingLabel: ReactNode;
  /**
   * Pass the action's pending state when the button sits outside its <form> (linked with the
   * `form` attribute, e.g. pinned to the bottom of the screen): useFormStatus only sees the
   * form the button is inside.
   */
  pending?: boolean;
};

/** Submit button that disables itself and shows a spinner and `pendingLabel` while the action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  variant = "primary",
  full = true,
  disabled,
  ...props
}: SubmitButtonProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" variant={variant} full={full} disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function ButtonLink({
  variant = "primary",
  full = false,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; full?: boolean }) {
  return <Link className={`${buttonClass(variant, full)} ${className}`} {...props} />;
}
