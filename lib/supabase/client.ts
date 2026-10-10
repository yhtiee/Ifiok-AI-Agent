import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client for client components. Uses the publishable key, so every read and write
 * goes through RLS. Only for RLS-protected reads and low-stakes writes (02 §2); learning
 * evidence goes through /api/sync, and anything that costs or touches money through the server.
 * `createBrowserClient` returns one shared instance per browser tab.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
