import { expect, test, type Page } from "@playwright/test";

// Landing page (specifications/landing/04 and 05, 12 §4 Q47): hero demo, illustration interactions,
// one primary action at a time, layout, voice rules, SEO, CTAs and the no-JavaScript render.

const readout = async (page: Page) => {
  const text = await page.getByTestId("hero-readout").innerText();
  const [x, m] = [...text.matchAll(/(−?\d+\.\d+)/g)].map((r) => Number(r[1]!.replace("−", "-")));
  return { x: x!, m: m! };
};

test.describe("hero mini-lesson", () => {
  test("drags along the curve and keeps every number computed", async ({ page, context, isMobile }) => {
    await page.goto("/");
    expect(await readout(page)).toEqual({ x: 1, m: 2 });

    const svg = page.locator("svg.lp-plot");
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    const px = (x: number) => box.x + ((x + 3) / 6) * box.width;
    const y = box.y + box.height * 0.6;
    const path = [1, 1.1, 1.2, 1.3, 1.4, 1.5];

    if (isMobile) {
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

    const { x, m } = await readout(page);
    expect(Math.abs(x - 1.5)).toBeLessThanOrEqual(0.0501);
    expect(m).toBeCloseTo(2 * x, 5);
  });

  test("the slider moves the point by 0.05 per arrow key", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("slider", { name: "Point x" }).focus();
    await page.keyboard.press("ArrowRight");
    expect(await readout(page)).toEqual({ x: 1.05, m: 2.1 });
  });
});

test.describe("each illustration answers a tap", () => {
  test("Learn: Page changes screens", async ({ page }) => {
    await page.goto("/");
    const note = page.locator("#lp-page-note");
    await expect(note).toHaveText("Screen 1 of 3: something to move.");
    await page.getByRole("button", { name: "Show the next screen of the lesson" }).click();
    await expect(note).toHaveText("Screen 2 of 3: you try first.");
    await page.getByRole("button", { name: "See why" }).click();
    await expect(note).toHaveText("Screen 3 of 3: the reason, right under your answer.");
    await expect(page.locator("#learn [data-screen='2']")).toHaveAttribute("opacity", "1");
  });

  test("Prepare: the papers deal out and show what was asked", async ({ page }) => {
    await page.goto("/");
    const papers = page.getByRole("button", { name: "Spread out four example past papers" });
    await papers.click();
    await expect(papers).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("papers-ticks")).toHaveAttribute("opacity", "1");
  });

  test("Contribute: the note passes every check", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Send an example note through the checks" }).click();
    await expect(page.locator("#lp-checks li[data-done]")).toHaveCount(5);
    await expect(page.getByTestId("note-snippets")).toHaveAttribute("opacity", "1");
  });

  test("Teach: teaching opens at Mastered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Familiar", exact: true }).click();
    await expect(page.getByTestId("teach-note")).toHaveText("Familiar: teaching opens at Mastered.");
    await expect(page.getByTestId("teach-banner")).toHaveAttribute("opacity", "0");
  });

  test("Earn: the calculator updates points and caps the share at 20%", async ({ page }) => {
    await page.goto("/");
    const out = page.getByTestId("calc-out");
    await expect(out).toContainText("42");
    await expect(out).toContainText("3%");
    await page.getByRole("button", { name: "More students who used your uploads" }).click();
    await expect(out).toContainText("43");
    await page.getByLabel("All contributors' points").fill("100");
    await expect(out).toContainText("20%");
    await expect(out).toContainText("of the pool, capped at 20%");
    await expect(out).not.toContainText("₦");
  });

  test("Trust: the engine computes the step", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Check the step" }).click();
    await expect(page.getByTestId("engine-readout")).toHaveText("3.00");
    await expect(page.locator("#trust")).toContainText(
      "The engine computed 2 × 1.5 = 3. The step that said 3.5 is dropped.",
    );
  });

  test("Final: Dot hops back onto the i", async ({ page }) => {
    await page.goto("/");
    const dot = page.getByTestId("final-dot");
    const before = await dot.getAttribute("style");
    await page.getByRole("button", { name: "Put the dot back on the i" }).click();
    await expect(page.getByRole("button", { name: "Let the dot jump down again" })).toBeVisible();
    expect(await dot.getAttribute("style")).not.toBe(before);
  });

  test("Journey: Dot hops to the row you point at", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover only");
    await page.goto("/");
    const dot = page.getByTestId("journey-dot");
    await page.locator(".lp-jrow").nth(2).scrollIntoViewIfNeeded();
    await expect(dot).toHaveAttribute("style", /translateY/);
    const before = await dot.getAttribute("style");
    await page.locator(".lp-jrow").nth(3).hover();
    await expect.poll(() => dot.getAttribute("style")).not.toBe(before);
  });
});

