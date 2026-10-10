import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/onboarding";
import { passwordResetEnabled } from "@/lib/auth/sign-in-mode";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/sign-in/reset">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  // Without an email provider there is no way to send the code (Q29).
  if (!passwordResetEnabled()) redirect("/sign-in");
  return <ResetForm next={next} />;
}
