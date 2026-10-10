import { expect, test, type Page } from "@playwright/test";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// P1-01 "Done when", against the real Supabase project and Gemini (free tier, synthetic content).
// Runs once (desktop project) because it makes real AI calls.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/courses-${name}.png`, fullPage: true });
};

test.describe("student-created courses, outlines and concepts", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.skip(({ isMobile }) => isMobile, "real AI calls: run once, on desktop");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  const users: string[] = [];
  const courseCode = `ZTS ${100 + Math.floor(Math.random() * 800)}`; // a code nobody else uses
  let courseUrl = "";

  test.afterAll(async () => {
    const db = adminClient();
    const { data: courses } = await db.from("courses").select("id").in("created_by", users);
    for (const c of courses ?? []) await db.from("courses").delete().eq("id", c.id);
    await db.from("concepts").delete().in("created_by", users);
    for (const id of users) await deleteTestUser(id);
  });

  test("a student creates a course and types its outline", async ({ page, context, baseURL }) => {
    const ada = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    users.push(ada.id);
    await signInAs(context, ada.email, baseURL!);

    await page.goto("/courses");
    await page.getByLabel("What do you want to learn?").fill(courseCode);
    await shot(page, "01-search");
    await page.getByRole("link", { name: new RegExp(`Add ${courseCode}`) }).click();

    await expect(page.getByRole("heading", { name: "Add a course" })).toBeVisible();
    await expect(page.getByLabel("Course code")).toHaveValue(courseCode);
    await page.getByLabel("Course title").fill("Test calculus for students");
    await page.getByLabel("Subject").selectOption("mathematics");
    await page.getByRole("button", { name: "Add course" }).click();

    // A similar title might exist from earlier data; if asked, create ours anyway.
    const createAnyway = page.getByRole("button", { name: /None of these/ });
    if (await createAnyway.isVisible({ timeout: 8_000 }).catch(() => false)) await createAnyway.click();

    await expect(page.getByRole("heading", { level: 1, name: new RegExp(courseCode) })).toBeVisible({
      timeout: 30_000,
    });
    courseUrl = page.url();
    await shot(page, "02-empty-course");

    await page.getByRole("button", { name: /Type topics/ }).click();
    const titles = page.getByPlaceholder("For example, Limits and continuity");
    await titles.nth(0).fill("Limits of a function");
    await titles.nth(1).fill("Continuity");
    await titles.nth(2).fill("Differentiation from first principles");
    await shot(page, "03-editor");
    await page.getByRole("button", { name: "Save outline" }).click();

    await expect(page.getByText("Outline saved.")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("Differentiation from first principles")).toBeVisible();
    await shot(page, "04-outline");

    const courseId = courseUrl.split("/").pop()!;
    const { data: topics } = await adminClient()
      .from("topics")
      .select("title, concept_id")
      .eq("course_id", courseId)
      .is("archived_at", null)
      .order("position");
    expect(topics?.map((t) => t.title)).toEqual([
      "Limits of a function",
      "Continuity",
      "Differentiation from first principles",
    ]);
    expect(new Set(topics?.map((t) => t.concept_id)).size).toBe(3); // neighbouring ideas stay separate concepts
  });

  test("a classmate at the same university is offered the existing course, not a duplicate", async ({
    page,
    context,
    baseURL,
  }) => {
    const bola = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    users.push(bola.id);
    await signInAs(context, bola.email, baseURL!);

    await page.goto("/courses");
    await page.getByLabel("What do you want to learn?").fill(courseCode.toLowerCase().replace(" ", ""));
    await expect(page.getByRole("link", { name: new RegExp(`${courseCode} · Test calculus`) })).toBeVisible({
      timeout: 15_000,
    });

    // Trying to add it anyway leads to the existing course.
    await page.goto(`/courses/new?code=${encodeURIComponent(courseCode)}`);
    await page.getByLabel("Course title").fill("Some other title");
    await page.getByLabel("Subject").selectOption("mathematics");
    await page.getByRole("button", { name: "Add course" }).click();
    await expect(page.getByRole("heading", { name: `${courseCode} is already on Ifiok` })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Join this course" }).click();
    await expect(page).toHaveURL(courseUrl);

    // A new member's edit (enrolled today, no study sessions) waits for confirmation.
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: "Remove topic 3" }).click();
    await page.getByRole("button", { name: "Save outline" }).click();
    await expect(page.getByText(/go live once another member/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Differentiation from first principles")).toBeVisible(); // not applied yet
    await shot(page, "05-pending");
  });

  test("another member confirms the pending edit", async ({ page, context, baseURL }) => {
    const { data: ada } = await adminClient().auth.admin.getUserById(users[0]!);
    await signInAs(context, ada.user!.email!, baseURL!);
    await page.goto(courseUrl);
    await expect(page.getByText("Waiting for a member to confirm")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("Edit confirmed and applied.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Differentiation from first principles")).toHaveCount(0);
  });

  test("the same topic at another university resolves to the same shared concept", async ({
    page,
    context,
    baseURL,
  }) => {
    const chi = await createOnboardedUser({ university: "UNILAG", level: 200 });
    users.push(chi.id);
    await signInAs(context, chi.email, baseURL!);

    const otherCode = `ZTL ${100 + Math.floor(Math.random() * 800)}`;
    await page.goto(`/courses/new?code=${encodeURIComponent(otherCode)}`);
    await page.getByLabel("Course title").fill("Mathematics methods");
    await page.getByLabel("Subject").selectOption("mathematics");
    await page.getByRole("button", { name: "Add course" }).click();
    const createAnyway = page.getByRole("button", { name: /None of these/ });
    if (await createAnyway.isVisible({ timeout: 8_000 }).catch(() => false)) await createAnyway.click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(otherCode) })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: /Type topics/ }).click();
    await page.getByPlaceholder("For example, Limits and continuity").nth(0).fill("Limit of a function");
    await page.getByRole("button", { name: "Remove topic 3" }).click();
    await page.getByRole("button", { name: "Remove topic 2" }).click();
    await page.getByRole("button", { name: "Save outline" }).click();
    await expect(page.getByText("Outline saved.")).toBeVisible({ timeout: 90_000 });

    const db = adminClient();
    const first = await db
      .from("topics")
      .select("concept_id")
      .eq("course_id", courseUrl.split("/").pop()!)
      .eq("title", "Limits of a function")
      .single();
    const second = await db
      .from("topics")
      .select("concept_id, course_id")
      .eq("title", "Limit of a function")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(second.data?.concept_id).toBe(first.data?.concept_id);
  });

  test("a whole subject gets narrower suggestions, and a topic can be learnt without a course", async ({
    page,
    context,
    baseURL,
  }) => {
    const { data: chi } = await adminClient().auth.admin.getUserById(users[2]!);
    await signInAs(context, chi.user!.email!, baseURL!);
    await page.goto("/courses");

    await page.getByLabel("What do you want to learn?").fill("Physics");
    await page.getByRole("button", { name: /Learn “Physics” as a topic/ }).click();
    await expect(page.getByText(/covers a lot. Pick a narrower topic/)).toBeVisible({ timeout: 60_000 });
    await shot(page, "06-too-broad");

    await page.getByLabel("What do you want to learn?").fill("Fourier series");
    await page.getByRole("button", { name: /Learn “Fourier series” as a topic/ }).click();
    await expect(page.getByText(/You're following/)).toBeVisible({ timeout: 60_000 });
    await expect(
      page
        .getByRole("region", { name: /Topics you follow/ })
        .or(page.locator("section", { hasText: "Topics you follow" }))
        .first(),
    ).toContainText(/Fourier/i);
    await shot(page, "07-following");
  });

  test("an outline can be drafted by AI and read from a photo", async ({ page, context, baseURL }) => {
    const { data: chi } = await adminClient().auth.admin.getUserById(users[2]!);
    await signInAs(context, chi.user!.email!, baseURL!);

    // A course with no outline yet.
    const code = `ZTD ${100 + Math.floor(Math.random() * 800)}`;
    await page.goto(`/courses/new?code=${encodeURIComponent(code)}`);
    await page.getByLabel("Course title").fill("Introduction to Fluid Mechanics");
    await page.getByLabel("Subject").selectOption("mechanical-engineering");
    await page.getByRole("button", { name: "Add course" }).click();
    const createAnyway = page.getByRole("button", { name: /None of these/ });
    if (await createAnyway.isVisible({ timeout: 8_000 }).catch(() => false)) await createAnyway.click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(code) })).toBeVisible({ timeout: 30_000 });

    // AI draft: shown for checking, labelled as a draft.
    await page.getByRole("button", { name: /Draft one for me/ }).click();
    await expect(page.getByText(/Draft outline. Check it against your course/)).toBeVisible({ timeout: 60_000 });
    expect(await page.getByPlaceholder("For example, Limits and continuity").count()).toBeGreaterThanOrEqual(6);
    await shot(page, "08-draft");
    await page.getByRole("button", { name: "Cancel" }).click();

    // Photo: render a synthetic outline to an image and upload it.
    const outlinePage = await context.newPage();
    await outlinePage.setContent(
      `<div style="font:20px Georgia;padding:40px;width:700px;background:#fff">
        <h2>${code}: Introduction to Fluid Mechanics</h2>
        <p>Course outline, first semester</p>
        <ol><li>Week 1: Properties of fluids</li><li>Week 2: Fluid statics and pressure</li>
        <li>Week 3: Buoyancy and stability</li><li>Week 4: Bernoulli's equation</li></ol>
        <p>Lecturer: Dr. A. Example. Office hours: Tuesdays.</p></div>`,
    );
    const png = await outlinePage.locator("div").screenshot();
    await outlinePage.close();
    await page.locator('input[type="file"]').setInputFiles({ name: "outline.png", mimeType: "image/png", buffer: png });
    await expect(page.getByText(/Here's what Ifiok read/)).toBeVisible({ timeout: 60_000 });
    const read = await page
      .getByPlaceholder("For example, Limits and continuity")
      .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value.toLowerCase()));
    expect(read.join(" | ")).toMatch(/properties of fluids/);
    expect(read.join(" | ")).toMatch(/bernoulli/);
    expect(read.join(" | ")).not.toMatch(/office hours|lecturer/);
    await shot(page, "09-from-photo");
  });
});
