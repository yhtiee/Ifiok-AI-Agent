import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";

/** Absolute origin of this deployment, for auth redirect URLs. */
export async function siteOrigin(): Promise<string> {
  if (publicEnv.NEXT_PUBLIC_SITE_URL) return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Which sign-in providers the Supabase project has switched on (cached for 5 minutes). */
export async function authProviders(): Promise<{ google: boolean; email: boolean }> {
  try {
    const res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
    });
    const json = (await res.json()) as { external?: { google?: boolean; email?: boolean } };
    return { google: json.external?.google === true, email: json.external?.email !== false };
  } catch {
    return { google: false, email: true };
  }
}

/** Optional contact addresses (set once the domain exists, 12 §4 Q7). */
export const contacts = {
  privacy: publicEnv.NEXT_PUBLIC_PRIVACY_EMAIL ?? null,
  minors: publicEnv.NEXT_PUBLIC_MINORS_EMAIL ?? null,
};
