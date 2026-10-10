import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Refreshes the Supabase session on each matched request and writes any rotated auth
 * cookies to both the request (for server components in this render) and the response.
 * Route protection (redirects to sign-in, the 18+ gate) is added in P0-04.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          // Responses that set auth cookies must never be cached by a CDN.
          for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
        },
      },
    },
  );

  // Don't run code between createServerClient and getClaims: it validates the JWT and
  // triggers the refresh. Returning `response` (not a new one) keeps the refreshed cookies.
  await supabase.auth.getClaims();

  return response;
}
