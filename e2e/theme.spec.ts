import { expect, test, type Page } from "@playwright/test";
import { createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// Light and dark mode (12 §4 Q65): the switch on the landing page, in the app and on Me. The choice
// is applied before first paint (no flash), survives a reload, and "Use my device setting" hands
// back to the device.

const theme = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const paper = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.use({ colorScheme: "light" });

test("the landing page switches to dark and remembers it with no flash", async ({ page }) => {
  await page.goto("/");
  const light = await paper(page);
  const toggle = page.locator("header").getByRole("button", { name: "Switch to dark mode" });
  await toggle.click();
  expect(await theme(page)).toBe("dark");
  expect(await paper(page)).not.toBe(light);
  await expect(page.locator("header").getByRole("button", { name: "Switch to light mode" })).toBeVisible();

  // On reload the attribute is already there when the HTML is parsed, before React runs.
  let atParse: string | null = null;
  page.once("domcontentloaded", async () => {
    atParse = await theme(page);
  });
  await page.reload();
  await expect.poll(() => atParse).toBe("dark");
  expect(await theme(page)).toBe("dark");
});

test.describe("in the app", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  let user = { id: "", email: "" };
  test.beforeAll(async () => {
    user = await createOnboardedUser({ university: "UNIUYO", level: 200 });
  });
  test.afterAll(async () => {
    if (user.id) await deleteTestUser(user.id);
  });

  test("Me has System · Light · Dark, and the desktop sidebar has the switch", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, user.email, baseURL!);
    await page.goto("/me");
    const appearance = page.getByRole("region", { name: "Appearance" });
    await expect(appearance.getByRole("radio", { name: "Use my device setting" })).toBeChecked();
    await appearance.getByRole("radio", { name: "Dark" }).check();
    expect(await theme(page)).toBe("dark");
    await page.goto("/today");
    expect(await theme(page)).toBe("dark");
    if (!isMobile) {
      await page.getByRole("complementary").getByRole("button", { name: "Light mode" }).click();
      expect(await theme(page)).toBe("light");
    }
    await page.goto("/me");
    await page.getByRole("radio", { name: "Use my device setting" }).check();
    expect(await theme(page)).toBeNull();
  });
});
