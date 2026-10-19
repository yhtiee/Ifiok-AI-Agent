import { parseEnv, publicEnvSchema } from "./schema";

// Public env, safe in client bundles. Each NEXT_PUBLIC_ variable is read by its literal name,
// because Next.js only inlines `process.env.NEXT_PUBLIC_X` written out in full.
export const publicEnv = parseEnv(publicEnvSchema, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  NEXT_PUBLIC_PRIVACY_EMAIL: process.env.NEXT_PUBLIC_PRIVACY_EMAIL,
  NEXT_PUBLIC_MINORS_EMAIL: process.env.NEXT_PUBLIC_MINORS_EMAIL,
});

/**
 * Absolute origin of this deployment (no trailing slash) for canonicals, share images, robots and
 * the sitemap. Required for production builds; dev and tests fall back to localhost.
 */
export function getSiteUrl(): string {
  const url = publicEnv.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for production builds. Set it to this deployment's origin.");
  }
  return "http://localhost:3000";
}
