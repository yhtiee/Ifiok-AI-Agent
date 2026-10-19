import type { NextConfig } from "next";
import { parseEnv, serverEnvSchema } from "./lib/env/schema";

// Fail fast: `next dev` and `next build` stop here with a clear message if env vars are wrong.
// NEXT_PUBLIC_SITE_URL is checked when pages prerender (getSiteUrl in lib/env, called by the root
// layout, robots and sitemap), not here: `next typegen` loads this file in the build phase too.
parseEnv(serverEnvSchema, process.env);

const nextConfig: NextConfig = {
  // Shared pure-TS package (packages/core) ships as TypeScript source.
  transpilePackages: ["@ifiok/core"],
};

export default nextConfig;
