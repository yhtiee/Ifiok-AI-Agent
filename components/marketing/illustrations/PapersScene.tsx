"use client";

import { useRef, useState } from "react";
import { Eye, Ground, Stage } from "./parts";
import { usePointerEyes } from "./usePointerEyes";

// Prepare: a stack of past papers that deals out into a row (specifications/landing/05 §3.3).
// Ticks above three papers and a dash above the fourth: the picture counts, it never predicts.

const STACK = [
  "translate(196px,50px) rotate(8deg)",
  "translate(184px,46px) rotate(3deg)",
  "translate(122px,56px) rotate(-7deg)",
  "translate(150px,60px) rotate(0deg)",
];
const FAN = [
  "translate(24px,104px) rotate(-4deg)",
  "translate(112px,108px) rotate(2deg)",
  "translate(204px,104px) rotate(-1deg)",
  "translate(286px,96px) rotate(3deg) scale(.8)",
];
const LINES = "M12 22 H62 M12 46 H58 M12 70 H54 M12 86 H44";

function Tick({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 80)`}>
      <circle r="13" fill="var(--ill-contribute)" stroke="var(--ill-line)" strokeWidth="2.5" />
      <path
        d="M-6 0 l4 4 l8 -8"
        fill="none"
        stroke="var(--ill-white)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export function PapersScene({ example }: { example: string }) {
  const [dealt, setDealt] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  usePointerEyes(root);
  const at = (i: number) => ({
    transform: (dealt ? FAN : STACK)[i],
    transitionDelay: dealt ? `${i * 50}ms` : "0ms",
  });

  return (
    <div ref={root}>
      <Stage path="prepare" hint="Tap the papers">
        <button
          className="lp-ill-btn"
          type="button"
          aria-pressed={dealt}
          aria-label="Spread out four example past papers"
          onClick={() => setDealt((d) => !d)}
        >
          <svg viewBox="0 0 400 280" aria-hidden="true">
            <Ground cx={200} cy={262} rx={120} />
            <g className="lp-anim lp-pp" style={at(0)}>
              <rect width="80" height="104" rx="5" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="3" />
              <rect x="10" y="40" width="60" height="12" rx="3" fill="var(--ill-prep)" />
              <path d={LINES} stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="lp-anim lp-pp" style={at(1)}>
              <rect width="80" height="104" rx="5" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="3" />
              <rect x="10" y="64" width="60" height="12" rx="3" fill="var(--ill-prep)" />
              <path d={LINES} stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="lp-anim lp-pp" style={at(2)}>
              <rect width="80" height="104" rx="5" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="3" />
              <path d={LINES} stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g className="lp-anim lp-pp" style={at(3)}>
              <path
                d="M16 104 L12 150 M64 104 L68 150"
                stroke="var(--ill-line)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse cx="9" cy="152" rx="10" ry="4.5" fill="var(--ill-line)" />
              <ellipse cx="71" cy="152" rx="10" ry="4.5" fill="var(--ill-line)" />
              <rect width="100" height="112" rx="6" fill="var(--ill-prep)" stroke="var(--ill-line)" strokeWidth="4" />
              <Eye x={34} y={34} />
              <Eye x={66} y={34} />
              <path
                d="M40 56 Q50 64 60 56"
                fill="none"
                stroke="var(--ill-line)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path d="M18 80 H82 M18 94 H66" stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            </g>
            <g
              className="lp-fade"
              opacity={dealt ? 1 : 0}
              style={{ transitionDelay: dealt ? "300ms" : "0ms" }}
              data-testid="papers-ticks"
            >
              <Tick x={64} />
              <Tick x={152} />
              <Tick x={336} />
              <g transform="translate(244 80)">
                <circle r="13" fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth="2.5" />
                <path d="M-5 0 H5" stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </button>
        <div className="lp-stage-ui">
          <p className="lp-example">
            <span className="lp-tag">Example</span>
            {example}
          </p>
        </div>
      </Stage>
    </div>
  );
}
