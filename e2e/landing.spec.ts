import { expect, test, type Page } from "@playwright/test";

// Landing page (07 §5.11, P1-13 checks): live hero, copy rules, layout, share metadata.

const readout = (page: Page) => page.locator("dl[aria-live] dd").allTextContents();

test.describe("landing hero mini-lesson", () => {
  test("drags along the curve and keeps every number computed", async ({ page, context, isMobile }) => {
    await page.goto("/");
    expect(await readout(page)).toEqual(["1.00", "1.00", "2.00"]);

    const svg = page.locator("figure svg");
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    const px = (x: number) => box.x + ((x + 3) / 6) * box.width;
    const y = box.y + box.height * 0.6;
    const path = [1, 1.1, 1.2, 1.3, 1.4, 1.5];

    if (isMobile) {
      // Phones drag with a finger: send real touch events.
      const cdp = await context.newCDPSession(page);
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number) =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints: x === undefined ? [] : [{ x: px(x), y }] });
      await touch("touchStart", path[0]);
      for (const x of path.slice(1)) await touch("touchMove", x);
      await touch("touchEnd");
    } else {
      await page.mouse.move(px(path[0]!), y);
      await page.mouse.down();
      for (const x of path.slice(1)) await page.mouse.move(px(x), y);
      await page.mouse.up();
    }

    const [x, fx, slope] = (await readout(page)).map((v) => Number(v.replace("−", "-")));
    // One 0.05 step of slack: touch coordinates are rounded to whole pixels.
    expect(Math.abs(x! - 1.5)).toBeLessThanOrEqual(0.0501);
    expect(fx).toBeCloseTo(x! * x!, 1);
    expect(slope).toBeCloseTo(2 * x!, 5);
  });

  test("checkpoint gives a hint, then confirms the right answer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowRight");
    const answer = page.getByLabel(/what is the slope of y = x² at x = 1.5/i);
    await answer.fill("2");
    const verdict = page.locator("form p[aria-live]");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(verdict).toHaveText(/^Not quite\./);
    await answer.fill("3");
    await page.getByRole("button", { name: "Check" }).click();
    await expect(verdict).toHaveText("Correct. The slope is 2x, and 2 × 1.5 = 3.");
  });
});

test("has one visible primary action and no horizontal scroll, before and after the checkpoint opens", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("a", { hasText: "Start learning free" }).filter({ visible: true })).toHaveCount(1);
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const heroWidth = () => page.locator("figure svg").evaluate((el) => el.getBoundingClientRect().width);

  expect(await overflow()).toBeLessThanOrEqual(0);
  const before = await heroWidth();

  // Touching the plot reveals the checkpoint form; it must not widen the card.
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: "Check" })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  expect(await heroWidth()).toBeCloseTo(before, 0);
});

test("copy follows the voice rules", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("body").innerText();
  for (const banned of [
    /predicted/i,
    /likely to appear/i,
    /guaranteed/i,
    /\bcoins?\b/i,
    /\bgems?\b/i,
    /\btokens?\b/i,
    /magic/i,
  ]) {
    expect(text).not.toMatch(banned);
  }
  expect(text.replace(/[©®™]/g, "")).not.toMatch(/\p{Extended_Pictographic}/u);
});

test("ships share metadata and icons", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/opengraph-image/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  for (const path of ["/favicon.ico", "/icon.svg", "/apple-icon.png", "/opengraph-image"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the hero still renders a static figure", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("figure svg path")).toHaveCount(1);
    expect(await readout(page)).toEqual(["1.00", "1.00", "2.00"]);
  });
});
