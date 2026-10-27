import { expect, test, type Page, type Request } from "@playwright/test";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-01 materials. (1) The F3 network test (11 §2 item 4): a fixture PDF with a unique marker on
// every page; after picking pages 2–3, no request carries another page's text and no PDF bytes are
// sent. (2) Live: an upload becomes Ready and searchable on the hosted project, then is deleted.
// Fixture: node scripts/make-fixture-pdf.mts (5 pages, page 5 has no text layer).

const FIXTURE = "e2e/fixtures/marked-pages.pdf";
const marker = (n: number) => `ZQXPAGE${n}MARK`;
const SHOTS = process.env.E2E_SCREENSHOTS ? "test-results/screens" : null;
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/materials-${name}.png`, fullPage: true });
};

test.describe("materials: upload and understand", () => {
  test.skip(!hasSupabaseAdmin, "needs SUPABASE_SERVICE_ROLE_KEY for the hosted project");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  const users: string[] = [];
  const emails = new Map<string, string>();
  let courseId = "";

  test.beforeAll(async () => {
    const ada = await createOnboardedUser({ university: "UNIUYO", level: 100 });
    users.push(ada.id);
    const db = adminClient();
    const { data: profile } = await db.from("profiles").select("university_id").eq("id", ada.id).single();
    const { data: course, error } = await db
      .from("courses")
      .insert({
        university_id: profile!.university_id!,
        code: `ZTM ${100 + Math.floor(Math.random() * 800)}`,
        title: "Test mechanics for materials",
        created_by: ada.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    courseId = course.id;
    await db.from("enrollments").insert({ user_id: ada.id, course_id: courseId });
    emails.set("ada", ada.email);
  });

  test.afterAll(async () => {
    const db = adminClient();
    if (courseId) await db.from("courses").delete().eq("id", courseId);
    for (const id of users) await deleteTestUser(id);
  });

  // The one add flow (app-overhaul §5.7): ?course= preselects the course and opens "What is it?".
  async function openAddPdf(page: Page) {
    await page.goto(`/materials/add?course=${courseId}`);
    await page.getByRole("radio", { name: "Lecture notes" }).check();
    await page.getByLabel("PDF to add").setInputFiles(FIXTURE);
    await expect(page.getByRole("button", { name: "Page 1", exact: true })).toBeVisible({ timeout: 30_000 });
  }

  test("only the picked pages' text leaves the device, never the PDF (F3)", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    // Keep this test about the device: answer the materials API locally.
    let posted: unknown = null;
    await page.route("**/api/materials?**", (route) => route.fulfill({ json: { materials: [] } }));
    await page.route("**/api/materials", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: {
          material: { id: "00000000-0000-4000-8000-000000000001", title: "x", pageCount: 2, chunks: 2 },
          jobId: "j",
          redacted: 0,
          skippedPages: 0,
        },
      });
    });

    const requests: Request[] = [];
    page.on("request", (r) => requests.push(r));

    await openAddPdf(page);
    // The scanned page is marked and can't be picked.
    await page.getByRole("button", { name: "Page 5", exact: false }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Page 5, no readable text" })).toBeDisabled({ timeout: 15_000 });

    await page.getByLabel("Pages", { exact: true }).fill("2-3");
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await expect(page.getByText(/2 of \d+ pages picked/)).toBeVisible();
    await shot(page, "01-picker");
    await page.getByRole("button", { name: "Add 2 pages" }).click();
    // Back on the course's Materials tab, with the notice as a toast.
    await expect(page.getByText(/^Added "x": 2 pages/)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=materials$`));
    await shot(page, "02-added");

    const body = JSON.stringify(posted);
    expect(body).toContain(marker(2));
    expect(body).toContain(marker(3));
    for (const n of [1, 4]) expect(body).not.toContain(marker(n));

    for (const r of requests) {
      const data = r.postDataBuffer();
      if (!data) continue;
      const text = data.toString("latin1");
      expect(text.startsWith("%PDF"), `${r.url()} sent a PDF`).toBe(false);
      expect(text, `${r.url()} sent the PDF's raw bytes`).not.toContain("%PDF-");
      for (const n of [1, 4]) expect(text, `${r.url()} sent unpicked page ${n}`).not.toContain(marker(n));
    }
  });

  test("an upload becomes Ready and searchable, and can be deleted (live)", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    await openAddPdf(page);
    await page.getByLabel("Name").fill("Projectile notes");
    await page.getByLabel("Pages", { exact: true }).fill("1-4");
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("button", { name: "Add 4 pages" }).click();
    await expect(page.getByText('Added "Projectile notes": 4 pages')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("tab", { name: /Materials/, selected: true })).toBeVisible();

    // Keyword search works at once (chunks are saved before embedding).
    await page.getByLabel("Find in your materials").fill(marker(3));
    await expect(page.getByRole("list", { name: "Matches" })).toContainText("p. 3", { timeout: 20_000 });

    // The embed job fills the vectors; the list polls until it reads Ready (Done when: within 2 minutes).
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 120_000 });
    // No file is stored for an upload (F3): text-only sources.
    const { data: stored } = await adminClient().from("sources").select("storage_path").eq("course_id", courseId);
    expect(stored?.length).toBe(1);
    expect(stored![0]!.storage_path).toBeNull();

    await page.getByRole("button", { name: "Delete Projectile notes" }).click();
    // Asked first, in a dialog.
    await expect(page.getByRole("alertdialog", { name: "Delete “Projectile notes”?" })).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No materials yet")).toBeVisible({ timeout: 20_000 });
    const { count } = await adminClient()
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);
    expect(count).toBe(0);
  });

  test("Add materials with one course goes straight to What is it?", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    await page.goto("/materials/add");
    // The student's only course is preselected; outlines are added on the outline page, not here.
    await expect(page.getByText(/Adding to ZTM \d+/)).toBeVisible();
    await expect(page.getByRole("group", { name: "What is it?" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);
    await expect(page.getByRole("radio", { name: "Course outline" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose a PDF" })).toBeVisible();
    await shot(page, "03-add-page");

    // Pasted text needs a sentence or two before it can be added.
    await page.getByRole("button", { name: "Paste text" }).click();
    const add = page.getByRole("button", { name: "Add text" });
    await expect(add).toBeDisabled();
    await page.getByLabel("Text").fill("Projectile motion: the range depends on the launch angle and speed.");
    await expect(add).toBeEnabled();
    await shot(page, "04-paste");
  });
});
