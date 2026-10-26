import { expect, test, type Page } from "@playwright/test";
import { expectInsideContentArea } from "./helpers/layout";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-04 "Done when", live on the hosted project with real AI: pasted past questions are read by the
// worker (exam_extract), the student reviews and saves them, Exam prep shows what the papers ask,
// an exam date gives a study plan, and a timed practice paper records a self-marked past question
// through /api/sync. No exam screen says "predicted" or "likely to appear" (guardrail 13).

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/exam-${name}.png`, fullPage: true });
};
const noPredictions = async (page: Page) =>
  expect(await page.locator("main").innerText()).not.toMatch(/predict|likely to (appear|come)/i);

// A synthetic paper written for this test (not a real university's paper).
const PAPER = `ZTX 101 Calculus Examination, 2024. Answer all questions. Time: 2 hours.
1. (a) Evaluate the limit of (x^2 - 4)/(x - 2) as x tends to 2. [5 marks]
(b) State the definition of continuity of a function f at a point a. [5 marks]
2. Differentiate f(x) = 3x^2 + 5x - 7 with respect to x. [10 marks]
3. Find the derivative of sin(x) * x^2 using the product rule. [10 marks]
4. Explain what it means for a limit to exist at a point, with an example. [10 marks]`;
const PAPER_2023 = `ZTX 101 Calculus Examination, 2023. Answer any three questions.
1. Find the limit of (3x + 1) as x tends to 4. [10 marks]
2. Using first principles, differentiate f(x) = x^2. [15 marks]
3. Show that f(x) = |x| is continuous at x = 0. [10 marks]
4. Differentiate y = e^(2x) cos(x). [15 marks]`;

test.describe("exam prep: past questions, patterns, plan and a practice paper", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  const db = adminClient();
  let userId = "";
  let email = "";
  let courseId = "";
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
        code: `ZTX ${100 + Math.floor(Math.random() * 800)}`,
        title: "Exam prep test calculus",
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    courseId = course.id;
    await db.from("enrollments").insert({ user_id: userId, course_id: courseId });
    for (const [i, title] of ["Limits", "Continuity", "Differentiation"].entries()) {
      const { data: c } = await db
        .from("concepts")
        .insert({
          slug: `ztest.exam-${crypto.randomUUID()}-${i}`,
          title,
          subject: "mathematics",
          level_band: "introductory",
          status: "active",
        })
        .select("id")
        .single();
      concepts.push(c!.id);
      await db.from("topics").insert({ course_id: courseId, concept_id: c!.id, position: i + 1, title, week: i + 1 });
    }
  });

  test.afterAll(async () => {
    if (courseId) {
      await db.from("exam_plans").delete().eq("course_id", courseId);
      await db.from("courses").delete().eq("id", courseId);
    }
    if (concepts.length) await db.from("concepts").delete().in("id", concepts);
    if (userId) await deleteTestUser(userId);
  });

  test("past questions → review → patterns → plan → timed paper", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);

    // 1–2. Two papers, added by pasting: the worker reads each, the tab refreshes itself until the
    // review is ready, and the student checks the list before it's saved.
    async function addPaper(name: string, text: string, year: string, tagUnassigned: boolean) {
      await page.goto(`/materials/add?course=${courseId}`);
      await page.getByRole("radio", { name: "Past questions" }).check();
      await page.getByRole("button", { name: "Paste text" }).click();
      await page.getByLabel("Name").fill(name);
      await page.getByLabel("Text").fill(text);
      await page.getByRole("button", { name: "Add text" }).click();
      await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=exam$`), { timeout: 30_000 });
      await expect(page.getByRole("tab", { name: /Exam prep/, selected: true })).toBeVisible();
      await shot(page, "01-reading");

      const review = page.getByRole("link", { name: new RegExp(name) });
      await expect(review.or(page.getByText(/couldn't read questions/))).toBeVisible({ timeout: 180_000 });
      await expect(review).toBeVisible();
      await review.click();
      await expect(page).toHaveURL(/\/exam\/review\//, { timeout: 30_000 });
      await expect(page.getByText(/These questions will help your classmates in ZTX/)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("textbox", { name: /Question 1 text/ })).toBeVisible();
      await page.getByLabel("Year of the paper").fill(year);
      // Every question has a topic or is left unassigned on purpose.
      if (tagUnassigned) {
        const topicSelects = page.getByRole("combobox", { name: /topic$/ });
        for (let i = 0; i < (await topicSelects.count()); i++) {
          const select = topicSelects.nth(i);
          if (!(await select.inputValue())) await select.selectOption({ label: "Limits" });
        }
      }
      await noPredictions(page);
      await shot(page, "02-review");
      await page.getByRole("button", { name: /^Save \d+ questions?$/ }).click();
      await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=exam$`), { timeout: 30_000 });
    }
    await addPaper("ZTX 2024 paper", PAPER, "2024", true);
    await expect(page.getByText(/From 1 paper \(\d+ questions\)/)).toBeVisible();
    await addPaper("ZTX 2023 paper", PAPER_2023, "2023", false);

    // 3. Exam prep shows what the papers ask, in counts and shares.
    await expect(page.getByText(/From 2 papers \(\d+ questions\)/)).toBeVisible();
    await expect(page.getByRole("list", { name: "What the papers ask" })).toContainText(/of 2 papers · ~\d+% of marks/);
    await noPredictions(page);
    // Every saved question has a topic or is unassigned; only topic-tagged ones get a practice item.
    const { data: saved } = await db.from("exam_questions").select("concept_id, item_id").eq("course_id", courseId);
    expect(saved!.length).toBeGreaterThanOrEqual(8);
    for (const q of saved!) expect(Boolean(q.item_id)).toBe(Boolean(q.concept_id));

    // 4. An exam date gives a study plan.
    const exam = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("When is the exam?").fill(exam);
    await page.getByRole("button", { name: "Plan my study" }).click();
    await expect(page.getByText(/Exam on/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/days to go/)).toBeVisible();
    await noPredictions(page);
    await shot(page, "03-exam-tab");
    const { data: plan } = await db.from("exam_plans").select("exam_date").eq("user_id", userId).single();
    expect(plan?.exam_date).toBe(exam);

    await page.getByRole("link", { name: "The whole plan, day by day" }).click();
    await expect(page).toHaveURL(/\/exam\/plan$/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /Practice paper/ }).first()).toBeVisible({ timeout: 30_000 });
    await noPredictions(page);
    await expectInsideContentArea(page, "study plan");
    await shot(page, "04-plan");

    // Today shows today's sessions from the plan.
    await page.goto("/today");
    const todayPlan = page.getByRole("list", { name: "Study plan today" });
    await expect(todayPlan).toBeVisible({ timeout: 30_000 });
    await expect(todayPlan).toContainText(/ZTX \d+ · exam in 10 days/);

    // 5. All past questions, grouped by topic.
    await page.goto(`/courses/${courseId}/exam/questions`);
    await expect(page.getByRole("heading", { name: "Limits" })).toBeVisible({ timeout: 30_000 });
    await expectInsideContentArea(page, "past questions");
    await noPredictions(page);

    // 6. A timed paper: one worked solution and a self-mark, the rest skipped.
    await page.goto(`/courses/${courseId}/exam/paper`);
    await page.getByRole("button", { name: "Start the paper" }).click({ timeout: 30_000 });
    await expect(page.getByRole("timer")).toBeVisible();
    await page.getByRole("button", { name: "Show worked solution" }).click();
    await expect(page.getByText("Worked solution · AI · can be wrong")).toBeVisible({ timeout: 90_000 });
    await expectInsideContentArea(page, "practice paper with a worked solution");
    await shot(page, "05-paper-solution");
    await page.getByRole("button", { name: "Partly" }).click();
    while (!(await page.getByRole("heading", { name: "Paper done" }).isVisible())) {
      await page.getByRole("button", { name: "Skip this question" }).click();
    }
    await expect(page.getByText("Marked by you: 0 got it, 1 partly, 0 missed")).toBeVisible();
    await shot(page, "06-paper-done");

    // The self-mark is server-written evidence: correct at half weight on a past-paper item.
    const { data: attempts } = await db.from("attempts").select("correct, items!inner(origin)").eq("user_id", userId);
    expect(attempts).toHaveLength(1);
    expect(attempts![0]!.correct).toBe(true);
    expect(attempts![0]!.items.origin).toBe("past_paper");
  });
});
