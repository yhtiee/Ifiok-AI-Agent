import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { requireServerEnv } from "@/lib/env/server";
import type { Database } from "./types";

/**
 * Service-role client: bypasses RLS. Server code only (route handlers, server actions,
 * jobs), and only for the cases the spec names (e.g. completeOnboarding, webhooks, the
 * delete-account flow). Prefer the user-scoped `createClient` from `./server` everywhere else.
 * Money and Units still change only through the SQL functions in 06 §8.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
