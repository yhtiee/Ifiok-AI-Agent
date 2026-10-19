"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, SubmitButton } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { PasswordField } from "@/components/ui/PasswordField";
import { StepScreen } from "@/components/ui/StepScreen";
import { NAME_MAX } from "@/lib/auth/name-limits";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  sendCode,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  verifyCode,
  type PasswordState,
  type SendCodeState,
  type VerifyState,
} from "./actions";
import { RESEND_SECONDS, useCountdown } from "./use-countdown";

type Mode = "signin" | "signup" | "code";

type Props = {
  next: string;
  googleEnabled: boolean;
  /** Emailed 6-digit codes, only once an email provider is connected (12 §4 Q28). */
  codesEnabled: boolean;
  /** Password reset by emailed code, only once an email provider is connected (12 §4 Q29). */
  resetEnabled: boolean;
  initialError: string | null;
  /** "signup" when the visitor came from a "Start learning free" link (`/sign-in?mode=signup`). */
  initialMode?: "signin" | "signup";
};

export function SignInForm({
  next,
  googleEnabled,
  codesEnabled,
  resetEnabled,
  initialError,
  initialMode = "signin",
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // Keep what the student typed when they switch between sign in and create account.
  const [email, setEmail] = useState("");

  if (mode === "code" && codesEnabled) {
    return <CodeFlow next={next} initialEmail={email} onUsePassword={() => setMode("signin")} />;
  }

  const signingUp = mode === "signup";
  return (
    <PasswordForm
      key={mode}
      signingUp={signingUp}
      next={next}
      email={email}
      onEmailChange={setEmail}
      initialError={signingUp ? null : initialError}
      onSwitch={() => setMode(signingUp ? "signin" : "signup")}
      onUseCode={codesEnabled ? () => setMode("code") : undefined}
      resetHref={resetEnabled && !signingUp ? `/sign-in/reset?next=${encodeURIComponent(next)}` : undefined}
      googleEnabled={googleEnabled}
    />
  );
}

type PasswordFormProps = {
  signingUp: boolean;
  next: string;
  email: string;
  onEmailChange: (email: string) => void;
  initialError: string | null;
  onSwitch: () => void;
  onUseCode?: () => void;
  resetHref?: string;
  googleEnabled: boolean;
};

function PasswordForm({
  signingUp,
  next,
  email,
  onEmailChange,
  initialError,
  onSwitch,
  onUseCode,
  resetHref,
  googleEnabled,
}: PasswordFormProps) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    signingUp ? signUpWithPassword : signInWithPassword,
    { status: "idle" },
  );
  // Controlled, so a refused attempt doesn't wipe the names (React resets forms after an action).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const fieldError = (field: "first_name" | "last_name" | "email" | "password") =>
    state.status === "error"
      ? state.field === field
        ? state.message
        : null
      : field === "password"
        ? initialError
        : null;

  return (
    <StepScreen
      title={signingUp ? "Create your Ifiok account" : "Sign in to Ifiok"}
      intro={
        signingUp
          ? "Use your email and a password you'll remember. Ifiok is for students 18 and older."
          : "Welcome back. Ifiok is for students 18 and older."
      }
      action={
        <SubmitButton
          form="password-form"
          pending={pending}
          pendingLabel={signingUp ? "Creating account…" : "Signing in…"}
        >
          {signingUp ? "Create account" : "Sign in"}
        </SubmitButton>
      }
    >
      <div className="grid gap-6 sm:max-w-md">
        <form id="password-form" action={action} className="grid gap-4" noValidate>
          <input type="hidden" name="next" value={next} />
          {signingUp ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="First name"
                name="first_name"
                autoComplete="given-name"
                autoCapitalize="words"
                maxLength={NAME_MAX}
                required
                value={firstName}
                onChange={(e) => setFirstName(e.currentTarget.value)}
                error={fieldError("first_name")}
              />
              <TextField
                label="Last name"
                name="last_name"
                autoComplete="family-name"
                autoCapitalize="words"
                maxLength={NAME_MAX}
                required
                value={lastName}
                onChange={(e) => setLastName(e.currentTarget.value)}
                error={fieldError("last_name")}
              />
            </div>
          ) : null}
          <TextField
            label="Email address"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => onEmailChange(e.currentTarget.value)}
            error={fieldError("email")}
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
            minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
            hint={signingUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            error={fieldError("password")}
          />
          {resetHref ? (
            <Link
              href={resetHref}
              className="-mt-2 flex min-h-11 items-center justify-self-start text-sm font-semibold text-quantity underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          ) : null}
        </form>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm text-ink-2">{signingUp ? "Already have an account?" : "New to Ifiok?"}</p>
          <Button variant="quiet" full={false} onClick={onSwitch}>
            {signingUp ? "Sign in" : "Create an account"}
          </Button>
        </div>

        {onUseCode ? (
          <Button variant="quiet" full={false} onClick={onUseCode}>
            Email me a sign-in code instead
          </Button>
        ) : null}

        {googleEnabled ? (
          <>
            <div className="flex items-center gap-3 text-sm text-ink-2" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>
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

type CodeFlowProps = { next: string; initialEmail: string; onUsePassword: () => void };

/** Emailed-code sign-in: ask for the email, then the 6-digit code. */
function CodeFlow({ next, initialEmail, onUsePassword }: CodeFlowProps) {
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

  const emailDefault =
    sendState.status === "error" || sendState.status === "sent" ? (sendState.email ?? initialEmail) : initialEmail;

  return (
    <StepScreen
      title="Sign in with a code"
      intro="We'll email you a 6-digit code. New here? The same steps create your account."
      action={
        <SubmitButton form="email-form" pending={sending} pendingLabel="Sending code…">
          Send code
        </SubmitButton>
      }
    >
      <div className="grid gap-4 sm:max-w-md">
        <form id="email-form" action={sendAction} className="grid gap-4" noValidate>
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
            error={sendState.status === "error" ? sendState.message : null}
          />
        </form>
        <Button variant="quiet" full={false} onClick={onUsePassword}>
          Use my password instead
        </Button>
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
