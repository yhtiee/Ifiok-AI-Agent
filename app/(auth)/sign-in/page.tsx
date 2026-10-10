import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { STEP_PATHS, requiredStep, safeNextPath } from "@/lib/auth/onboarding";
import { emailCodesEnabled, passwordResetEnabled } from "@/lib/auth/sign-in-mode";
import { getViewer } from "@/lib/auth/viewer";
import { authProviders } from "@/lib/site";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email and password.",
  link: "That sign-in link has expired or was already used. Sign in with your email and password.",
};

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  const viewer = await getViewer();
  if (viewer) {
    const step = requiredStep(viewer);
    redirect(step ? STEP_PATHS[step] : next);
  }

  const providers = await authProviders();
  const errorKey = typeof params.error === "string" ? params.error : null;

  return (
    <SignInForm
      next={next}
      googleEnabled={providers.google}
      codesEnabled={emailCodesEnabled()}
      resetEnabled={passwordResetEnabled()}
      initialError={errorKey ? (ERRORS[errorKey] ?? null) : null}
    />
  );
}
