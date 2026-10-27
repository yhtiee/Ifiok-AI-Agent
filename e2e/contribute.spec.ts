import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { expectInsideContentArea } from "./helpers/layout";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-06 "Done when", live on the hosted project with real AI:
// (1) a shared upload is approved and grounds the topic's shared lesson for a second account, which
//     sees only the quote, never the source; a book-like upload is held with its reason;
// (2) a video explainer recorded in the browser (Chrome's fake camera, with a synthetic speech track)
//     is captioned, hidden until an admin approves it, and in data-saver never downloads video bytes;
//     a second account finishing it records exactly one usage point; the author's own finish records none;
// (3) My earnings shows points and Units and no naira amount.

const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/contribute-${name}.png`, fullPage: true });
};

// Made-up notes for this test (the author's "own notes").
const NOTES = `Kirchhoff's laws, my notes from the circuits class.
Kirchhoff's current law: at any junction in a circuit, the total current flowing in equals the total current flowing out, because charge is conserved. If 3 A and 2 A flow into a node, 5 A must flow out.
Kirchhoff's voltage law: around any closed loop, the sum of the potential differences is zero, because energy is conserved. Going round a loop, add the EMFs and subtract the IR drops.
To solve a circuit: label the currents in each branch, write the junction equations, then write one loop equation for each independent loop, and solve the simultaneous equations.
Common mistake: getting the sign wrong when a loop is traversed against the assumed current direction; the IR term then becomes positive.`;
// A made-up lab manual section for the Library upload.
const LAB = `Experiment 6: Verifying Kirchhoff's laws. Apparatus: two resistors, a d.c. supply, three ammeters and a voltmeter.
Procedure: connect the resistors in parallel across the supply. Read the current in each branch and in the main lead. Record the voltage across each resistor and across the supply.
Result: the main current equals the sum of the branch currents within the meters' resolution, and the supply voltage equals the voltage across each branch.
Precautions: check the meter zero errors before starting, and switch off between readings so the resistors don't heat up.`;
const BOOK = `Fundamentals of Electric Circuits, Seventh Edition. Copyright 2021 by McGraw-Hill Education. All rights reserved. ISBN 978-1-260-22640-9. No part of this publication may be reproduced.
Chapter 2: Basic laws. Kirchhoff's current law states that the algebraic sum of currents entering a node is zero.`;

