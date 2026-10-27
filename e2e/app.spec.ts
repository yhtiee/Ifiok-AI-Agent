import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectInsideContentArea } from "./helpers/layout";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// The student-app overhaul (specifications/design/app-overhaul.md §7), seeded straight into the
// hosted project with no AI calls: only live features show, one camwood button per view, no
// sideways scroll at 360/412 px or 200 % text, and flows (a)–(d) in a few taps from Today.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/app-${test.info().project.name}-${name}.png`, fullPage: true });
};

const SEARCH = "What do you want to learn?";

/** At most one camwood (primary) control is visible (the wordmark's dot is camwood too, but not a control). */
async function expectOnePrimaryAtMost(page: Page) {
  const primaries = await page
    .locator(":is(a, button).bg-change, :is(a, button).bg-primary")
    .filter({ visible: true })
    .count();
  expect(primaries, `${page.url()} shows ${primaries} camwood buttons`).toBeLessThanOrEqual(1);
}

async function expectNoSidewaysScroll(page: Page) {
  // Compare with the configured width: on an emulated phone the layout viewport grows to fit
  // overflowing content, so innerWidth alone would hide the problem.
  const width = page.viewportSize()!.width;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `${page.url()} is ${scrollWidth}px wide at ${width}px`).toBeLessThanOrEqual(width);
}

async function expectOnlyLiveFeatures(page: Page) {
  await expect(page.getByText(/Opens soon|\bSoon\b/)).toHaveCount(0);
  await expect(page.getByText(/practice questions? ready|Study streak|Topics mastered|Get set up/)).toHaveCount(0);
}

