import { mkdirSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminClient } from "./helpers/supabase";

// Devpost gallery (MVP-08): real screens of the running app, signed in as the judge accounts, saved
// to submission/gallery at 3:2 (1500 × 1000 at 2×). Only runs with GALLERY=1 (desktop project). It
// tidies up what it creates (the agent's draft, the booking, the closed month), so the judges'
// demo stays at its starting point. Usage: GALLERY=1 PW_CHANNEL=chrome pnpm exec playwright test
// e2e/gallery.spec.ts --project=desktop

const OUT = "submission/gallery";
const password = process.env.JUDGE_PASSWORD ?? "";
const domain = process.env.JUDGE_EMAIL_DOMAIN || "judges.ifiok.test";

test.skip(!process.env.GALLERY || !password, "set GALLERY=1 and JUDGE_PASSWORD to capture the gallery");
test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);

const db = adminClient();
const ids = { s1: "", courseId: "", kvl: "" };
const month = `${new Date().toISOString().slice(0, 7)}-01`;

async function session(browser: Browser, who: string, phone = false) {
  const ctx = await browser.newContext(
    phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 },
  );
  const page = await ctx.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`${who}@${domain}`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(today|admin)$/, { timeout: 30_000 });
  return { ctx, page };
}

async function shot(page: Page, name: string) {
  // Let fonts, images and any toast settle; screenshots are the visible viewport only.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  ids.s1 = users.users.find((u) => u.email === `student1@${domain}`)!.id;
  ids.courseId = (await db.from("courses").select("id").eq("code_norm", "IFK102").single()).data!.id;
  ids.kvl = (await db.from("concepts").select("id").eq("slug", "phy.kirchhoffs-laws").single()).data!.id;
});

test.afterAll(async () => {
  // Back to the starting point the judges get.
  await db.from("tutoring_bookings").delete().eq("learner_id", ids.s1).in("status", ["awaiting_payment", "cancelled"]);
  await db.from("agent_proposals").delete().eq("user_id", ids.s1);
  await db.from("payout_periods").delete().eq("month", month).eq("status", "computed");
});

test("landing page", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("/");
  await shot(page, "01-landing");
  await ctx.close();
});

test("Student 1: course Path, a lesson, weak areas and the tutoring agent", async ({ browser }) => {
  const { ctx, page } = await session(browser, "student1");
  await shot(page, "02-today");

  await page.goto(`/courses/${ids.courseId}`);
  await expect(page.getByRole("list", { name: "Topics in order" })).toBeVisible({ timeout: 30_000 });
  await shot(page, "03-course-path");

  await page.goto(`/learn/${ids.kvl}?course=${ids.courseId}`);
  await expect(page.getByRole("button", { name: /Next|Continue/ }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "04-lesson");

  await page.goto("/practice");
  const agent = page.getByRole("complementary", { name: "Ifiok's tutoring agent" });
  await agent.getByRole("button", { name: "Find me a tutor" }).click();
  await expect(agent.getByText(/^Looked at/)).toBeVisible({ timeout: 60_000 });
  await agent.scrollIntoViewIfNeeded();
  await shot(page, "05-practice-tutoring-agent");

  await agent.getByRole("link", { name: "Review and approve" }).click();
  await expect(page.getByText("Drafted by Ifiok's tutoring agent", { exact: false })).toBeVisible({ timeout: 30_000 });
  await shot(page, "06-agent-booking-draft");
  // Creates the PayPal order (so the admin's Tutoring table has it); the PayPal page isn't captured.
  await page.getByRole("button", { name: "Approve with PayPal" }).click();
  await page.waitForURL(/paypal\.com/, { timeout: 30_000 });

  await page.goto("/library");
  await shot(page, "07-library");
  await ctx.close();
});

test("Student 2: earnings, payouts and tutor profile", async ({ browser }) => {
  const { ctx, page } = await session(browser, "student2");
  await page.goto("/me/earnings");
  await expect(page.getByRole("region", { name: "Payouts" })).toBeVisible({ timeout: 30_000 });
  await shot(page, "08-earnings");
  await page.goto("/me/tutor");
  await expect(page.getByLabel(/Price per 45-minute session/)).toHaveValue("8.00");
  await shot(page, "09-tutor-profile");
  await ctx.close();
});

test("Admin: payouts and tutoring grids", async ({ browser }) => {
  const { ctx, page } = await session(browser, "admin");
  await page.goto("/admin/payouts");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Close month" }).click();
  await expect(page.getByRole("region", { name: "Payout lines" }).getByRole("row").nth(1)).toBeVisible({
    timeout: 30_000,
  });
  // Wait for the "Month closed" toast to go, so it doesn't cover the lines.
  await expect(page.getByText("Month closed.", { exact: false })).toBeHidden({ timeout: 15_000 });
  await shot(page, "10-admin-payouts");
  await page.goto("/admin/tutoring");
  await expect(page.getByRole("region", { name: "Tutoring bookings" }).getByRole("grid")).toBeVisible();
  await shot(page, "11-admin-tutoring");
  await ctx.close();
});

test("On a phone: Today, lesson and tutoring agent", async ({ browser }) => {
  const { ctx, page } = await session(browser, "student1", true);
  await page.screenshot({ path: `${OUT}/phone-today.png` });
  await page.goto(`/learn/${ids.kvl}?course=${ids.courseId}`);
  await expect(page.getByRole("button", { name: /Next|Continue/ }).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/phone-lesson.png` });
  await page.goto("/practice");
  const agent = page.getByRole("complementary", { name: "Ifiok's tutoring agent" });
  await agent.getByRole("button", { name: "Find me a tutor" }).click();
  await expect(agent.getByText(/^Looked at/)).toBeVisible({ timeout: 60_000 });
  await agent.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/phone-agent.png` });
  await ctx.close();
});
