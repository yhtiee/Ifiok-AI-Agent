import { expect, test, type Page } from "@playwright/test";
import { compileExperiment, publicExperiment } from "../packages/core/src/labs/experiment";
import { OHMS_LAW } from "../packages/core/src/labs/fixtures";
import { expectInsideContentArea } from "./helpers/layout";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-05 on the hosted project. (1) A seeded Ohm's-law lab, run end to end: readings, best-fit line,
// the student's R, the comparison and the printable report; the run is saved by the server.
// (2) Live AI: a requested "Hooke's law" lab and a pasted pendulum manual become labs; a
// non-measurement activity is declined, not faked.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/labs-${name}.png`, fullPage: true });
};

// A made-up manual for this test (not a real university's manual).
const MANUAL = `PHY 107 Laboratory Manual. Experiment 4: The simple pendulum.
Aim: to determine the acceleration due to gravity g using a simple pendulum.
Apparatus: pendulum bob, thread, retort stand and clamp, stopwatch, metre rule.
Method: Set the length L of the pendulum to 0.30 m. Displace the bob through a small angle and time 20 complete oscillations with the stopwatch. Repeat the timing. Increase L in steps of 0.10 m up to 1.20 m, timing 20 oscillations twice for each length.
Calculate the period T = t/20 for each length. Plot T squared against L. Find the slope of the graph and calculate g = 4 pi squared divided by the slope.
Precautions: keep the angle of swing small. Start and stop the stopwatch as the bob passes the lowest point.`;

