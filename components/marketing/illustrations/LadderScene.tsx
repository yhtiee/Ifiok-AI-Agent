"use client";

import { useRef, useState } from "react";
import { Eye, Ground, Stage } from "./parts";
import { usePointerEyes } from "./usePointerEyes";

// Teach: Bubble on the mastery ladder (specifications/landing/05 §3.3). Anyone can teach (12 §4 Q52);
// the level shows learners how far the teacher has got on Ifiok.

export const LEVELS = ["Not started", "Familiar", "Proficient", "Mastered"] as const;
const POS: [number, number][] = [
  [69, 220],
  [153, 190],
  [237, 160],
  [321, 130],
];
const NOTES = [
  "Not started: you can still teach what you know.",
  "Familiar: learners see your level when you teach.",
  "Proficient: learners see your level when you teach.",
  "Mastered: shown on what you write, record or film.",
];
const STEP_FILL = ["var(--ill-white)", "var(--ill-built-1)", "var(--ill-built-2)", "var(--ill-contribute)"];

export function LadderScene({ initial = 3 }: { initial?: number }) {
  const [lv, setLv] = useState(initial);
  const root = useRef<HTMLDivElement>(null);
  usePointerEyes(root);
  const mastered = lv === 3;

  return (
    <div ref={root}>
      <Stage path="teach" hint="Pick a level">
        <svg viewBox="0 0 400 270" aria-hidden="true">
          <Ground cx={200} cy={254} rx={170} ry={6} />
          {STEP_FILL.map((fill, i) => (
            <rect
              key={i}
              x={30 + i * 84}
              y={220 - i * 30}
              width="78"
              height={30 + i * 30}
              rx="4"
              fill={fill}
              stroke="var(--ill-line)"
              strokeWidth="3"
            />
          ))}
          <g className="lp-fade" opacity={mastered ? 1 : 0} data-testid="teach-banner">
            <rect
              x="24"
              y="22"
              width="220"
              height="64"
              rx="12"
              fill="var(--ill-white)"
              stroke="var(--ill-line)"
              strokeWidth="3"
            />
            <path
              d="M206 86 L226 104 L222 86"
              fill="var(--ill-white)"
              stroke="var(--ill-line)"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M210 84 H222" stroke="var(--ill-white)" strokeWidth="4" />
            <g transform="translate(40 40)">
              <path
                d="M0 22 L4 10 L18 -4 L26 4 L12 18 Z"
                fill="var(--ill-prep)"
                stroke="var(--ill-line)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>
            <g transform="translate(104 54)" stroke="var(--ill-line)" strokeWidth="3.5" strokeLinecap="round">
              <path d="M0 -6 V6 M8 -14 V14 M16 -9 V9 M24 -16 V16 M32 -5 V5" />
            </g>
            <g transform="translate(172 38)">
              <rect width="52" height="34" rx="6" fill="var(--ill-teach)" stroke="var(--ill-line)" strokeWidth="2.5" />
              <path
                d="M21 9 L33 17 L21 25 Z"
                fill="var(--ill-white)"
                stroke="var(--ill-line)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </g>
          </g>
          <g className="lp-anim" style={{ transform: `translate(${POS[lv]![0]}px,${POS[lv]![1]}px)` }}>
            <g className="lp-perk">
              <path d="M-10 -6 L-12 -1 M10 -6 L12 -1" stroke="var(--ill-line)" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="-14" cy="0" rx="9" ry="4" fill="var(--ill-line)" />
              <ellipse cx="14" cy="0" rx="9" ry="4" fill="var(--ill-line)" />
              <path
                d="M-30 -84 h60 a12 12 0 0 1 12 12 v44 a12 12 0 0 1 -12 12 h-18 l-4 10 l-12 -10 h-26 a12 12 0 0 1 -12 -12 v-44 a12 12 0 0 1 12 -12z"
                fill="var(--ill-teach)"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <Eye x={-13} y={-58} />
              <Eye x={15} y={-58} />
              <path
                d={mastered ? "M-8 -38 Q1 -30 10 -38" : "M-6 -35 L8 -35"}
                fill="none"
                stroke="var(--ill-line)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>
        <div className="lp-stage-ui">
          <div className="lp-seg" role="group" aria-label="Mastery level">
            {LEVELS.map((label, i) => (
              <button key={label} type="button" aria-pressed={lv === i} onClick={() => setLv(i)}>
                {label}
              </button>
            ))}
          </div>
          <p className="lp-stage-note" aria-live="polite" data-testid="teach-note">
            {NOTES[lv]}
          </p>
        </div>
      </Stage>
    </div>
  );
}