test.describe("student app: only what works, one job per screen", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  const db = adminClient();
  const users: string[] = [];
  const emails = { ada: "", bola: "" };
  const code = `ZTA ${100 + Math.floor(Math.random() * 800)}`;
  let courseId = "";
  const concepts: string[] = [];
  let topicConcept = "";

  test.beforeAll(async () => {
    const ada = await createOnboardedUser({ university: "UNIUYO", level: 100 });
    const bola = await createOnboardedUser({ university: "UNIUYO", level: 100 });
    users.push(ada.id, bola.id);
    emails.ada = ada.email;
    emails.bola = bola.email;
    const { data: profile } = await db.from("profiles").select("university_id").eq("id", ada.id).single();
    const { data: course, error } = await db
      .from("courses")
      .insert({ university_id: profile!.university_id!, code, title: "App overhaul mechanics", created_by: ada.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    courseId = course.id;
    await db.from("enrollments").insert({ user_id: ada.id, course_id: courseId });

    const spec = JSON.parse(readFileSync("content/fixtures/slope-of-a-curve.json", "utf8"));
    const stamp = Date.now();
    for (const [i, title] of ["Slope of a curve", "Rates of change", "Fourier series ztest"].entries()) {
      const { data: c } = await db
        .from("concepts")
        .insert({
          slug: `ztest.app-${stamp}-${i}`,
          title,
          subject: "mathematics",
          level_band: "introductory",
          status: "active",
        })
        .select("id")
        .single();
      concepts.push(c!.id);
    }
    topicConcept = concepts[2]!;
    for (const [i, conceptId] of concepts.slice(0, 2).entries()) {
      await db.from("topics").insert({
        course_id: courseId,
        concept_id: conceptId,
        position: i + 1,
        title: i ? "Rates of change" : "Slope of a curve",
        week: i + 1,
      });
      // A ready lesson for each topic, so opening one never starts generation.
      await db.rpc("publish_private_lesson", {
        p_owner: ada.id,
        p_concept: conceptId,
        p_course: courseId,
        p_spec: spec,
        p_status: "published",
        p_source_refs: [],
        p_sources_used: 0,
        p_model: "fixture",
      });
    }
    // Ada also follows a free-standing topic; Bola has a lesson for it (flow b).
    await db.from("concept_follows").insert({ user_id: ada.id, concept_id: topicConcept });
    for (const owner of [ada.id, bola.id]) {
      await db.rpc("publish_private_lesson", {
        p_owner: owner,
        p_concept: topicConcept,
        p_course: null as unknown as string,
        p_spec: spec,
        p_status: "published",
        p_source_refs: [],
        p_sources_used: 0,
        p_model: "fixture",
      });
    }
  });

  test.afterAll(async () => {
    await db.from("lessons").delete().in("concept_id", concepts);
    if (courseId) await db.from("courses").delete().eq("id", courseId);
    await db.from("concept_follows").delete().in("concept_id", concepts);
    await db.from("concepts").delete().in("id", concepts);
    for (const id of users) await deleteTestUser(id);
  });

  test("navigation: Today, Courses, Practice and Me on phones; Labs too on desktop (Q56)", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, emails.ada, baseURL!);
    await page.goto("/today");
    const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    if (isMobile) {
      await expect(nav.getByRole("link")).toHaveText(["Today", "Courses", "Practice", "Me"]);
      await expect(nav.getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    } else {
      await expect(nav.getByRole("link")).toHaveText(["Today", "Courses", "Practice", "Labs", "Library"]);
      await expect(page.getByRole("complementary").getByRole("link", { name: /Test UNIUYO/ })).toHaveAttribute(
        "href",
        "/me",
      );
    }
    await page.goto("/practice");
    await expect(page.getByRole("heading", { level: 1, name: "Practice" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Weak areas", exact: true })).toBeVisible();
    // Phones reach Labs from Practice; desktop from the sidebar.
    if (isMobile) await page.getByRole("link", { name: /^Labs/ }).click();
    else
      await page
        .getByRole("navigation", { name: "Main" })
        .filter({ visible: true })
        .getByRole("link", { name: "Labs" })
        .click();
    await expect(page).toHaveURL(/\/labs$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Labs" })).toBeVisible();
    await expectOnePrimaryAtMost(page);
  });

  test("flow (a): a new student finds and joins their course in two taps", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.bola, baseURL!);
    await page.goto("/today");
    await expect(page.getByRole("heading", { name: "What are you studying?" })).toBeVisible();
    await expectOnlyLiveFeatures(page);
    await expectOnePrimaryAtMost(page);
    await shot(page, "01-today-start");

    await page.getByRole("link", { name: "Find your course" }).click(); // tap 1
    await expect(page).toHaveURL(/\/courses\?focus=1$/);
    await expect(page.getByLabel(SEARCH)).toBeFocused();
    await page.getByLabel(SEARCH).fill(code);
    const row = page.getByRole("option", { name: new RegExp(`${code} · App overhaul`) });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await shot(page, "02-courses-search");
    await page.getByRole("button", { name: `Join ${code}` }).click(); // tap 2
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}$`), { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(code) })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Path" })).toBeVisible();

    // The quieter way in: a single topic.
    await page.goto("/today");
    await expect(page.getByRole("link", { name: "Or learn a single topic" })).toHaveCount(0); // has a course now
    await page.goto("/courses?focus=1&mode=topic");
    await expect(page.getByPlaceholder("Any topic, like Fourier series")).toBeVisible();
  });

  test("flow (b): a topic without a course opens its lesson", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.bola, baseURL!);
    // Answer the topic lookup locally (no AI): it resolves to the seeded concept.
    await page.route("**/api/learn", (route) =>
      route.fulfill({
        json: {
          status: "following",
          concept: { id: topicConcept, title: "Fourier series ztest", subject: "mathematics" },
        },
      }),
    );
    await page.goto("/courses");
    await page.getByLabel(SEARCH).fill("Fourier series ztest");
    await page.getByRole("option", { name: /Learn “Fourier series ztest” as a topic/ }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${topicConcept}$`), { timeout: 30_000 });
    await expect(page.getByRole("progressbar", { name: /Screen 1 of \d+/ })).toBeVisible({ timeout: 20_000 });
  });

  test("flow (c): from Today to adding materials for a course", async ({ page, context, baseURL, isMobile }) => {
    await signInAs(context, emails.ada, baseURL!);
    await page.goto("/today");
    await page
      .getByRole("navigation", { name: "Main" })
      .filter({ visible: true })
      .getByRole("link", { name: "Courses" })
      .click();
    await page.getByRole("link", { name: new RegExp(`${code} · App overhaul`) }).click();
    await page.getByRole("tab", { name: /Materials/ }).click();
    await expect(page).toHaveURL(/\?tab=materials$/);
    await expect(page.getByText("No materials yet")).toBeVisible();
    await expectOnePrimaryAtMost(page);
    await page.getByRole("link", { name: "Add materials" }).click();
    await expect(page).toHaveURL(new RegExp(`/materials/add\\?course=${courseId}$`));
    await expect(page.getByRole("group", { name: "What is it?" })).toBeVisible();
    if (isMobile) await expect(page.getByRole("link", { name: `Back to ${code}` })).toBeVisible();
  });

  test("Today's Add notes opens the add flow in one tap (12 §4 Q54)", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.ada, baseURL!);
    await page.goto("/today");
    await page.getByRole("link", { name: "Add notes" }).click();
    await expect(page).toHaveURL(/\/materials\/add$/, { timeout: 30_000 });
    await expectOnePrimaryAtMost(page);
  });

  test("flow (d): Today continues the topic worked on last", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.ada, baseURL!);
    await page.goto("/today");
    // Nothing studied yet: the newest course's Next up.
    await expect(page.getByText("Next up", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start Slope of a curve" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Your learning" })).toContainText("Fourier series ztest");

    await page.goto(`/courses/${courseId}`);
    await page
      .getByRole("list", { name: "Topics in order" })
      .getByRole("link", { name: /Rates of change/ })
      .click();
    await expect(page.getByRole("progressbar", { name: /Screen 1 of/ })).toBeVisible({ timeout: 20_000 });
    // MVP-03: "Continue" comes from server evidence, so finish the first screen.
    const synced = page.waitForResponse((r) => r.url().endsWith("/api/sync") && r.ok());
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await synced;

    await page.goto("/today");
    await expect(page.getByText("Continue", { exact: true })).toBeVisible();
    await shot(page, "03-today-continue");
    await page.getByRole("link", { name: "Continue Rates of change" }).click(); // one tap
    await expect(page).toHaveURL(new RegExp(`/learn/${concepts[1]}\\?course=${courseId}$`));
  });

  const SCREENS: [string, (id: string) => string][] = [
    ["today", () => "/today"],
    ["courses", () => "/courses"],
    ["course-path", (id) => `/courses/${id}`],
    ["course-materials", (id) => `/courses/${id}?tab=materials`],
    ["outline", (id) => `/courses/${id}/outline`],
    ["new-course", () => "/courses/new?code=ZTZ%20101"],
    ["add-materials", (id) => `/materials/add?course=${id}`],
    ["add-materials-where", () => "/materials/add"],
    ["lesson", () => `/learn/${concepts[0]}?course=${courseId}`],
    ["me", () => "/me"],
  ];

  test("every screen: one camwood at most, nothing closed, no sideways scroll", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, emails.ada, baseURL!);
    for (const [name, href] of SCREENS) {
      await page.goto(href(courseId));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expectOnlyLiveFeatures(page);
      await expectOnePrimaryAtMost(page);
      await expectNoSidewaysScroll(page);
      await shot(page, `screen-${name}`);
      if (!isMobile) {
        // Laptop widths: nothing in the content area may cross into the sidebar or off the right edge.
        for (const width of [1024, 1280, 1440, 1920]) {
          await page.setViewportSize({ width, height: 940 });
          await shot(page, `screen-${name}-${width}`);
          await expectInsideContentArea(page, `${name} @ ${width}px`);
        }
        await page.setViewportSize({ width: 1280, height: 720 });
      }
      if (isMobile) {
        await page.setViewportSize({ width: 412, height: 860 });
        await expectNoSidewaysScroll(page);
        await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
        await expectNoSidewaysScroll(page);
        await page.setViewportSize({ width: 360, height: 780 });
      }
    }
  });

  test("the course overflow, outline page and lesson menu hold the rare actions", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, emails.ada, baseURL!);
    await page.goto(`/courses/${courseId}`);
    // One list of topics on the course page: no outline panel or history beside the Path.
    await expect(page.getByRole("list", { name: "Topics in order" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Topics in the outline" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "History" })).toHaveCount(0);
    await page.getByRole("button", { name: "Course options" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Edit outline", "Outline history"]);
    await page.getByRole("menuitem", { name: "Outline history" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}/outline#history$`));
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();

    // A followed topic's lesson offers its materials from the header menu.
    await page.goto(`/learn/${topicConcept}`);
    await page.getByRole("button", { name: "Lesson options" }).click();
    await page.getByRole("menuitem", { name: "Add materials for this topic" }).click();
    await expect(page).toHaveURL(new RegExp(`/materials/add\\?topic=${topicConcept}$`));
    await expect(page.getByText(/Adding to Fourier series ztest/)).toBeVisible();
  });
});
