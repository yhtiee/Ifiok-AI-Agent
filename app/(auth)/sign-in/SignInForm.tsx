"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button, SubmitButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { StepScreen } from "@/components/ui/StepScreen";
import { sendCode, signInWithGoogle, verifyCode, type SendCodeState, type VerifyState } from "./actions";

const RESEND_SECONDS = 60;

type Props = {
  next: string;
  googleEnabled: boolean;
  /** "code" sends a 6-digit code; "dev" signs in without email (next dev only); "off" hides email. */
  emailMode: "code" | "dev" | "off";
  initialError: string | null;
};

export function SignInForm({ next, googleEnabled, emailMode, initialError }: Props) {
  const [sendState, sendAction, sending] = useActionState<SendCodeState, FormData>(sendCode, { status: "idle" });
  const [changingEmail, setChangingEmail] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);

  // Each successful send starts the resend timer and leaves "change email" mode.
  const sentAt = sendState.status === "sent" ? sendState.sentAt : null;
  if (sentAt !== null && sentAt !== lastSentAt) {
    setLastSentAt(sentAt);
    setChangingEmail(false);
  }

  if (sendState.status === "sent" && !changingEmail) {
    return (
      <CodeStep
        key={sendState.sentAt}
        email={sendState.email}
        sentAt={sendState.sentAt}
        next={next}
        sendAction={sendAction}
        onChangeEmail={() => setChangingEmail(true)}
      />
    );
  }

  const error = sendState.status === "error" ? sendState.message : initialError;
  const emailDefault = sendState.status === "error" || sendState.status === "sent" ? (sendState.email ?? "") : "";

  if (emailMode === "off" && !googleEnabled) {
    return (
      <StepScreen
        title="Sign-in opens soon"
        intro="Ifiok is getting ready for its first students. Check back shortly; nothing is needed from you yet."
      />
    );
  }

  const devMode = emailMode === "dev";

  return (
    <StepScreen
      title="Sign in to Ifiok"
      intro="New here? The same steps create your account. Ifiok is for students 18 and older."
      action={
        emailMode === "off" ? undefined : (
          <SubmitButton form="email-form" pending={sending} pendingLabel={devMode ? "Signing in…" : "Sending code…"}>
            {devMode ? "Continue" : "Send code"}
          </SubmitButton>
        )
      }
    >
      <div className="grid gap-6 sm:max-w-md">
        {emailMode === "off" ? null : (
          <form id="email-form" action={sendAction} className="grid gap-4 sm:max-w-md" noValidate>
            <input type="hidden" name="next" value={next} />
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
              error={error}
              hint={
                devMode
                  ? "Development sign-in: no email is sent, you're signed in straight away."
                  : "We'll email you a 6-digit code. No password needed."
              }
            />
          </form>
        )}

        {googleEnabled ? (
          <>
            {emailMode === "off" ? null : (
              <div className="flex items-center gap-3 text-sm text-ink-2" aria-hidden="true">
                <span className="h-px flex-1 bg-line" />
                or
                <span className="h-px flex-1 bg-line" />
              </div>
            )}
            <form action={signInWithGoogle}>
              <input type="hidden" name="next" value={next} />
              <SubmitButton variant="secondary" pendingLabel="Opening Google…">
                <GoogleMark />
                Continue with Google
              </SubmitButton>
            </form>
          </>
        ) : null}
      </div>
    </StepScreen>
  );
}

type CodeStepProps = {
  email: string;
  sentAt: number;
  next: string;
  sendAction: (form: FormData) => void;
  onChangeEmail: () => void;
};

function CodeStep({ email, sentAt, next, sendAction, onChangeEmail }: CodeStepProps) {
  const [verifyState, verifyAction, verifying] = useActionState<VerifyState, FormData>(verifyCode, {
    status: "idle",
  });
  const secondsLeft = useCountdown(sentAt, RESEND_SECONDS);
  const formRef = useRef<HTMLFormElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Move focus to the code field when this step opens (also tells screen readers where they are).
  useEffect(() => codeRef.current?.focus(), []);

  return (
    <StepScreen
      title="Check your email"
      intro={
        <>
          We sent a 6-digit code to <span className="font-semibold text-ink">{email}</span>. It can take a minute to
          arrive; check spam too.
        </>
      }
      action={
        <SubmitButton form="code-form" pending={verifying} pendingLabel="Checking…">
          Sign in
        </SubmitButton>
      }
    >
      <form id="code-form" ref={formRef} action={verifyAction} className="grid gap-4 sm:max-w-md" noValidate>
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
          error={verifyState.status === "error" ? verifyState.message : null}
          hint="Got a link instead of a code? Open it on this phone to sign in."
          onChange={(e) => {
            // Submit as soon as all six digits are in: one less tap.
            if (/^\d{6}$/.test(e.currentTarget.value)) formRef.current?.requestSubmit();
          }}
        />
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1">
        <form action={sendAction}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="next" value={next} />
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

/** Seconds left until `seconds` after `from`. The code step remounts on every resend. */
function useCountdown(from: number, seconds: number) {
  const [left, setLeft] = useState(() => Math.max(0, seconds - Math.floor((Date.now() - from) / 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - from) / 1000));
      setLeft(next);
      if (next === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [from, seconds]);
  return left;
}

function GoogleMark() {
  // Google's "G" mark, as required by their branding guidelines for sign-in buttons.
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-4 7-9.9 7-17.1z"
      />
      <path
        fill="#FBBC05"
        d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}
