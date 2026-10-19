"use client";

import { useEffect, useState } from "react";
import { SIGN_IN_HREF, SIGN_UP_HREF } from "./copy";

// Sticky mobile bar (specifications/landing/04 §5.12, 05 §4): shows once the hero button has
// scrolled above the viewport and hides while the final call to action is on screen, so only one
// camwood button is ever visible. Without JS it never shows (the page's own buttons remain).

export function StickyCta({ heroId, endId }: { heroId: string; endId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const end = document.getElementById(endId);
    if (!hero || !end || !("IntersectionObserver" in window)) return;
    let heroOut = false;
    let endIn = false;
    const update = () => setShow(heroOut && !endIn);
    const a = new IntersectionObserver(([e]) => {
      if (!e) return;
      heroOut = !e.isIntersecting && e.boundingClientRect.top < 0;
      update();
    });
    const b = new IntersectionObserver(
      ([e]) => {
        if (!e) return;
        endIn = e.isIntersecting;
        update();
      },
      { threshold: 0.15 },
    );
    a.observe(hero);
    b.observe(end);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, [heroId, endId]);

  return (
    <div className="lp-sticky" role="region" aria-label="Start or sign in" data-show={show ? "" : undefined}>
      <a className="lp-signin" href={SIGN_IN_HREF} tabIndex={show ? 0 : -1}>
        Sign in
      </a>
      <a className="lp-btn-primary" href={SIGN_UP_HREF} tabIndex={show ? 0 : -1}>
        Start learning free
      </a>
    </div>
  );
}
