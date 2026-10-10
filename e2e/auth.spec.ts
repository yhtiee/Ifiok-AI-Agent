import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  birthMonthTurning18Now,
  createTestUser,
  deleteTestUser,
  hasSupabaseAdmin,
  signInAs,
} from "./helpers/supabase";

// P0-04: sign-in, the 18+ gate, consents and onboarding, against the real Supabase project.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: true });
}

test.describe("signed out", () => {
  test("app and onboarding pages send visitors to sign-in", async ({ page }) => {
    for (const path of ["/today", "/onboarding", "/onboarding/consent"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in$/);
    }
  });

  test("until an email provider is connected, a production build says sign-in opens soon", async ({ page }) => {
    test.skip(process.env.AUTH_EMAIL_CODES === "true", "email codes are on");
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign-in opens soon" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveCount(0);
    await shot(page, "01-sign-in-closed");
  });

  test("sign-in asks for an email and explains a bad one without sending anything", async ({ page }) => {
    test.skip(process.env.AUTH_EMAIL_CODES !== "true", "email codes are off until a provider is connected");
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in to Ifiok" })).toBeVisible();
    await shot(page, "01-sign-in");
    await page.getByLabel("Email address").fill("ada@");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a full email address" })).toBeVisible();
  });

  test("the AI stub refuses signed-out callers", async ({ request }) => {
    const res = await request.get("/api/ai/stub");
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: { message: "Sign in to continue.", code: "unauthenticated" } });
  });

  test("legal pages are public", async ({ page }) => {
    for (const [path, heading] of [
      ["/terms", "Terms of use"],
      ["/privacy", "Privacy notice"],
      ["/ai", "How Ifiok uses AI"],
    ]) {
      await page.goto(path!);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }
  });
});

test.describe("with a real account", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  // These tests create and delete real auth users; one at a time keeps the project tidy.
  test.describe.configure({ mode: "serial" });
  // Each step round-trips to the hosted Supabase project; allow for network latency.
  test.setTimeout(90_000);

  const created: string[] = [];
  test.afterAll(async () => {
    for (const id of created) await deleteTestUser(id);
  });

  test("an adult signs up, agrees and reaches an empty Today in 12 taps or fewer", async ({
    page,
    context,
    baseURL,
  }) => {
    const user = await createTestUser();
    created.push(user.id);
    // Email sign-in costs 1 tap ("Send code"; the code submits itself when typed).
    let taps = 1;
    await signInAs(context, user.email, baseURL!);

    // Before the age gate, every AI route refuses this user.
    expect((await page.request.get("/api/ai/stub")).status()).toBe(403);

    await page.goto("/today");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
    await shot(page, "02-birth");
    await page.getByLabel("Month").selectOption("4"); // open + pick = 2 taps
    await page.getByLabel("Year").selectOption("1999"); // 2 taps
    await page.getByRole("button", { name: "Continue" }).click();
    taps += 5;

    await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
    await shot(page, "03-consent");
    await page.getByRole("button", { name: "I agree" }).click();
    taps += 1;

    await expect(page.getByRole("heading", { name: "Where do you study?" })).toBeVisible();
    await page.getByLabel("Search").fill("uyo");
    await shot(page, "04-university");
    await page.getByRole("button", { name: /University of Uyo/ }).click();
    taps += 2; // focus search + tap row (typing isn't counted)

    await expect(page.getByRole("heading", { name: "What level are you in?" })).toBeVisible();
    await shot(page, "05-level");
    await page.getByRole("button", { name: /200 level/ }).click();
    taps += 1;

    await expect(page.getByRole("heading", { name: "How long can you study each day?" })).toBeVisible();
    await shot(page, "06-minutes");
    await page.getByRole("button", { name: /30 minutes/ }).click();
    taps += 1;

    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { level: 1, name: "Start learning" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Learn a course" })).toBeVisible();
    await expect(page.getByText("2 of 5 done")).toBeVisible();
    await shot(page, "07-today");
    expect(taps).toBeLessThanOrEqual(12);

    // What the server stored: month and year only, adult, consents with version, onboarded.
    const db = adminClient();
    const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).single();
    expect(profile).toMatchObject({ birth_year: 1999, birth_month: 4, is_adult: true, level: 200, daily_minutes: 30 });
    expect(profile?.onboarded_at).not.toBeNull();
    const { data: consents } = await db.from("consents").select("kind, version").eq("user_id", user.id);
    expect(consents?.map((c) => c.kind).sort()).toEqual(["ai_disclosure", "privacy", "terms"]);

    // Now AI routes accept them, and finished users can't reopen the age gate.
    expect((await page.request.get("/api/ai/stub")).status()).toBe(200);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/today$/);

    // Signing out (from Me, available on every screen size) ends the session.
    await page.goto("/me");
    await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("an under-18 sign-up leaves nothing behind", async ({ page, context, baseURL }) => {
    const user = await createTestUser();
    created.push(user.id);
    await signInAs(context, user.email, baseURL!);

    await page.goto("/onboarding");
    const { year, month } = birthMonthTurning18Now();
    await page.getByLabel("Month").selectOption(String(month));
    await page.getByLabel("Year").selectOption(String(year));
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(/\/onboarding\/not-yet$/);
    await expect(page.getByRole("heading", { name: /for students 18 and older/ })).toBeVisible();
    await shot(page, "08-not-yet");

    const db = adminClient();
    const { data: authUser } = await db.auth.admin.getUserById(user.id);
    expect(authUser.user).toBeNull();
    const { count: profiles } = await db.from("profiles").select("*", { count: "exact", head: true }).eq("id", user.id);
    expect(profiles).toBe(0);
    const { count: consents } = await db
      .from("consents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    expect(consents).toBe(0);

    // The old session is gone too.
    await page.goto("/today");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