test("never shows two primary actions at once while scrolling", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const visiblePrimaries = () =>
    page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>(".lp-btn-primary")].filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            getComputedStyle(el).visibility !== "hidden" && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
          );
        }).length,
    );
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const counts: number[] = [];
  for (let y = 0; y <= height; y += 350) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
    const n = await visiblePrimaries();
    expect(n, `at scroll ${y}`).toBeLessThanOrEqual(1);
    counts.push(n);
  }
  // Header "Start free" is the outline secondary, never camwood.
  await expect(page.locator(".lp-header .lp-btn-primary")).toHaveCount(0);
  expect(counts[0]).toBe(1);
});

test("the sticky bar appears on phones once the hero button scrolls away", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phones only");
  await page.goto("/");
  const bar = page.getByRole("region", { name: "Start or sign in" });
  await expect(bar).toBeHidden();
  await page.locator("#learn").scrollIntoViewIfNeeded();
  await expect(bar).toBeVisible();
  await page.locator("#start").scrollIntoViewIfNeeded();
  await expect(bar).toBeHidden();
});

test("has no horizontal scroll and one H1", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/");
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Spread out four example past papers" }).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Learn any topic in your course with lessons you can move");
});

test("copy follows the voice rules", async ({ page }) => {
  await page.goto("/");
  // textContent includes closed FAQ answers.
  const text = await page.evaluate(() =>
    ["header", "main", "footer"].map((s) => document.querySelector(s)?.textContent ?? "").join(" "),
  );
  for (const banned of [
    /predicted/i,
    /likely to appear/i,
    /lecturer/i,
    /guaranteed/i,
    /\bcoins?\b/i,
    /\bgems?\b/i,
    /\btokens?\b/i,
    /magic/i,
    /invitation/i,
  ]) {
    expect(text, String(banned)).not.toMatch(banned);
  }
  expect(text).not.toMatch(/(?![©®™])\p{Extended_Pictographic}/u);
});

test("CTAs go to create account and sign in", async ({ page }) => {
  await page.goto("/");
  const starts = page.locator("a", { hasText: "Start learning free" });
  expect(await starts.count()).toBeGreaterThanOrEqual(3);
  for (const href of await starts.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
    expect(href).toBe("/sign-in?mode=signup");
  }
  await expect(page.locator(".lp-header a", { hasText: "Start free" })).toHaveAttribute("href", "/sign-in?mode=signup");
  await expect(page.locator(".lp-header a", { hasText: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const signIns = await page
    .locator("a", { hasText: /^Sign in$/ })
    .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(signIns.every((h) => h === "/sign-in")).toBe(true);
});

test("metadata, JSON-LD, robots and sitemap", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Ifiok · AI learning agent for Nigerian university students");
  const meta = (sel: string) => page.locator(sel).getAttribute("content");
  expect(await meta('meta[name="description"]')).toMatch(/^Interactive lessons for any topic in your course/);
  // The root canonical is the site origin itself (Next drops the trailing slash).
  const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
  expect(canonical.pathname).toBe("/");
  expect(await meta('meta[property="og:title"]')).toBe("Ifiok · the AI learning agent for students");
  expect(await meta('meta[property="og:locale"]')).toBe("en_NG");
  expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");

  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  const types = ld["@graph"].map((n: { "@type": string }) => n["@type"]);
  expect(types).toEqual(["Organization", "WebSite", "WebApplication", "FAQPage"]);
  const faq = ld["@graph"][3].mainEntity.map((q: { name: string }) => q.name);
  const summaries = await page.locator("#faq summary").allTextContents();
  expect(faq).toEqual(summaries);
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|"review"/);

  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  expect(robots).toContain("Disallow: /api/");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/</loc>", "/terms</loc>", "/privacy</loc>", "/ai</loc>"]) expect(sitemap).toContain(path);
});

test("sign-in opens on Create account from the sign-up link", async ({ page }) => {
  await page.goto("/sign-in?mode=signup");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/create/i);
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(/create/i);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every illustration and demo shows its resting frame", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("hero-readout")).toHaveText("At x = 1.00, the slope is 2.00.");
    await expect(page.locator("svg.lp-plot")).toBeVisible();
    for (const id of ["learn", "prepare", "contribute", "teach", "earn", "trust", "start"]) {
      await expect(page.locator(`#${id} svg`).last(), id).toBeVisible();
    }
    await expect(page.getByTestId("journey-dot")).toBeVisible();
    await expect(page.locator("#lp-page-note")).toHaveText("Screen 1 of 3: something to move.");
    await expect(page.getByTestId("teach-note")).toHaveText("Mastered: write, record a voice note or a short video.");
    await expect(page.getByTestId("calc-out")).toContainText("42");
    await expect(page.getByTestId("calc-out")).toContainText("3%");
    await expect(page.getByRole("region", { name: "Start or sign in" })).toBeHidden();
    await expect(page.locator("a", { hasText: "Start learning free" }).first()).toBeVisible();
  });
});
