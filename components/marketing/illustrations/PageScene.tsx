"use client";

import { useRef, useState } from "react";
import { Eye, Ground, Stage } from "./parts";
import { usePointerEyes } from "./usePointerEyes";

// Learn: Page, a lesson page with a screen on its belly (specifications/landing/05 §3.3).
// Tap Page or a pill to change screens; Page squashes like a page turn (not under reduced motion).

const SCREENS = ["Drag the graph", "Answer the question", "See why"] as const;
const NOTES = [
  "Screen 1 of 3: something to move.",
  "Screen 2 of 3: you try first.",
  "Screen 3 of 3: the reason, right under your answer.",
];

export function PageScene() {
  const [s, setS] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<SVGGElement>(null);
  usePointerEyes(root);

  const go = (n: number) => {
    setS(n);
    const el = body.current;
    if (el?.animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(.86)" }, { transform: "scaleX(1)" }], {
        duration: 260,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
    }
  };

  return (
    <div ref={root}>
      <Stage path="learn" hint="Tap the page">
        <button
          className="lp-ill-btn"
          type="button"
          aria-label="Show the next screen of the lesson"
          aria-describedby="lp-page-note"
          onClick={() => go((s + 1) % 3)}
        >
          <svg viewBox="0 0 400 290" aria-hidden="true">
            <Ground cx={200} cy={268} rx={84} />
            <g className="lp-perk" ref={body}>
              <path
                d="M175 230 L170 262 M225 230 L230 262"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse cx="166" cy="264" rx="10" ry="4.5" fill="var(--ill-line)" />
              <ellipse cx="234" cy="264" rx="10" ry="4.5" fill="var(--ill-line)" />
              <path
                d="M128 150 L102 178 M272 132 L300 112"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <circle cx="300" cy="111" r="6" fill="var(--ill-line)" />
              <path
                d="M140 46 H246 L264 64 V222 Q264 232 254 232 H140 Q130 232 130 222 V56 Q130 46 140 46Z"
                fill="var(--ill-learn)"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <path
                d="M246 46 V58 Q246 64 252 64 H264"
                fill="var(--ill-learn-2)"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <Eye x={180} y={76} />
              <Eye x={214} y={76} />
              <rect
                x="148"
                y="98"
                width="98"
                height="116"
                rx="8"
                fill="var(--ill-white)"
                stroke="var(--ill-line)"
                strokeWidth="3"
              />
              <g className="lp-fade" opacity={s === 0 ? 1 : 0} data-screen="0">
                <path
                  d="M158 116 Q197 250 236 116"
                  fill="none"
                  stroke="var(--ill-learn)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <path d="M176 196 L232 140" stroke="var(--ill-dot)" strokeWidth="3" strokeLinecap="round" />
                <circle cx="212" cy="160" r="7" fill="var(--ill-dot)" stroke="var(--ill-line)" strokeWidth="2" />
                <path
                  d="M200 200 h24 M204 196 l-4 4 l4 4 M220 196 l4 4 l-4 4"
                  fill="none"
                  stroke="var(--ill-line)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              <g className="lp-fade" opacity={s === 1 ? 1 : 0} data-screen="1">
                <path
                  d="M184 128 q13 -14 26 0 q0 12 -13 16 v8"
                  fill="none"
                  stroke="var(--ill-line)"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <circle cx="197" cy="164" r="3" fill="var(--ill-line)" />
                <rect
                  x="160"
                  y="178"
                  width="34"
                  height="22"
                  rx="11"
                  fill="var(--stage-learn)"
                  stroke="var(--ill-line)"
                  strokeWidth="2"
                />
                <rect
                  x="200"
                  y="178"
                  width="34"
                  height="22"
                  rx="11"
                  fill="var(--ill-white)"
                  stroke="var(--ill-line)"
                  strokeWidth="2"
                />
              </g>
              <g className="lp-fade" opacity={s === 2 ? 1 : 0} data-screen="2">
                <path
                  d="M166 150 l14 14 l26 -30"
                  fill="none"
                  stroke="var(--ill-contribute)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M162 186 H232 M162 198 H214"
                  stroke="var(--ill-line)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity=".7"
                />
              </g>
            </g>
          </svg>
        </button>
        <div className="lp-stage-ui">
          <div className="lp-seg" role="group" aria-label="Lesson screens">
            {SCREENS.map((label, i) => (
              <button key={label} type="button" aria-pressed={s === i} onClick={() => go(i)}>
                {label}
              </button>
            ))}
          </div>
          <p className="lp-stage-note" id="lp-page-note" aria-live="polite">
            {NOTES[s]}
          </p>
        </div>
      </Stage>
    </div>
  );
}
