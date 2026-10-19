"use client";

import { useRef, useState } from "react";
import { Eye } from "./parts";
import { usePointerEyes } from "./usePointerEyes";

// Final call to action: the wordmark without its tittle, and Dot waving at the end of the Ink Line.
// Tap: Dot hops onto the ı and becomes the tittle; tap again: it hops back (05 §3.3).
// Placeholder lettering until the designer's final logo (07 §3.2), which must keep a round tittle.

export function DotHome() {
  const [home, setHome] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  usePointerEyes(ref);

  return (
    <button
      ref={ref}
      className="lp-ill-btn lp-final-scene"
      type="button"
      aria-label={home ? "Let the dot jump down again" : "Put the dot back on the i"}
      onClick={() => setHome((h) => !h)}
    >
      <svg viewBox="0 0 520 260" aria-hidden="true">
        <path
          d="M18 228 C 120 222, 260 232, 502 226"
          fill="none"
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <text
          x="40"
          y="214"
          fontFamily="var(--font-bricolage), sans-serif"
          fontWeight="800"
          fontSize="190"
          letterSpacing="-6"
          fill="var(--ink)"
        >
          ıfiok
        </text>
        <g
          className="lp-anim"
          style={{ transform: home ? "translate(62px, 92px)" : "translate(452px, 228px)" }}
          data-testid="final-dot"
        >
          <path d="M-9 -9 L-11 -2 M9 -9 L11 -2" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
          <g transform="translate(0 -40)">
            <path d="M27 -2 L44 -22" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
            <path d="M-27 4 L-35 18" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
            <circle r="28" fill="var(--change)" stroke="var(--ink)" strokeWidth="3.5" />
            <Eye x={-9} y={-5} r={7} stroke={2.5} />
            <Eye x={9} y={-5} r={7} stroke={2.5} />
            <path d="M-7 10 Q0 16 7 10" fill="none" stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>
    </button>
  );
}
