import { expect, test, type Page } from "@playwright/test";

// The judge accounts (scripts/seed-judges.mts, 10 MVP-08): signed in exactly as a judge would,
// with email and password on the real sign-in page. Read-only: it doesn't run the agent or move
// money, so the demo stays at its starting point. Skips until JUDGE_PASSWORD is set.

const password = process.env.JUDGE_PASSWORD ?? "";
const domain = process.env.JUDGE_EMAIL_DOMAIN || "judges.ifiok.test";

async function signIn(page: Page, who: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`${who}@${domain}`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe("judge accounts", () => {
  test.skip(!password, "run scripts/seed-judges.mts with JUDGE_PASSWORD first");
  test.setTimeout(90_000);

  test("Student 1 has a weak topic, the tutoring agent and the demo course", async ({ page }) => {
    await signIn(page, "student1");
    await expect(page).toHaveURL(/\/today$/, { timeout: 30_000 });
    await page.goto("/practice");
    const weak = page.getByRole("region", { name: "Weak areas" });
    await expect(weak).toContainText("Kirchhoff's laws");
    await expect(page.getByRole("complementary", { name: "Ifiok's tutoring agent" })).toContainText(
      "Your limit: $15.00 a session",
    );
    await page.goto("/courses");
    await expect(page.getByText("IFK 102", { exact: false }).first()).toBeVisible();
  });

  test("Student 2 tutors, shares and has usage points this month", async ({ page }) => {
    await signIn(page, "student2");
    await expect(page).toHaveURL(/\/today$/, { timeout: 30_000 });
    await page.goto("/me/earnings");
    await expect(page.getByText("Kirchhoff's laws: worked notes")).toBeVisible();
    await expect(page.getByText("In the library", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Payouts" })).toContainText("Sandbox: test money");
    await page.goto("/me/tutor");
    await expect(page.getByLabel(/Price per 45-minute session/)).toHaveValue("8.00");
  });

  test("the admin lands in the admin interface", async ({ page }) => {
    await signIn(page, "admin");
    await page.waitForURL(/\/(today|admin)$/, { timeout: 30_000 });
    await page.goto("/today");
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/payouts");
    await expect(page.getByRole("heading", { level: 1, name: "Payouts" })).toBeVisible();
  });
});
