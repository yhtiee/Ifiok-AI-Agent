import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { CONSENT_VERSION, REQUIRED_CONSENTS } from "./consent";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type Viewer = {
  userId: string;
  email: string | null;
  profile: Profile;
  /** Agreed to the current version of every required consent. */
  consented: boolean;
};

/**
 * The signed-in user and their profile, once per request. Null when signed out, or when the
 * session belongs to a user whose profile no longer exists (e.g. an under-18 account we deleted).
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const [{ data: profile }, { data: consents }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("consents").select("kind").eq("version", CONSENT_VERSION).is("revoked_at", null),
  ]);
  if (!profile) return null;

  const kinds = new Set((consents ?? []).map((c) => c.kind));
  return {
    userId,
    email: typeof data.claims.email === "string" ? data.claims.email : null,
    profile,
    consented: REQUIRED_CONSENTS.every((k) => kinds.has(k)),
  };
});
