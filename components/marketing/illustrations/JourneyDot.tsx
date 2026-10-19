"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { InkLine } from "./parts";

// Journey: a small Dot perches on the active step node and hops along the Ink Line to the row you
// point at or focus (the page's one Ink Line advance, 05 §3.3). Without JS it sits on Step 1.

export function JourneyList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const [y, setY] = useState<number | null>(null);
  const [placed, setPlaced] = useState(false);
  const cur = useRef(0);

  const yOf = useCallback((i: number) => {
    const row = list.current?.querySelectorAll<HTMLElement>(".lp-jrow")[i];
    const node = row?.querySelector<HTMLElement>(".lp-jnode");
    return row && node ? row.offsetTop + node.offsetTop : 0;
  }, []);

  useEffect(() => {
    const place = () => {
      setPlaced(false);
      setY(yOf(cur.current));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [yOf]);

  // Re-enable the hop transition only after the first placement has painted.
  useEffect(() => {
    if (y === null || placed) return;
    const t = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(t);
  }, [y, placed]);

  const hop = (e: SyntheticEvent) => {
    const row = (e.target as Element).closest<HTMLElement>(".lp-jrow");
    const i = Number(row?.dataset.step);
    if (!Number.isInteger(i) || i === cur.current) return;
    cur.current = i;
    setY(yOf(i));
  };

  return (
    // Pointer and focus are only listened to here so Dot can follow; the rows hold the content.
    <div className="lp-journey-list" ref={list} onPointerOver={hop} onFocus={hop}>
      <div className="lp-journey-line" aria-hidden="true">
        <InkLine variant="journey" />
      </div>
      <div
        className="lp-journey-dot"
        aria-hidden="true"
        data-testid="journey-dot"
        style={y === null ? undefined : { transform: `translateY(${y}px)`, transition: placed ? undefined : "none" }}
      >
        <svg viewBox="0 0 48 48" width="48" height="48" style={{ overflow: "visible" }}>
          <g transform="translate(24 4)">
            <circle r="11" fill="var(--ill-dot)" stroke="var(--ill-line)" strokeWidth="2.5" />
            <circle cx="-4" cy="-1.5" r="3.2" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="1.5" />
            <circle cx="4" cy="-1.5" r="3.2" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="1.5" />
            <circle cx="-4" cy="-1.2" r="1.5" fill="var(--ill-line)" />
            <circle cx="4" cy="-1.2" r="1.5" fill="var(--ill-line)" />
          </g>
        </svg>
      </div>
      {children}
    </div>
  );
}
