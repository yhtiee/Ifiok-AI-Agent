import { expect, test, type Page } from "@playwright/test";
import { adminClient, createOnboardedUser, deleteTestUser, hasSupabaseAdmin, signInAs } from "./helpers/supabase";

// MVP-01 materials, uploaded as files (12 §4 Q60). (1) On the device: the whole PDF goes to its
// signed URL, the text layer is read on the phone and the scanned page is drawn for OCR. (2) Live:
// an upload is stored, becomes Ready and searchable on the hosted project, opens in the viewer,
// and deleting it removes the file. Fixture: node scripts/make-fixture-pdf.mts (5 pages, page 5
// has no text layer).

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
  async function openAddFile(page: Page) {
    await page.goto(`/materials/add?course=${courseId}`);
    await page.getByRole("radio", { name: "Lecture notes" }).check();
    await page.getByLabel("File to add").setInputFiles(FIXTURE);
    // Read on the phone first: the text pages and the scanned page are counted.
    await expect(page.getByText(/4 pages of text read on your phone\. 1 scanned page will be read/)).toBeVisible({
      timeout: 30_000,
    });
  }

  test("the whole file uploads; its text is read on the phone and the scan is sent for OCR (Q60)", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    // Keep this test about the device: answer the materials API and storage locally.
    const id = "00000000-0000-4000-8000-000000000001";
    let posted: { pages: { page: number; text: string }[]; file: { mime: string }; ocr_pages: unknown[] } | null = null;
    const stored = new Map<string, Buffer>();
    let completed = false;
    await page.route("**/api/materials?**", (route) => route.fulfill({ json: { materials: [] } }));
    await page.route("**/api/materials", async (route) => {
      posted = route.request().postDataJSON();
      const sign = (name: string) => ({ path: `u/${id}/${name}`, token: name });
      await route.fulfill({
        status: 201,
        json: {
          material: { id, title: "x", pageCount: 5, chunks: 4 },
          jobId: "j",
          uploads: { file: sign("file.pdf"), thumb: sign("thumb.jpg"), ocr: [{ page: 5, ...sign("ocr-5.jpg") }] },
          redacted: 0,
          skippedPages: 0,
        },
      });
    });
    await page.route("**/storage/v1/object/upload/sign/materials/**", async (route) => {
      const url = new URL(route.request().url());
      stored.set(url.pathname.split("/").pop()!, route.request().postDataBuffer() ?? Buffer.alloc(0));
      await route.fulfill({ json: { Key: url.pathname } });
    });
    await page.route(`**/api/materials/${id}/complete`, async (route) => {
      completed = true;
      await route.fulfill({ json: { attached: true, reading: 1 } });
    });

    await openAddFile(page);
    await shot(page, "01-picked");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText(/^Added "x"/)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/courses/${courseId}\\?tab=materials$`));

    // Text of every page with a text layer, the scan for OCR, and the file's type.
    const body = posted!;
    expect(body.pages.map((p) => p.page)).toEqual([1, 2, 3, 4]);
    for (const n of [1, 2, 3, 4]) expect(JSON.stringify(body.pages)).toContain(marker(n));
    expect(body.ocr_pages).toEqual([{ page: 5 }]);
    expect(body.file.mime).toBe("application/pdf");
    // The PDF itself, a JPEG thumbnail and a JPEG of the scanned page went to storage; then complete.
    // (Playwright doesn't capture a file streamed from disk, so the part's type is checked here;
    // the live test checks the stored bytes through the server's magic-byte check.)
    expect(stored.get("file.pdf")?.toString("latin1")).toContain("Content-Type: application/pdf");
    expect(stored.get("ocr-5.jpg")?.includes(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    expect(stored.has("thumb.jpg")).toBe(true);
    expect(completed).toBe(true);
  });

  test("an upload becomes Ready and searchable, and can be deleted (live)", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    await openAddFile(page);
    await page.getByLabel("Name").fill("Projectile notes");
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    await expect(page.getByText('Added "Projectile notes".')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("tab", { name: /Materials/, selected: true })).toBeVisible();

    // Keyword search works at once (chunks are saved before embedding).
    await page.getByLabel("Find in your materials").fill(marker(3));
    await expect(page.getByRole("list", { name: "Matches" })).toContainText("p. 3", { timeout: 20_000 });

    // The embed and ocr jobs finish; the list polls until it reads Ready (Done when: within 2 minutes).
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({ timeout: 120_000 });
    // The file is stored privately, checked from its bytes (Q60).
    const { data: stored } = await adminClient()
      .from("sources")
      .select("id, storage_path, file_mime, thumb_path")
      .eq("course_id", courseId);
    expect(stored?.length).toBe(1);
    const source = stored![0]!;
    expect(source.storage_path).toMatch(/\/file\.pdf$/);
    expect(source.file_mime).toBe("application/pdf");
    expect(source.thumb_path).toMatch(/\/thumb\.jpg$/);

    // It opens in Ifiok's viewer for its owner.
    await page.getByRole("link", { name: /Projectile notes/ }).click();
    await expect(page.getByRole("list", { name: /Projectile notes, 5 pages/ })).toBeVisible({ timeout: 30_000 });
    await shot(page, "02-viewer");
    await page.goBack();

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
    // Its files went with it.
    const folder = source.storage_path!.split("/").slice(0, 2).join("/");
    const { data: left } = await adminClient().storage.from("materials").list(folder);
    expect(left ?? []).toHaveLength(0);
  });

  test("Add materials with one course goes straight to What is it?", async ({ page, context, baseURL }) => {
    await signInAs(context, emails.get("ada")!, baseURL!);
    await page.goto("/materials/add");
    // The student's only course is preselected; outlines are added on the outline page, not here.
    await expect(page.getByText(/Adding to ZTM \d+/)).toBeVisible();
    await expect(page.getByRole("group", { name: "What is it?" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(5);
    await expect(page.getByRole("radio", { name: "Course outline" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose a file" })).toBeVisible();
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
