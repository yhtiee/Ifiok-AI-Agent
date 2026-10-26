import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-02 on screen, seeded straight into the hosted project (no AI calls): the Path lists topics in
// order with lesson state and mastery in words and the right "Next up"; a private lesson shows
// "From your notes, p. N" and its label. Generation itself is covered by
// lib/lessons/private-lessons.integration.test.ts.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/path-${name}.png`, fullPage: true });
};

test.describe("course Path and lessons from your notes", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

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
    const { data: course } = await db
      .from("courses")
      .insert({
        university_id: profile!.university_id!,
        code: `ZTQ ${100 + Math.floor(Math.random() * 800)}`,
        title: "Path test mechanics",
        created_by: userId,
      })
      .select("id")
      .single();
    courseId = course!.id;
    await db.from("enrollments").insert({ user_id: userId, course_id: courseId });

    const titles = ["Slope of a curve", "Limits", "Continuity"];
    for (const [i, title] of titles.entries()) {
      const { data: c } = await db
        .from("concepts")
        .insert({
          slug: `ztest.path-${Date.now()}-${i}`,
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
    // Topic 1 is already Proficient; topic 2 is Next up.
    await db
      .from("mastery")
      .insert({ user_id: userId, concept_id: concepts[0]!, m: 0.7, level: "proficient", attempts_count: 6 });

    // A private lesson for topic 2, quoting the student's own notes (page 2).
    const { data: source } = await db
      .from("sources")
      .insert({ owner_id: userId, course_id: courseId, kind: "notes", title: "My notes", page_count: 2 })
      .select("id")
      .single();
    const { data: chunk } = await db
      .from("chunks")
      .insert({
        source_id: source!.id,
        owner_id: userId,
        course_id: courseId,
        visibility: "private",
        page: 2,
        content: "The slope of a curve at a point is the slope of its tangent line at that point.",
      })
      .select("id")
      .single();
    const spec = JSON.parse(readFileSync("content/fixtures/slope-of-a-curve.json", "utf8"));
    const first = spec.screens[0];
    first.blocks.push({
      id: `s1b${first.blocks.length + 1}`,
      type: "source_quote",
      chunk_id: Number(chunk!.id),
      quote: "The slope of a curve at a point is the slope of its tangent line",
    });
    await db.rpc("publish_private_lesson", {
      p_owner: userId,
      p_concept: concepts[1]!,
      p_course: courseId,
      p_spec: spec,
      p_status: "published",
      p_source_refs: [Number(chunk!.id)],
      p_sources_used: 1,
      p_model: "fixture",
    });
    // Two practice questions for topic 2: a multiple choice (answer "b") and a number (answer 4).
    await db.from("items").insert([
      {
        concept_id: concepts[1]!,
        owner_id: userId,
        course_id: courseId,
        type: "mcq" as const,
        stem: {
          prompt: "Practice question one: what is the limit of 2x as x tends to 3?",
          options: [
            { id: "a", text: "5" },
            { id: "b", text: "6" },
          ],
        },
        answer: { correct_option_id: "b", feedback: { a: "Substitute x = 3: 2 × 3 = 6.", b: "Yes: 2 × 3 = 6." } },
        verification: { type: "mcq" },
        origin: "generated",
        status: "published" as const,
      },
      {
        concept_id: concepts[1]!,
        owner_id: userId,
        course_id: courseId,
        type: "numeric" as const,
        stem: { prompt: "Practice question two: what is the limit of x squared as x tends to 2?" },
        answer: { expected: 4, answer_expr: "2^2", why: "Substitute x = 2: 2² = 4." },
        verification: { type: "numeric", answer_expr: "2^2", stated: 4, tolerance: null },
        origin: "generated",
        status: "published" as const,
      },
    ]);
  });

  test.afterAll(async () => {
    await db.from("items").delete().in("concept_id", concepts);
    await db.from("lessons").delete().in("concept_id", concepts);
    if (courseId) await db.from("courses").delete().eq("id", courseId);
    await db.from("concepts").delete().in("id", concepts);
    if (userId) await deleteTestUser(userId);
  });

  test("the Path shows each topic's state in words and the right Next up", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/courses/${courseId}`);
    const path = page.getByRole("list", { name: "Topics in order" });
    await expect(path.getByRole("listitem")).toHaveCount(3);
    await expect(path.getByRole("listitem").nth(0)).toContainText("Proficient");
    await expect(path.getByRole("listitem").nth(1)).toContainText("Lesson from your notes");
    // MVP-03: a topic with practice questions links to practising it.
    await expect(page.getByRole("link", { name: /Practise · 2 questions/ })).toBeVisible();
    await expect(path.getByRole("listitem").nth(2)).toContainText("Built on first open");
    await expect(page.getByText("Next up")).toBeVisible();
    await expect(page.getByRole("link", { name: /Start Limits/ })).toBeVisible();
    await shot(page, "01-path");
  });

  test("a lesson from your notes cites the page it came from", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/courses/${courseId}`);
    await page.getByRole("link", { name: /Start Limits/ }).click();
    await expect(page.getByText("Built from your notes. Checked by Ifiok's maths engine")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("From your notes, p. 2")).toBeVisible();
    await shot(page, "02-lesson");
  });

  test("the player moves screen by screen and ends on the takeaways and the next topic", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/learn/${concepts[1]}?course=${courseId}`);
    // A focused screen: no tab bar, progress in words, Previous disabled on screen 1.
    await expect(page.getByRole("progressbar", { name: "Screen 1 of 6" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("1 of 6 · ~8 min")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true })).toHaveCount(
      test.info().project.name === "mobile" ? 0 : 1,
    );
    await expect(page.getByRole("button", { name: "Previous screen" })).toBeDisabled();
    // The flag dialog loads on demand and closes without sending.
    await page.getByRole("button", { name: /^Flag/ }).first().click();
    await expect(page.getByRole("dialog", { name: "Flag this block" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The takeaways wait for the end.
    await expect(page.getByText("Key takeaways")).toHaveCount(0);
    for (let i = 1; i < 6; i++) await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("progressbar", { name: "Screen 6 of 6" })).toBeVisible();
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(page.getByRole("heading", { name: "The slope of a curve: done" })).toBeVisible();
    await expect(page.getByText("Key takeaways")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next topic: Continuity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Go through it again" })).toBeVisible();
    await shot(page, "03-finished");
  });

  // MVP-03 "Done when": weak areas update after a practice session; the server marks every answer.
  test("a practice session is marked on the server and shows up in weak areas", async ({ page, context, baseURL }) => {
    await signInAs(context, email, baseURL!);
    await page.goto(`/courses/${courseId}`);
    await page.getByRole("link", { name: /Practise · 2 questions/ }).click();
    await expect(page.getByRole("progressbar", { name: "Question 1 of 2" })).toBeVisible();
    await shot(page, "04-practice");

    // Question order puts untried ones first; answer whichever comes: one right, one wrong.
    for (let i = 0; i < 2; i++) {
      const isMcq = await page.getByRole("radiogroup", { name: "Your answer" }).isVisible();
      if (isMcq)
        await page.getByRole("radio", { name: "6" }).click(); // right
      else await page.getByLabel(/Your answer/).fill("5"); // wrong (it's 4)
      await page.getByRole("button", { name: "Check", exact: true }).click();
      await expect(page.getByRole("status")).toContainText(isMcq ? "Correct." : "Not quite. The answer is 4.");
      await shot(page, `05-feedback-${isMcq ? "right" : "wrong"}`);
      await page.getByRole("button", { name: /Next question|See how you did/ }).click();
    }
    await expect(page.getByRole("heading", { name: "1 of 2 right" })).toBeVisible();

    // Weak areas: the topic with its evidence and one next step, on Practice and on Today.
    await page.goto("/practice");
    const weak = page.getByRole("list", { name: "Weak areas" });
    await expect(weak).toContainText("Limits");
    await expect(weak).toContainText("1 of 2 right this week");
    await shot(page, "06-weak-areas");
    await page.goto("/today");
    await expect(page.getByRole("list", { name: "Weak areas" })).toContainText("Limits");

    // Evidence is server-written: exactly the two attempts, one right.
    const { data: attempts } = await db.from("attempts").select("correct").eq("user_id", userId);
    expect((attempts ?? []).map((a) => a.correct).sort()).toEqual([false, true]);
  });
});
