"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Ground, Stage } from "./parts";
import { usePointerEyes } from "./usePointerEyes";

// Contribute: Note walks up to the gate; four lamps light and the check list ticks, then short
// green snippets appear in three lessons (specifications/landing/05 §3.3). Tap again to reset.

export const NOTE_CHECKS = [
  "Names and contact details removed",
  "Readable and on the topic",
  "Copyright signs checked",
  "Duplicates checked",
];

const STEP_MS = 260;
const WALK_MS = 380;

export function NoteScene() {
  const [walked, setWalked] = useState(false);
  const [done, setDone] = useState(0); // 0–5: checks ticked (5 = approved)
  const timers = useRef<number[]>([]);
  const root = useRef<HTMLDivElement>(null);
  usePointerEyes(root);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const running = walked && done < 5;

  const onTap = () => {
    if (running) return;
    if (walked) {
      setWalked(false);
      setDone(0);
      return;
    }
    setWalked(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDone(5);
      return;
    }
    timers.current = [1, 2, 3, 4, 5].map((n) => window.setTimeout(() => setDone(n), WALK_MS + (n - 1) * STEP_MS));
  };

  return (
    <div ref={root}>
      <Stage path="contribute" hint="Tap the note">
        <button
          className="lp-ill-btn"
          type="button"
          aria-label={walked ? "Reset the example note" : "Send an example note through the checks"}
          aria-describedby="lp-checks"
          onClick={onTap}
        >
          <svg viewBox="0 0 400 250" aria-hidden="true">
            <Ground cx={110} cy={232} rx={60} ry={6} />
            <g>
              {[70, 126, 182].map((y) => (
                <rect
                  key={y}
                  x="316"
                  y={y}
                  width="58"
                  height="44"
                  rx="6"
                  fill="var(--ill-white)"
                  stroke="var(--ill-line)"
                  strokeWidth="2.5"
                />
              ))}
              <path
                d="M326 84 H364 M326 140 H364 M326 196 H364"
                stroke="var(--ill-line)"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity=".5"
              />
              <g className="lp-fade" opacity={done >= 5 ? 1 : 0} data-testid="note-snippets">
                {[94, 150, 206].map((y) => (
                  <rect key={y} x="326" y={y} width="26" height="10" rx="3" fill="var(--ill-contribute)" />
                ))}
              </g>
            </g>
            <g className="lp-anim" style={{ transform: walked ? "translateX(34px)" : "none" }}>
              <g className="lp-perk">
                <path
                  d="M92 196 L88 228 M128 196 L132 228"
                  stroke="var(--ill-line)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <ellipse cx="84" cy="230" rx="10" ry="4.5" fill="var(--ill-line)" />
                <ellipse cx="136" cy="230" rx="10" ry="4.5" fill="var(--ill-line)" />
                <path
                  d="M62 120 L44 146 M158 120 L176 104"
                  stroke="var(--ill-line)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <rect
                  x="60"
                  y="68"
                  width="100"
                  height="130"
                  rx="8"
                  fill="var(--ill-contribute)"
                  stroke="var(--ill-line)"
                  strokeWidth="4"
                />
                <g fill="none" stroke="var(--ill-line)" strokeWidth="3">
                  {[80, 100, 120, 140].map((x) => (
                    <circle key={x} cx={x} cy="66" r="6" />
                  ))}
                </g>
                <Eye x={94} y={100} />
                <Eye x={126} y={100} />
                <path
                  d="M76 132 H144 M76 148 H134 M76 164 H140 M76 180 H118"
                  stroke="var(--ill-white)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </g>
            </g>
            <path
              d="M226 60 V230 M276 60 V230 M218 60 H284"
              stroke="var(--ill-line)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <g>
              {[90, 124, 158, 192].map((cy, i) => (
                <circle
                  key={cy}
                  cx="251"
                  cy={cy}
                  r="9"
                  fill={done > i ? "var(--ill-contribute)" : "var(--ill-white)"}
                  stroke="var(--ill-line)"
                  strokeWidth="2.5"
                />
              ))}
            </g>
          </svg>
        </button>
        <div className="lp-stage-ui">
          <ol className="lp-checks" id="lp-checks" aria-live="polite">
            {[...NOTE_CHECKS, "Approved"].map((c, i) => (
              <li key={c} data-done={done > i ? "" : undefined} className={i === 4 ? "lp-approved" : undefined}>
                {c}
                {done > i ? <span className="lp-sr"> (done)</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </Stage>
    </div>
  );
}
