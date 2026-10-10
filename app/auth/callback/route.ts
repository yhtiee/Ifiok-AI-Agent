import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";

// Finishes Google sign-in and emailed sign-in links (PKCE): swaps the one-time code for a
// session cookie, then sends the user on. Onboarding guards route new users to the age gate.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/sign-in?error=link", url.origin));
}
