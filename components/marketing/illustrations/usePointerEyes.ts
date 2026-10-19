"use client";

import { useEffect, type RefObject } from "react";

// Eyes follow the pointer (specifications/landing/05 §3.2). One shared window listener for every
// eye on the page, batched in one requestAnimationFrame; eyes outside the viewport are skipped.
// Only on devices that hover, and never under reduced motion: pupils stay centred otherwise.

const MAX = 2.4;
const eyes = new Set<SVGGElement>();
let installed = false;
let raf = 0;
let tx = 0;
let ty = 0;

function look() {
  raf = 0;
  const h = window.innerHeight;
  for (const g of eyes) {
    const r = g.getBoundingClientRect();
    if (r.bottom < 0 || r.top > h) continue;
    const dx = tx - (r.left + r.width / 2);
    const dy = ty - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 160) * MAX;
    g.querySelector(".lp-pupil")?.setAttribute(
      "transform",
      `translate(${((dx / d) * k).toFixed(2)} ${((dy / d) * k).toFixed(2)})`,
    );
  }
}

function onPointer(e: PointerEvent) {
  tx = e.clientX;
  ty = e.clientY;
  if (!raf) raf = requestAnimationFrame(look);
}

function enabled() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Register every `.lp-eye` inside `ref` with the page's one pointer listener. */
export function usePointerEyes(ref: RefObject<Element | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled()) return;
    const mine = [...root.querySelectorAll<SVGGElement>(".lp-eye")];
    mine.forEach((g) => eyes.add(g));
    if (!installed) {
      installed = true;
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerdown", onPointer, { passive: true });
    }
    return () => {
      mine.forEach((g) => eyes.delete(g));
      if (eyes.size === 0 && installed) {
        installed = false;
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerdown", onPointer);
      }
    };
  }, [ref]);
}
