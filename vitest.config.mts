import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    // Server modules import "server-only"; tests run them directly.
    alias: { "server-only": fileURLToPath(new URL("./scripts/empty-module.ts", import.meta.url)) },
  },
  test: {
    // Node by default; component tests opt in with `// @vitest-environment jsdom`.
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    // Integration tests hit real services: run them with `pnpm test:integration`.
    exclude: ["**/node_modules/**", ".next/**", "e2e/**", "**/*.integration.test.ts", "**/integration.test.ts"],
  },
});
