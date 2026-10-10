import type { NextConfig } from "next";
import { parseEnv, serverEnvSchema } from "./lib/env/schema";

// Fail fast: `next dev` and `next build` stop here with a clear message if env vars are wrong.
parseEnv(serverEnvSchema, process.env);

const nextConfig: NextConfig = {
  // Shared pure-TS package (packages/core) ships as TypeScript source.
  transpilePackages: ["@ifiok/core"],
};

export default nextConfig;