// Chrome's fake camera and microphone; the microphone plays the synthetic speech fixture.
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${resolve("e2e/fixtures/explainer-speech.wav")}`,
    ],
  },
});

test.describe("contribute, teach and earn", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(420_000);

  const db = adminClient();
  const users: { id: string; email: string }[] = [];
  let ada = { id: "", email: "" };
  let bola = { id: "", email: "" };
  let admin = { id: "", email: "" };
  let courseId = "";
  let conceptId = "";

  test.beforeAll(async () => {
    ada = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    bola = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    admin = await createOnboardedUser({ university: "UNIUYO", level: 200 });
    users.push(ada, bola, admin);
    await db.from("profiles").update({ role: "admin" }).eq("id", admin.id);
    // Bola is a qualified consumer: a study session in the last 14 days (06 §4, demo values Q57).
    await db.from("daily_activity").insert({
      user_id: bola.id,
      day: new Date().toISOString().slice(0, 10),
      sessions: 1,
    });
    const { data: profile } = await db.from("profiles").select("university_id").eq("id", ada.id).single();
    const { data: course } = await db
      .from("courses")
      .insert({
        university_id: profile!.university_id!,
        code: `ZTC ${100 + Math.floor(Math.random() * 800)}`,
        title: "Contribute test circuits",
        subject: "physics",
        created_by: ada.id,
      })
      .select("id")
      .single();
    courseId = course!.id;
    await db.from("enrollments").insert([
      { user_id: ada.id, course_id: courseId },
      { user_id: bola.id, course_id: courseId },
    ]);
    const { data: c } = await db
      .from("concepts")
      .insert({
        slug: `ztest.contribute-${crypto.randomUUID()}`,
        title: "Kirchhoff's laws (contribute test)",
        subject: "physics",
        level_band: "introductory",
        status: "active",
      })
      .select("id")
      .single();
    conceptId = c!.id;
    await db
      .from("topics")
      .insert({ course_id: courseId, concept_id: conceptId, position: 1, title: "Kirchhoff's laws", week: 1 });
  });

  test.afterAll(async () => {
    if (courseId) await db.from("courses").delete().eq("id", courseId);
    if (conceptId) {
      await db.from("explainers").delete().eq("concept_id", conceptId);
      await db.from("concepts").update({ current_lesson_id: null }).eq("id", conceptId);
      await db.from("lessons").delete().eq("concept_id", conceptId);
      await db.from("concepts").delete().eq("id", conceptId);
    }
    for (const u of users) if (u.id) await deleteTestUser(u.id);
  });

  async function addNotes(page: Page, name: string, text: string) {
    await page.goto(`/materials/add?course=${courseId}`);
    await page.getByRole("radio", { name: "Lecture notes" }).check({ timeout: 30_000 });
    await page.getByRole("button", { name: "Paste text" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Text").fill(text);
    await page.getByRole("button", { name: "Add text" }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=materials$`), { timeout: 30_000 });
  }

  async function share(page: Page, name: string) {
    const row = page.getByRole("list", { name: "Your materials" }).getByRole("listitem").filter({ hasText: name });
    await expect(row.getByText("Ready", { exact: true })).toBeVisible({ timeout: 120_000 });
    await row.getByRole("button", { name: `Share ${name}` }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("button", { name: "Share", exact: true })).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Share", exact: true }).click();
    return row;
  }

  test("a shared upload is approved and grounds the topic's lesson for another student; a book is held", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    test.skip(isMobile, "live AI flow runs once, on desktop");
    await signInAs(context, ada.email, baseURL!);

    await addNotes(page, "My Kirchhoff notes", NOTES);
    const notes = await share(page, "My Kirchhoff notes");
    await expect(notes).toContainText(/Sharing: Ifiok is checking it|In the library/, { timeout: 30_000 });
    await expect(notes).toContainText("In the library", { timeout: 240_000 });
    await shot(page, "01-shared");

    await addNotes(page, "Circuits book chapter", BOOK);
    const book = await share(page, "Circuits book chapter");
    await expect(book).toContainText(/waiting for a person to check it: .*published book/, { timeout: 240_000 });

    // Approval rebuilt the topic's shared lesson from the new pool material.
    await expect
      .poll(
        async () => {
          const { data: c } = await db.from("concepts").select("current_lesson_id").eq("id", conceptId).single();
          if (!c?.current_lesson_id) return 0;
          const { data: l } = await db.from("lessons").select("sources_used").eq("id", c.current_lesson_id).single();
          return l?.sources_used ?? 0;
        },
        { timeout: 300_000, intervals: [10_000] },
      )
      .toBeGreaterThan(0);

    // Bola sees the lesson with a quote from the notes, and can't read the source itself.
    const other = await context.browser()!.newContext();
    const page2 = await other.newPage();
    await signInAs(other, bola.email, baseURL!);
    await page2.goto(`/learn/${conceptId}?course=${courseId}`);
    await expect(page2.getByRole("progressbar", { name: /Screen 1 of \d+/ })).toBeVisible({ timeout: 60_000 });
    const sources = await page2.evaluate(async (id) => {
      const res = await fetch(`/api/materials?courseId=${id}`);
      return res.ok ? ((await res.json()) as { materials: unknown[] }).materials.length : -1;
    }, courseId);
    expect(sources).toBe(0);
    await other.close();
  });

  test("a video explainer: captioned, hidden until approved, audio-only in data-saver, one usage point", async ({
    page,
    context,
    baseURL,
    isMobile,
    browser,
  }) => {
    test.skip(isMobile, "recording uses the desktop project's fake camera");
    await context.grantPermissions(["camera", "microphone"]);
    await signInAs(context, ada.email, baseURL!);

    // Record and send.
    await page.goto(`/me/explainers/new?concept=${conceptId}`);
    await page.getByLabel("Title").fill("Kirchhoff's two laws", { timeout: 30_000 });
    await page.getByRole("button", { name: "Short video" }).click();
    await page.getByRole("button", { name: "Record a video" }).click();
    await page.waitForTimeout(12_000);
    await page.getByRole("button", { name: "Stop recording" }).click();
    await expect(page.getByRole("button", { name: "Record again" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "02-recorded");
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page).toHaveURL(/\/me\/explainers$/, { timeout: 120_000 });

    const { data: mine } = await db.from("explainers").select("id").eq("author_id", ada.id).single();
    const explainerId = mine!.id;
    await expect
      .poll(async () => (await db.from("explainers").select("status").eq("id", explainerId).single()).data?.status, {
        timeout: 240_000,
        intervals: [5_000],
      })
      .toMatch(/pending_admin|held/);
    const { data: ex } = await db
      .from("explainers")
      .select("transcript, captions, duration_s, media_bytes")
      .eq("id", explainerId)
      .single();
    expect(ex!.transcript).toMatch(/Kirchhoff/i);
    expect((ex!.captions as unknown[]).length).toBeGreaterThan(0);
    expect(Number(ex!.media_bytes)).toBeLessThan(40 * 1024 * 1024);

    // Not visible to Bola before approval.
    const bolaCtx: BrowserContext = await browser.newContext();
    const bolaPage = await bolaCtx.newPage();
    await signInAs(bolaCtx, bola.email, baseURL!);
    await bolaPage.goto(`/explainers/${conceptId}`);
    await expect(bolaPage.getByText("No explainers yet")).toBeVisible({ timeout: 30_000 });

    // The admin approves it.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await signInAs(adminCtx, admin.email, baseURL!);
    await adminPage.goto("/admin");
    await expect(adminPage.getByRole("tab", { name: /To review/, selected: true })).toBeVisible({ timeout: 30_000 });
    await expect(adminPage.getByRole("heading", { name: "Kirchhoff's two laws" })).toBeVisible({ timeout: 30_000 });
    await shot(adminPage, "03-admin");
    const card = adminPage
      .locator("div")
      .filter({ has: adminPage.getByRole("heading", { name: "Kirchhoff's two laws" }) })
      .last();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(adminPage.getByText("Approved: Kirchhoff's two laws")).toBeVisible({ timeout: 20_000 });
    await adminCtx.close();

    // Bola, in data-saver: transcript and audio, never the video file.
    const videoRequests: string[] = [];
    bolaPage.on("request", (r) => {
      if (/\/video\.(webm|mp4)/.test(r.url())) videoRequests.push(r.url());
    });
    // Found in the Library, opened on its watch page.
    await bolaPage.goto("/library");
    await bolaPage
      .getByRole("list", { name: "Library" })
      .getByRole("link", { name: /Kirchhoff's two laws/ })
      .click({ timeout: 30_000 });
    await expect(bolaPage).toHaveURL(new RegExp(`/library/${explainerId}$`), { timeout: 30_000 });
    await shot(bolaPage, "04-library-watch");
    await bolaPage.getByLabel("Data saver: transcript and audio only").check({ timeout: 30_000 });
    await expect(bolaPage.getByRole("button", { name: /Load video/ })).toHaveCount(0);
    await bolaPage.getByRole("button", { name: /Load audio/ }).click();
    const audio = bolaPage.locator("audio");
    await expect(audio).toHaveAttribute("src", /audio\.(webm|m4a)/, { timeout: 20_000 });
    // Data-saver opens the transcript with the audio.
    await expect(bolaPage.locator("details", { hasText: "Transcript" }).locator("p")).toContainText(/Kirchhoff/i);
    // Play to the end (muted, so the headless browser allows it); 80% counts as finished.
    await audio.evaluate(async (el: HTMLAudioElement) => {
      el.muted = true;
      await new Promise<void>((ok) => (el.readyState >= 1 ? ok() : (el.onloadedmetadata = () => ok())));
      await el.play();
    });
    await expect(bolaPage.getByText(/Finished\. Thanks to/)).toBeVisible({ timeout: 60_000 });
    await shot(bolaPage, "05-data-saver");
    expect(videoRequests).toEqual([]);
    await bolaCtx.close();

    await expect
      .poll(
        async () =>
          (await db.from("usage_points").select("id").eq("resource_id", explainerId).eq("consumer_id", bola.id)).data
            ?.length,
        { timeout: 20_000 },
      )
      .toBe(1);

    // The author finishing their own explainer records nothing.
    const self = await page.evaluate(async (id) => {
      const res = await fetch(`/api/explainers/${id}/finish`, { method: "POST", body: "{}" });
      return ((await res.json()) as { recorded: boolean }).recorded;
    }, explainerId);
    expect(self).toBe(false);
    const { count } = await db
      .from("usage_points")
      .select("id", { count: "exact", head: true })
      .eq("resource_id", explainerId);
    expect(count).toBe(1);
  });

  test("uploading a PDF straight to the Library: only the picked pages are kept, and it opens as a document", async ({
    page,
    context,
    baseURL,
    isMobile,
    browser,
  }) => {
    test.skip(isMobile, "live AI flow runs once, on desktop");
    // A made-up 3-page lab manual PDF, built for this test.
    const { PDFDocument, StandardFonts } = await import("pdf-lib");
    const made = await PDFDocument.create();
    const font = await made.embedFont(StandardFonts.Helvetica);
    const sections = LAB.split("\n");
    for (const [i, text] of [sections[0]!, sections[1]!, `${sections[2]!} ${sections[3]!}`].entries()) {
      const p = made.addPage([595, 842]);
      const words = `Page ${i + 1}. ${text}`.split(" ");
      let line = "";
      let y = 790;
      for (const w of words) {
        if ((line + w).length > 80) {
          p.drawText(line, { x: 50, y, size: 12, font });
          y -= 18;
          line = "";
        }
        line += `${w} `;
      }
      p.drawText(line, { x: 50, y, size: 12, font });
    }
    const pdfPath = test.info().outputPath("lab-manual.pdf");
    writeFileSync(pdfPath, await made.save());

    await signInAs(context, ada.email, baseURL!);
    await page.goto("/library");
    await page.getByRole("button", { name: "Upload" }).click({ timeout: 30_000 });
    await page.getByRole("menuitem", { name: "Upload notes, a manual or past questions" }).click();
    await expect(page).toHaveURL(/\/library\/upload$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "Lab manual" }).click();
    await page.getByLabel("Title").fill("Verifying Kirchhoff's laws (lab)");
    await page.getByLabel("PDF to upload").setInputFiles(pdfPath);
    await expect(page.getByRole("button", { name: "Page 1", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Pages", { exact: true }).fill("1-2");
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("button", { name: "Share 2 pages" }).click();
    await expect(page.getByText("Tick the box to confirm it's yours to share.")).toBeVisible();
    await page.getByRole("checkbox", { name: /my own work/ }).check();
    await shot(page, "06-library-upload");
    await page.getByRole("button", { name: "Share 2 pages" }).click();
    await expect(page).toHaveURL(/\/me\/earnings$/, { timeout: 60_000 });

    // Shared, never linked to a course, no lab built from it, and the stored PDF has only the 2 picked pages.
    const { data: src } = await db
      .from("sources")
      .select("id, course_id, concept_id, shared_at, storage_path, thumb_path")
      .eq("owner_id", ada.id)
      .eq("title", "Verifying Kirchhoff's laws (lab)")
      .single();
    expect(src).toMatchObject({ course_id: null, concept_id: conceptId });
    expect(src!.shared_at).not.toBeNull();
    expect(src!.thumb_path).toMatch(/thumb\.jpg$/);
    const { data: stored } = await db.storage.from("library").download(src!.storage_path!);
    expect((await PDFDocument.load(await stored!.arrayBuffer())).getPageCount()).toBe(2);
    const { count: labJobs } = await db
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("dedupe_key", `lab:${src!.id}`);
    expect(labJobs).toBe(0);
    await expect
      .poll(async () => (await db.from("sources").select("review").eq("id", src!.id).single()).data?.review, {
        timeout: 240_000,
        intervals: [5_000],
      })
      .toBe("approved");

    // Another student finds it in the Library grid and reads it in the viewer: 2 pages, no lesson.
    const bolaCtx = await browser.newContext();
    const bolaPage = await bolaCtx.newPage();
    await signInAs(bolaCtx, bola.email, baseURL!);
    await bolaPage.goto("/library?type=lab_manual");
    await bolaPage
      .getByRole("list", { name: "Library" })
      .getByRole("link", { name: /Verifying Kirchhoff's laws \(lab\)/ })
      .click({ timeout: 30_000 });
    await expect(bolaPage).toHaveURL(new RegExp(`/library/doc/${src!.id}`), { timeout: 30_000 });
    await expect(bolaPage.getByLabel("Page 2 of 2")).toBeVisible({ timeout: 30_000 });
    await expect(bolaPage.locator('a[href^="/learn/"]')).toHaveCount(0);
    await expectInsideContentArea(bolaPage, "library document");
    await shot(bolaPage, "07-library-doc");
    await bolaCtx.close();
  });

  test("tutor profile, My earnings without naira, and the pages fit the screen", async ({ page, context, baseURL }) => {
    await signInAs(context, ada.email, baseURL!);
    await page.goto("/me/tutor");
    await page.getByRole("checkbox", { name: "Kirchhoff's laws" }).check({ timeout: 30_000 });
    await page.getByLabel("When you're free").fill("Weekday evenings after 6 pm");
    await page.getByRole("button", { name: "Save tutor profile" }).click();
    await expect(page.getByText(/Saved\. Learners see you/)).toBeVisible({ timeout: 20_000 });
    await expectInsideContentArea(page, "tutor profile");

    await page.goto(`/explainers/${conceptId}`);
    await expect(page.getByRole("region", { name: "Students who tutor this" })).toContainText("Weekday evenings", {
      timeout: 30_000,
    });
    await expectInsideContentArea(page, "topic explainers");

    await page.goto("/me/earnings");
    await expect(page.getByRole("heading", { level: 1, name: "My earnings" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Cash payouts from the contribution pool open after launch.")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/₦|NGN|naira/i);
    await expectInsideContentArea(page, "my earnings");
    await shot(page, "05-earnings");
  });
});
