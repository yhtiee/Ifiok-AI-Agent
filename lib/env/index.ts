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
