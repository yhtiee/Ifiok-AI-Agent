// Renders the Devpost images in submission/ to PNG at 3:2 (3000 × 2000): the thumbnail, and the
// phone gallery image composed from e2e/gallery.spec.ts's phone screenshots.
// Usage: node scripts/render-thumbnail.mts   (uses the installed Chrome)
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const pages = [
  ["submission/thumbnail.html", "submission/thumbnail.png"],
  ["submission/phones.html", "submission/gallery/12-on-a-phone.png"],
] as const;

const browser = await chromium.launch({ channel: "chrome" });
for (const [html, png] of pages) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(resolve(html)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: png, type: "png" });
  await page.close();
  console.log(`✓ ${png} (3000 × 2000)`);
}
await browser.close();
