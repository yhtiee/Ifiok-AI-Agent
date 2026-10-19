"use client";

import { useState } from "react";

// Trust: the maths engine checks an AI-drafted step (specifications/landing/05 §3.3). The draft
// "3.5" is a fixed illustration of a wrong step; the checked value is computed here, never typed.

export function EngineScene({ a = 2, b = 1.5, draft = 3.5 }: { a?: number; b?: number; draft?: number }) {
  const [checked, setChecked] = useState(false);
  const result = a * b;

  return (
    <div className="lp-engine-stage">
      <svg viewBox="0 0 400 230" aria-hidden="true">
        <path
          d="M20 40 h170 a12 12 0 0 1 12 12 v54 a12 12 0 0 1 -12 12 h-120 l-18 16 v-16 h-32 a12 12 0 0 1 -12 -12 v-54 a12 12 0 0 1 12 -12z"
          fill="var(--bench-2)"
          stroke="var(--bench-ink)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <text x="36" y="70" fill="var(--bench-ink-2)" fontSize="14">
          AI draft
        </text>
        <text x="36" y="100" fill="var(--bench-ink)" fontSize="22" fontWeight="600">
          {a} × {b} = {draft}
        </text>
        <path
          d="M144 93 H184"
          stroke="var(--bench-change)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity={checked ? 1 : 0}
          data-testid="engine-strike"
        />
        <path
          d="M210 82 H238"
          stroke="var(--bench-quantity)"
          strokeWidth="2.5"
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
        <path
          d="M232 76 l7 6 l-7 6"
          fill="none"
          stroke="var(--bench-quantity)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <g>
          <path d="M268 182 V200 M352 182 V200" stroke="var(--bench-ink)" strokeWidth="4" strokeLinecap="round" />
          <rect
            x="248"
            y="30"
            width="128"
            height="154"
            rx="10"
            fill="var(--bench-line)"
            stroke="var(--bench-ink)"
            strokeWidth="3"
          />
          <g transform="translate(286 62)">
            <circle r="14" fill="var(--bench)" stroke="var(--bench-ink)" strokeWidth="2.5" />
            <path d="M0 0 L-6 -8" stroke="var(--bench-built)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g transform="translate(338 62)">
            <circle r="14" fill="var(--bench)" stroke="var(--bench-ink)" strokeWidth="2.5" />
            <path d="M0 0 L6 -8" stroke="var(--bench-built)" strokeWidth="3" strokeLinecap="round" />
          </g>
          <rect
            x="262"
            y="96"
            width="100"
            height="44"
            rx="4"
            fill="var(--bench-screen)"
            stroke="var(--bench-ink)"
            strokeWidth="2"
          />
          <text
            x="350"
            y="126"
            textAnchor="end"
            fill="var(--bench-built)"
            fontSize="22"
            fontFamily="var(--font-jetbrains), monospace"
            data-testid="engine-readout"
          >
            {checked ? result.toFixed(2) : "– – –"}
          </text>
          <g fill="var(--bench)" stroke="var(--bench-ink)" strokeWidth="2">
            <rect x="266" y="152" width="22" height="16" rx="3" />
            <rect x="298" y="152" width="22" height="16" rx="3" />
            <rect x="330" y="152" width="28" height="16" rx="3" fill="var(--bench-change)" />
          </g>
        </g>
        <text x="312" y="222" textAnchor="middle" fill="var(--bench-ink-2)" fontSize="13">
          Maths engine
        </text>
      </svg>
      <button className="lp-bench-btn" type="button" onClick={() => setChecked((c) => !c)}>
        {checked ? "Reset" : "Check the step"}
      </button>
      <p className="lp-engine-note" aria-live="polite">
        {checked
          ? `The engine computed ${a} × ${b} = ${result}. The step that said ${draft} is dropped.`
          : "The AI wrote a step. The engine hasn't checked it yet."}
      </p>
    </div>
  );
}
