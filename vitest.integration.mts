import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: the real Supabase project and AI providers (pnpm test:integration).
// Keys come from .env / .env.local. Not part of pnpm check.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // not present
  }
}

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": fileURLToPath(new URL("./scripts/empty-module.ts", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/integration.test.ts", "**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
