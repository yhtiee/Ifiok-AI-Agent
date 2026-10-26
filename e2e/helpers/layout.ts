import { expect, type Page } from "@playwright/test";

/**
 * Every visible element inside <main> stays between the sidebar's right edge (or the screen's left
 * edge on phones) and the viewport's right edge. <main> clips sideways overflow, so a too-wide
 * element is cut off rather than scrolled; scrollWidth alone can't see it.
 */
export async function expectInsideContentArea(page: Page, where: string) {
  const offenders = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    const edge = aside && getComputedStyle(aside).display !== "none" ? aside.getBoundingClientRect().right : 0;
    const right = document.documentElement.clientWidth;
    const out: string[] = [];
    // Inside a scrolling or clipping box that itself fits, overflow can't reach the sidebar.
    const contained = (el: Element) => {
      for (let a = el.parentElement; a && a.tagName !== "MAIN"; a = a.parentElement) {
        if (getComputedStyle(a).overflowX === "visible") continue;
        const ar = a.getBoundingClientRect();
        if (ar.left >= edge - 1 && ar.right <= right + 1) return true;
      }
      return false;
    };
    for (const el of Array.from(document.querySelectorAll("main *"))) {
      // KaTeX's visually hidden MathML copy for screen readers.
      if (el.closest(".katex-mathml") || contained(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.left < edge - 1 || r.right > right + 1) {
        const cls = (el.getAttribute("class") ?? "").slice(0, 80);
        out.push(
          `<${el.tagName.toLowerCase()} class="${cls}"> ${Math.round(r.left)}–${Math.round(r.right)} (content ${Math.round(edge)}–${right})`,
        );
      }
    }
    return out.slice(0, 8);
  });
  expect(offenders, where).toEqual([]);
}
