"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, ButtonLink, SubmitButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { StepScreen } from "@/components/ui/StepScreen";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { RESEND_SECONDS, useCountdown } from "../use-countdown";
import { requestPasswordReset, resetPassword, type RequestResetState, type ResetState } from "./actions";

// Forgot password (12 §4 Q29): email → 6-digit code + new password, then on to the app.

export function ResetForm({ next }: { next: string }) {
  const [sendState, sendAction, sending] = useActionState<RequestResetState, FormData>(requestPasswordReset, {
    status: "idle",
  });
  const [changingEmail, setChangingEmail] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  // Each successful send starts the resend timer and leaves "change email" mode.
  const sentAt = sendState.status === "sent" ? sendState.sentAt : null;
  if (sentAt !== null && sentAt !== lastSentAt) {
    setLastSentAt(sentAt);
    setChangingEmail(false);
  }

  const signInHref = `/sign-in?next=${encodeURIComponent(next)}`;

  if (sendState.status === "sent" && !changingEmail) {
    return (
      <NewPasswordStep
        key={sendState.sentAt}
        email={sendState.email}
        sentAt={sendState.sentAt}
        next={next}
        sendAction={sendAction}
        onChangeEmail={() => setChangingEmail(true)}
      />
    );
  }

  const emailDefault = sendState.status === "error" || sendState.status === "sent" ? (sendState.email ?? "") : "";

  return (
    <StepScreen
      title="Reset your password"
      intro="Enter the email you signed up with. We'll email you a 6-digit code to set a new password."
      action={
        <SubmitButton form="reset-email-form" pending={sending} pendingLabel="Sending code…">
          Send code
        </SubmitButton>
      }
    >
      <div className="grid gap-4 sm:max-w-md">
        <form id="reset-email-form" action={sendAction} className="grid gap-4" noValidate>
          <TextField
            label="Email address"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={emailDefault}
            error={sendState.status === "error" ? sendState.message : null}
          />
        </form>
        <ButtonLink href={signInHref} variant="quiet" full={false} className="justify-self-start">
          Back to sign in
        </ButtonLink>
      </div>
    </StepScreen>
  );
}

type NewPasswordStepProps = {
  email: string;
  sentAt: number;
  next: string;
  sendAction: (form: FormData) => void;
  onChangeEmail: () => void;
};

function NewPasswordStep({ email, sentAt, next, sendAction, onChangeEmail }: NewPasswordStepProps) {
  const [state, action, saving] = useActionState<ResetState, FormData>(resetPassword, { status: "idle" });
  const secondsLeft = useCountdown(sentAt, RESEND_SECONDS);
  const codeRef = useRef<HTMLInputElement>(null);
  // Controlled, so a refused code doesn't wipe the new password (React resets forms after an action).
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  // Move focus to the code field when this step opens (also tells screen readers where they are).
  useEffect(() => codeRef.current?.focus(), []);

  const error = state.status === "error" ? state : null;

  return (
    <StepScreen
      title="Check your email"
      intro={
        <>
          If there&apos;s an Ifiok account for <span className="font-semibold text-ink">{email}</span>, we sent it a
          6-digit code. It can take a minute to arrive; check spam too.
        </>
      }
      action={
        <SubmitButton form="reset-form" pending={saving} pendingLabel="Saving…">
          Save new password
        </SubmitButton>
      }
    >
      <form id="reset-form" action={action} className="grid gap-4 sm:max-w-md" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <TextField
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          ref={codeRef}
          className="text-xl tracking-[0.3em] tabular-nums"
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          error={error?.field === "code" ? error.message : null}
        />
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={error?.field === "password" ? error.message : null}
        />
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1">
        <form action={sendAction}>
          <input type="hidden" name="email" value={email} />
          {secondsLeft > 0 ? (
            <p className="min-h-11 px-3 py-3 text-sm text-ink-2 tabular-nums" aria-live="polite">
              Send a new code in {secondsLeft} s
            </p>
          ) : (
            <SubmitButton variant="quiet" full={false} pendingLabel="Sending…">
              Send a new code
            </SubmitButton>
          )}
        </form>
        <Button variant="quiet" onClick={onChangeEmail}>
          Use a different email
        </Button>
      </div>
    </StepScreen>
  );
}