test.describe("virtual labs", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  const db = adminClient();
  let userId = "";
  let email = "";
  let courseId = "";
  let labId = "";
  const concepts: string[] = [];

  test.beforeAll(async () => {
    const ada = await createOnboardedUser({ university: "UNIUYO", level: 100 });
    userId = ada.id;
    email = ada.email;
    const { data: profile } = await db.from("profiles").select("university_id").eq("id", userId).single();
    const { data: course, error } = await db
      .from("courses")
      .insert({
        university_id: profile!.university_id!,
        code: `ZTL ${100 + Math.floor(Math.random() * 800)}`,
        title: "Labs test physics",
        subject: "physics",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    courseId = course.id;
    await db.from("enrollments").insert({ user_id: userId, course_id: courseId });
    // An outline topic, so the course has its tabs.
    const { data: c } = await db
      .from("concepts")
      .insert({
        slug: `ztest.labs-${crypto.randomUUID()}`,
        title: "Current electricity",
        subject: "physics",
        level_band: "introductory",
        status: "active",
      })
      .select("id")
      .single();
    concepts.push(c!.id);
    await db
      .from("topics")
      .insert({ course_id: courseId, concept_id: c!.id, position: 1, title: "Current electricity" });

    // A private lab from "their manual", seeded with the verified Ohm's-law configuration.
    const { data: source } = await db
      .from("sources")
      .insert({ owner_id: userId, course_id: courseId, kind: "lab_manual", title: "Electricity manual" })
      .select("id")
      .single();
    const compiled = compileExperiment(OHMS_LAW);
    const { data: lab, error: labError } = await db
      .from("labs")
      .insert({
        owner_id: userId,
        origin: "manual",
        source_id: source!.id,
        title: OHMS_LAW.title,
        subject: "physics",
        status: "ready",
        config: OHMS_LAW as never,
        public_config: publicExperiment(compiled) as never,
        config_hash: "e2e",
        created_by: userId,
      })
      .select("id")
      .single();
    if (labError) throw new Error(labError.message);
    labId = lab.id;
    await db.from("user_labs").insert({ user_id: userId, lab_id: labId, course_id: courseId });
  });

  test.afterAll(async () => {
    if (courseId) await db.from("courses").delete().eq("id", courseId);
    if (concepts.length) await db.from("concepts").delete().in("id", concepts);
    if (userId) {
      await db.from("labs").delete().eq("owner_id", userId);
      await deleteTestUser(userId);
    }
  });

  test("an Ohm's-law lab: readings → graph → R → comparison → report", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/courses/${courseId}?tab=labs`);
    await expect(page.getByRole("tab", { name: "Labs", selected: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Ohm's law/ })).toContainText("From your manual, Electricity manual");
    await shot(page, "01-course-tab");
    await page.getByRole("link", { name: /Ohm's law/ }).click();
    await expect(page).toHaveURL(new RegExp(`/labs/${labId}$`), { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: "Aim" })).toBeVisible({ timeout: 30_000 });
    // The true resistance never reaches the page before the comparison.
    expect(await page.content()).not.toContain('"hidden"');
    await page.getByRole("button", { name: "Start the experiment" }).click();

    const take = page.getByRole("button", { name: /^Take reading \d of \d$/ });
    await expect(take).toBeVisible({ timeout: 20_000 });
    for (let i = 0; i < 12; i++) await take.click();
    await expect(page.getByRole("table")).toContainText("Mean");
    await expect(page.locator("figcaption")).toContainText("6 points");
    await expectInsideContentArea(page, "lab readings");
    await shot(page, "02-readings");

    await page.getByRole("button", { name: "Analyse the results" }).click();
    await page.getByRole("button", { name: "Draw the best-fit line" }).click();
    const gradient = Number(
      (await page.getByText(/^Gradient of the best-fit line:/).innerText()).replace(/^[^:]+:\s*/, ""),
    );
    expect(gradient).toBeGreaterThan(40);
    // R = gradient (V against I).
    await page.getByLabel(/Your value of R/).fill(String(gradient));
    await page.getByRole("button", { name: "Check my result" }).click();
    await expect(page.getByRole("status")).toContainText("accepted 47", { timeout: 20_000 });
    await expect(page.getByRole("status")).toContainText("Within the ±2%");
    await expect(page.getByRole("heading", { name: "Lab report: Ohm's law" })).toBeVisible();
    await expectInsideContentArea(page, "lab report");
    await shot(page, "03-report");

    // The printed report has no app chrome or buttons.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print the report" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Lab report: Ohm's law" })).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    const { data: runs } = await db.from("lab_runs").select("lab_id, score").eq("user_id", userId);
    expect(runs).toHaveLength(1);
    expect(runs![0]!.lab_id).toBe(labId);
  });

  test("text mode lists the method and keeps the readings as a table", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/labs/${labId}`);
    await page.getByLabel("Text mode").check({ timeout: 30_000 });
    await page.getByRole("button", { name: "Start the experiment" }).click();
    const take = page.getByRole("button", { name: /^Take reading \d of \d$/ });
    for (let i = 0; i < 4; i++) await take.click();
    await expect(page.locator("main figure svg")).toHaveCount(0);
    await expect(page.getByText(/^Plot of V \(V\) against I \(A\): 2 points/)).toBeVisible();
  });

  test("live: a requested Hooke's law lab, a pasted manual, and a declined activity", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, email, baseURL!);

    // A practical by name: built (or already shared) and opened.
    await page.goto(`/courses/${courseId}?tab=labs`);
    await page.getByLabel("Which practical?").fill("Hooke's law", { timeout: 30_000 });
    await page.getByRole("button", { name: "Request a lab" }).click();
    const hooke = page.getByRole("link", { name: /Hooke/ });
    await expect(
      page
        .getByText("Building the lab… about a minute")
        .or(hooke)
        .or(page.getByRole("heading", { name: "Aim" })),
    ).toBeVisible({ timeout: 30_000 });
    if (!/\/labs\/[0-9a-f-]{36}$/.test(page.url())) {
      await expect(hooke).toBeVisible({ timeout: 180_000 });
      await expect(hooke).toContainText("Generated from the topic, not your manual");
    }

    // Not a measurement: declined with a reason.
    await page.goto(`/courses/${courseId}?tab=labs`);
    await page.getByLabel("Which practical?").fill("Dissection of a toad", { timeout: 30_000 });
    await page.getByRole("button", { name: "Request a lab" }).click();
    await expect(page.getByText(/Not available as a virtual lab/)).toBeVisible({ timeout: 180_000 });
    await shot(page, "04-declined");

    // A lab manual: its practical becomes a private lab.
    await page.goto(`/materials/add?course=${courseId}`);
    await page.getByRole("radio", { name: "Lab manual" }).check();
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByLabel("Name").fill("PHY 107 manual");
    await page.getByLabel("Text").fill(MANUAL);
    await page.getByRole("button", { name: "Add text" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=labs$`), { timeout: 30_000 });
    const pendulum = page.getByRole("link", { name: /pendulum/i });
    await expect(pendulum).toBeVisible({ timeout: 180_000 });
    await expect(pendulum).toContainText("From your manual, PHY 107 manual");
    await shot(page, "05-manual-lab");
  });
});
