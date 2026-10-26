import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  birthMonthTurning18Now,
  createOnboardedUser,
  createTestUser,
  deleteTestUser,
  hasSupabaseAdmin,
  signInAs,
  testEmail,
  userIdFor,
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

  test("sign-in asks for an email and password and explains a bad email", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in to Ifiok" })).toBeVisible();
    await shot(page, "01-sign-in");
    await page.getByLabel("Email address").fill("ada@");
    await page.getByLabel("Password", { exact: true }).fill("whatever123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter a full email address" })).toBeVisible();
  });

  test("the password can be shown, and create account keeps the typed email", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("ada@example.com");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret-pass");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Create an account" }).click();
    await expect(page.getByRole("heading", { name: "Create your Ifiok account" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveValue("ada@example.com");
    await expect(page.getByText("At least 8 characters.")).toBeVisible();
    await shot(page, "01-create-account");

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Obi");
    await page.getByLabel("Password", { exact: true }).fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "at least 8 characters" })).toBeVisible();
  });

  test("without an email provider there is no password reset to get stuck in", async ({ page }) => {
    test.skip(process.env.AUTH_PASSWORD_RESET === "true", "password reset is on");
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in to Ifiok" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveCount(0);
    await page.goto("/sign-in/reset");
    await expect(page).toHaveURL(/\/sign-in$/);
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

  test("a student creates an account with a password, signs out and signs back in", async ({ page }) => {
    const email = testEmail();
    const password = `pw-${Date.now()}-ok`;

    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);

    // Names are required, and a refused attempt keeps what was typed.
    await page.getByLabel("First name").fill("Chiamaka");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Enter your last name." })).toBeVisible();
    await expect(page.getByLabel("First name")).toHaveValue("Chiamaka");
    await page.getByLabel("Last name").fill("Okonkwo");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // No confirmation email (Q28): the new account goes straight to onboarding.
    await expect(page).toHaveURL(/\/onboarding$/);
    const id = await userIdFor(email, password);
    expect(id).not.toBeNull();
    created.push(id!);
    const { data: named } = await adminClient()
      .from("profiles")
      .select("first_name, last_name, display_name")
      .eq("id", id!)
      .single();
    expect(named).toEqual({ first_name: "Chiamaka", last_name: "Okonkwo", display_name: "Chiamaka O." });

    // Signing up again with the same email says so.
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("First name").fill("Someone");
    await page.getByLabel("Last name").fill("Else");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("another-password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already an account" })).toBeVisible();

    // A wrong password gets one message that doesn't reveal whether the account exists.
    await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Sign in to Ifiok" })).toBeVisible();
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();

    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "When were you born?" })).toBeVisible();
  });

  test("a student who forgot their password resets it with an emailed code", async ({ page }) => {
    test.skip(process.env.AUTH_PASSWORD_RESET !== "true", "password reset is off until an email provider is connected");
    const oldPassword = `old-${Date.now()}-pw`;
    const newPassword = `new-${Date.now()}-pw`;
    const user = await createTestUser({ password: oldPassword });
    created.push(user.id);

    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await shot(page, "01-reset");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    // A wrong code is refused and the password stays the same.
    await page.getByLabel("6-digit code").fill("000000");
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "wrong or has expired" })).toBeVisible();

    // The code from the email (taken from the admin API here; example.com gets no mail).
    const { data, error } = await adminClient().auth.admin.generateLink({ type: "recovery", email: user.email });
    const code = data?.properties?.email_otp;
    if (error || !code) throw new Error(`generateLink failed: ${error?.message}`);
    await page.getByLabel("6-digit code").fill(code);
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/\/onboarding$/);
    expect(await userIdFor(user.email, newPassword)).toBe(user.id);
    expect(await userIdFor(user.email, oldPassword)).toBeNull();
  });

  test("a student updates their name on Me and Today greets them by it", async ({ page, context, baseURL }) => {
    const user = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    created.push(user.id);
    await signInAs(context, user.email, baseURL!);

    await page.goto("/today");
    await expect(page.getByTestId("greeting")).toHaveText(/^Good (morning|afternoon|evening), Test$/);
    await page.goto("/me");
    const first = page.getByLabel("First name");
    await expect(first).toHaveValue("Test");
    const save = page.getByRole("button", { name: "Save name" });
    await expect(save).toBeDisabled(); // nothing changed yet
    await first.fill("Adébáyọ̀");
    await page.getByLabel("Last name").fill("Okon");
    await save.click();
    await expect(page.getByText("Name saved.")).toBeVisible();
    await shot(page, "09-me-name");

    // Today greets them by it, and a bad name is explained, not saved.
    await page.goto("/today");
    await expect(page.getByTestId("greeting")).toHaveText(/, Adébáyọ̀$/);
    await page.goto("/me");
    await page.getByLabel("Last name").fill("0k0n");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Use letters for your last name")).toBeVisible();
    const { data } = await adminClient().from("profiles").select("first_name, last_name").eq("id", user.id).single();
    expect(data).toEqual({ first_name: "Adébáyọ̀", last_name: "Okon" });
  });

  test("an adult signs up, agrees and reaches an empty Today in 12 taps or fewer", async ({
    page,
    context,
    baseURL,
  }) => {
    const user = await createTestUser();
    created.push(user.id);
    // Password sign-in costs 1 tap ("Sign in"; typing isn't counted).
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
    // The Start state: one question, one way in (app-overhaul §5.1).
    await expect(page.getByRole("heading", { level: 1, name: /^Good (morning|afternoon|evening)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What are you studying?" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Find your course" })).toBeVisible();
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
