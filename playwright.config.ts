import { defineConfig, devices } from "@playwright/test";

// Tests that touch the hosted Supabase project read keys from the same env files as Next.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
// PW_CHANNEL=chrome uses the installed Chrome instead of Playwright's bundled Chromium.
const channel = process.env.PW_CHANNEL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    // E2E_COLOR_SCHEME=dark runs every test in dark mode (tokens switch on prefers-color-scheme).
    colorScheme: process.env.E2E_COLOR_SCHEME === "dark" ? "dark" : "light",
    trace: "retain-on-failure",
  },
  projects: [
    // Mobile first (07 §5): a mid-range Android at 360 px.
    { name: "mobile", use: { ...devices["Galaxy S9+"], viewport: { width: 360, height: 780 }, channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Production builds need the site origin (lib/env getSiteUrl); CI sets it, local runs default to this server.
    env: { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${PORT}` },
  },
});
