import { expect, test, type Page } from "@playwright/test";
import { expectInsideContentArea } from "./helpers/layout";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-07 on the hosted project: a tutor sets a price; a learner reaches "Approve with PayPal" from
// the topic's tutors (and lands on PayPal's sandbox when it's connected); a contributor adds a
// PayPal email; the admin closes a month whose pool is split with the 20% cap; "Why this amount"
// explains the line with the ledger's numbers; Ifiok's tutoring agent drafts a booking inside the
// student's limit that only their approval turns into a PayPal hold (Q63); admins see only the admin
// interface (Q63). Every money screen says "Sandbox: test money".
// The months used are in 2020, one per Playwright project (they run in parallel), so the demo's
// real months are never touched.

const MONTHS: Record<string, [string, string]> = {
  desktop: ["2020-01", "January 2020"],
  mobile: ["2020-02", "February 2020"],
};
let MONTH = "2020-01";
let MONTH_NAME = "January 2020";
const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/payments-${name}.png`, fullPage: true });
};
const paypalReady = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
// A real sandbox personal account (US) when set, so the payout below really lands.
const RECEIVER = (process.env.PAYPAL_TEST_RECEIVER ?? "ada-sandbox@personal.example.com").toLowerCase();

test.describe("get paid (PayPal sandbox)", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);
  const db = adminClient();
  let ada = { id: "", email: "" };
  let bola = { id: "", email: "" };
  let admin = { id: "", email: "" };
  let conceptId = "";

  const clearMonth = async () => {
    await db.from("payout_periods").delete().eq("month", `${MONTH}-01`);
    await db.from("usage_points").delete().eq("month", `${MONTH}-01`);
  };

  test.beforeAll(async ({}, info) => {
    [MONTH, MONTH_NAME] = MONTHS[info.project.name] ?? ["2020-03", "March 2020"];
    await clearMonth();
    ada = await createOnboardedUser({ university: "UNIUYO", level: 300 });
    bola = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    admin = await createOnboardedUser({ university: "UNIUYO", level: 300 });
    await db.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    const { data: c } = await db
      .from("concepts")
      .insert({
        slug: `ztest.payments-${crypto.randomUUID()}`,
        title: "Thevenin's theorem (payments test)",
        subject: "physics",
        level_band: "introductory",
        status: "active",
      })
      .select("id")
      .single();
    conceptId = c!.id;
    // Ada already offers the topic, without a price yet.
    await db.from("tutor_profiles").insert({ user_id: ada.id, availability: "Weekday evenings after 6 pm" });
    await db.from("tutor_concepts").insert({ user_id: ada.id, concept_id: conceptId });
    const itemId = crypto.randomUUID();
    await db.from("items").insert({
      id: itemId,
      concept_id: conceptId,
      type: "numeric" as const,
      stem: { prompt: "Practice: the Thevenin resistance of two 4 ohm resistors in parallel?" },
      answer: { expected: 2, answer_expr: "4*4/(4+4)", why: "Parallel: product over sum." },
      verification: { type: "numeric", answer_expr: "4*4/(4+4)", stated: 2, tolerance: null },
      origin: "generated",
      status: "published" as const,
    });
    await db.from("attempts").insert(
      [1, 2, 3, 4].map(() => ({
        id: crypto.randomUUID(),
        user_id: bola.id,
        item_id: itemId,
        correct: false,
        response: { value: 8 },
      })),
    );
    // 3 usage points for Ada in the test month (all the month's points, so the 20% cap applies).
    await db.from("usage_points").insert(
      [1, 2, 3].map(() => ({
        resource_kind: "source" as const,
        resource_id: crypto.randomUUID(),
        contributor_id: ada.id,
        consumer_id: bola.id,
        month: `${MONTH}-01`,
      })),
    );
  });

  test.afterAll(async () => {
    await clearMonth();
    await db.from("tutoring_bookings").delete().eq("concept_id", conceptId);
    await db.from("attempts").delete().eq("user_id", bola.id);
    await db.from("items").delete().eq("concept_id", conceptId);
    if (conceptId) await db.from("concepts").delete().eq("id", conceptId);
    for (const u of [ada, bola, admin]) if (u.id) await deleteTestUser(u.id);
  });

  test("a tutor sets a price and a learner reaches PayPal from the topic", async ({ browser, baseURL }) => {
    const adaCtx = await browser.newContext();
    const adaPage = await adaCtx.newPage();
    await signInAs(adaCtx, ada.email, baseURL!);
    await adaPage.goto("/me/tutor");
    await adaPage.getByLabel(/Price per 45-minute session/).fill("200");
    await adaPage.getByRole("button", { name: "Save tutor profile" }).click();
    await expect(adaPage.getByText("Set a price between $3.00 and $50.00.")).toBeVisible();
    await adaPage.getByLabel(/Price per 45-minute session/).fill("8");
    await adaPage.getByRole("button", { name: "Save tutor profile" }).click();
    await expect(adaPage.getByText(/Saved\. Learners see you/)).toBeVisible({ timeout: 20_000 });
    await expect(adaPage.getByText("Sandbox: test money", { exact: false })).toBeVisible();
    await adaCtx.close();

    const bolaCtx = await browser.newContext();
    const page = await bolaCtx.newPage();
    await signInAs(bolaCtx, bola.email, baseURL!);
    await page.goto(`/explainers/${conceptId}`);
    await expect(page.getByRole("region", { name: "Students who tutor this" })).toContainText("$8.00 a session");
    await page.getByRole("link", { name: /^Book .* for Thevenin's theorem/ }).click();
    await expect(page).toHaveURL(/\/tutoring\/new\?/);
    await expect(page.getByText("Sandbox: test money.", { exact: false })).toBeVisible();
    await expect(page.getByText("$8.00", { exact: true })).toBeVisible();
    await expectInsideContentArea(page, "book a tutor");
    await shot(page, "01-book");
    if (paypalReady) {
      await page.getByRole("button", { name: "Approve with PayPal" }).click();
      await page.waitForURL(/sandbox\.paypal\.com/, { timeout: 30_000 });
      const { data: booking } = await db
        .from("tutoring_bookings")
        .select("status, paypal_order_id, price_cents, take_rate_bp")
        .eq("learner_id", bola.id)
        .single();
      expect(booking).toMatchObject({ status: "awaiting_payment", price_cents: 800, take_rate_bp: 1500 });
      expect(booking!.paypal_order_id).toBeTruthy();
    }
    await bolaCtx.close();
  });

  test("Ifiok's tutoring agent drafts a booking inside the student's limit; only approval books it (Q63)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signInAs(ctx, bola.email, baseURL!);
    await page.goto("/practice");
    const agent = page.getByRole("complementary", { name: "Ifiok's tutoring agent" });
    await expect(agent).toContainText("Your limit: $15.00 a session");
    await agent.getByRole("button", { name: "Find me a tutor" }).click();
    // The agent's working, its reason and the draft (real AI, checked by the server, or the rules).
    await expect(agent.getByText(/^Looked at 1 weak topic and 1 tutor within your \$15\.00 limit/)).toBeVisible({
      timeout: 60_000,
    });
    await expect(agent).toContainText("Thevenin's theorem (payments test)");
    await expect(agent).toContainText("$8.00");
    await expect(agent).toContainText("Nothing is booked or paid until you approve it on PayPal.");
    await shot(page, "05-agent");
    const { data: proposal } = await db
      .from("agent_proposals")
      .select("id, status, price_cents, spend_limit_cents, decided_by, reason")
      .eq("user_id", bola.id)
      .single();
    expect(proposal).toMatchObject({ status: "proposed", price_cents: 800, spend_limit_cents: 1500 });
    // Names never reach the prompt, but the student sees the tutor's name in the reason.
    expect(proposal!.reason).not.toMatch(/\{tutor\}|\bT\d\b/);

    await agent.getByRole("link", { name: "Review and approve" }).click();
    await expect(page).toHaveURL(new RegExp(`/tutoring/new\\?proposal=${proposal!.id}`));
    await expect(page.getByText("Drafted by Ifiok's tutoring agent, within your $15.00 limit.")).toBeVisible();
    if (paypalReady) {
      await page.getByRole("button", { name: "Approve with PayPal" }).click();
      await page.waitForURL(/sandbox\.paypal\.com/, { timeout: 30_000 });
      const { data: booking } = await db
        .from("tutoring_bookings")
        .select("id, status, proposed_by, proposal_id, agent_reason")
        .eq("proposal_id", proposal!.id)
        .single();
      expect(booking).toMatchObject({
        status: "awaiting_payment",
        proposed_by: "agent",
        agent_reason: proposal!.reason,
      });
      const { data: after } = await db
        .from("agent_proposals")
        .select("status, booking_id")
        .eq("id", proposal!.id)
        .single();
      expect(after).toEqual({ status: "booked", booking_id: booking!.id });
    }
    await ctx.close();
  });

  test("admins see only the admin interface; students never see it", async ({ browser, baseURL }) => {
    const adminCtx = await browser.newContext();
    const page = await adminCtx.newPage();
    await signInAs(adminCtx, admin.email, baseURL!);
    // Student pages send an admin to the admin interface.
    await page.goto("/today");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("navigation", { name: "Admin" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Courses" })).toHaveCount(0);
    for (const path of ["/me/earnings", "/practice", "/onboarding/level"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin$/);
    }
    await page.goto("/admin/tutoring");
    await expect(page.getByRole("heading", { level: 1, name: "Tutoring" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Tutoring bookings" }).getByRole("grid")).toBeVisible();
    await shot(page, "06-admin-tutoring");
    await adminCtx.close();

    const studentCtx = await browser.newContext();
    const student = await studentCtx.newPage();
    await signInAs(studentCtx, bola.email, baseURL!);
    const res = await student.goto("/admin/payouts");
    expect(res?.status()).toBe(404);
    await studentCtx.close();
  });

  test("the admin closes a month: the pool is split with the 20% cap, and the line is explained", async ({
    browser,
    baseURL,
  }) => {
    const adminCtx = await browser.newContext();
    const page = await adminCtx.newPage();
    await signInAs(adminCtx, admin.email, baseURL!);
    await page.goto("/admin/payouts");
    const money = page.getByRole("form", { name: "Close a month" });
    // Fill until React has hydrated and kept the values: never close the real current month.
    const monthField = money.getByLabel("Month");
    const poolField = money.getByLabel("Pool (USD, sandbox)");
    await expect(async () => {
      await monthField.fill(MONTH);
      await poolField.fill("50.00");
      await page.waitForTimeout(300);
      await expect(monthField).toHaveValue(MONTH, { timeout: 500 });
      await expect(poolField).toHaveValue("50.00", { timeout: 500 });
    }).toPass({ timeout: 20_000 });
    await money.getByRole("button", { name: "Close month" }).click();
    const month = page.getByRole("region", { name: "Payout months" }).getByRole("row").filter({ hasText: MONTH_NAME });
    await expect(month).toContainText("$50.00", { timeout: 20_000 });
    // All 3 points are Ada's, so she gets the cap: 20% of $50.00. The rest stays in the pool.
    await expect(month).toContainText("$10.00");
    await expect(month).toContainText("$40.00");
    await expect(month).toContainText("Closed, not sent");
    const line = page.getByRole("region", { name: "Payout lines" }).getByRole("row").filter({ hasText: MONTH_NAME });
    await expect(line).toContainText("Capped");
    await expect(line).toContainText("Ready");
    await shot(page, "02-admin");
    await adminCtx.close();

    const adaCtx = await browser.newContext();
    const ada2 = await adaCtx.newPage();
    await signInAs(adaCtx, ada.email, baseURL!);
    await ada2.goto("/me/earnings");
    const payouts = ada2.getByRole("region", { name: "Payouts" });
    await expect(payouts.getByText("Sandbox: test money")).toBeVisible();
    await payouts.getByLabel("Your PayPal email").fill(RECEIVER);
    await payouts.getByRole("button", { name: "Save" }).click();
    await expect(payouts.getByText(`Paid to ${RECEIVER}`)).toBeVisible({ timeout: 20_000 });
    const mine = payouts.getByRole("list", { name: "Your payouts" }).getByRole("listitem").first();
    await expect(mine).toContainText(MONTH_NAME);
    await expect(mine).toContainText("$10.00");
    await expect(mine).toContainText("20% cap");
    await mine.getByRole("button", { name: "Why this amount?" }).click();
    // The AI's words or the plain sentence; either way the numbers are the ledger's.
    await expect(mine.locator("p")).toContainText("$10.00", { timeout: 60_000 });
    await expectInsideContentArea(ada2, "my earnings");
    await shot(ada2, "03-earnings");
    const { data: account } = await db.from("payout_accounts").select("paypal_email").eq("user_id", ada.id).single();
    expect(account!.paypal_email).toBe(RECEIVER);
    await adaCtx.close();
  });

  test("the admin sends the month: PayPal pays the line and it is marked paid once", async ({
    browser,
    baseURL,
  }, info) => {
    test.skip(!paypalReady || !process.env.PAYPAL_TEST_RECEIVER, "needs the PayPal sandbox and a sandbox receiver");
    test.skip(info.project.name !== "desktop", "real sandbox money moves once, on desktop");
    const adminCtx = await browser.newContext();
    const page = await adminCtx.newPage();
    await signInAs(adminCtx, admin.email, baseURL!);
    await page.goto("/admin/payouts");
    await page.getByRole("button", { name: `Send payouts for ${MONTH_NAME}` }).click();
    await expect(page.getByText("Sent 1 payouts to PayPal.")).toBeVisible({ timeout: 30_000 });
    // PayPal settles in seconds; "Check PayPal" reads the item status (the webhook does the same).
    const line = page.getByRole("region", { name: "Payout lines" }).getByRole("row").filter({ hasText: MONTH_NAME });
    await expect(async () => {
      await page.getByRole("button", { name: `Check PayPal for ${MONTH_NAME}` }).click();
      await expect(line).toContainText("Paid", { timeout: 5_000 });
    }).toPass({ timeout: 120_000, intervals: [5_000] });
    await shot(page, "04-paid");
    await adminCtx.close();

    // Marked paid exactly once, with the PayPal item recorded; checking again changes nothing.
    const { data: row } = await db
      .from("payout_lines")
      .select("status, paypal_item_id, receiver")
      .eq("user_id", ada.id)
      .single();
    expect(row).toMatchObject({ status: "paid", receiver: RECEIVER });
    expect(row!.paypal_item_id).toBeTruthy();
    const { data: again } = await db.rpc("record_payout_item", {
      p_line: (await db.from("payout_lines").select("id").eq("user_id", ada.id).single()).data!.id,
      p_item_id: row!.paypal_item_id!,
      p_paypal_status: "SUCCESS",
    });
    expect(again).toBe(false);

    const adaCtx = await browser.newContext();
    const ada2 = await adaCtx.newPage();
    await signInAs(adaCtx, ada.email, baseURL!);
    await ada2.goto("/me/earnings");
    await expect(ada2.getByRole("list", { name: "Your payouts" }).getByRole("listitem").first()).toContainText("Paid");
    await adaCtx.close();
  });
});
