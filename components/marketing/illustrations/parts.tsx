// Shared drawing parts for "the Marks" (specifications/landing/05 §3). Server-safe: no hooks.
import type { ReactNode } from "react";

/** One eye: white circle, ink ring, ink pupil (moved by usePointerEyes). */
export function Eye({ x, y, r = 9, stroke = 3 }: { x: number; y: number; r?: number; stroke?: number }) {
  return (
    <g className="lp-eye" transform={`translate(${x} ${y})`}>
      <circle r={r} fill="var(--ill-white)" stroke="var(--ill-line)" strokeWidth={stroke} />
      <circle className="lp-pupil" r={+(r * 0.47).toFixed(1)} fill="var(--ill-line)" />
    </g>
  );
}

/** A flat ground shadow at 10% ink. */
export function Ground({ cx, cy, rx, ry = 7 }: { cx: number; cy: number; rx: number; ry?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="var(--ill-line)" opacity=".1" />;
}

export type PathId = "learn" | "prepare" | "contribute" | "teach" | "earn";

/** The coloured field an illustration stands on, with its hint pill. */
export function Stage({ path, hint, children }: { path: PathId; hint?: string; children: ReactNode }) {
  return (
    <div className={`lp-stage lp-stage-${path}`}>
      {hint ? (
        <span className="lp-stage-hint" aria-hidden="true">
          {hint}
        </span>
      ) : null}
      {children}
    </div>
  );
}

// Four hand-drawn brush paths for the Ink Line rail (viewBox 0 0 48 100, stretched).
const RAIL_PATHS = [
  "M24 0 C 21.5 25, 26.5 50, 24 100",
  "M24 0 C 26.5 30, 21.5 60, 24 100",
  "M24 0 C 21.5 35, 26 65, 24 100",
  "M24 0 C 26.5 30, 22 70, 24 100",
  "M24 0 C 22 40, 25 70, 24 100",
];
const JOURNEY_PATH = "M24 0 C 21 18, 27 34, 23.5 52 C 21 68, 26.5 84, 24 100";

/** The Ink Line: one continuous brush stroke, decorative. */
export function InkLine({ variant, seed = 0 }: { variant: "journey" | "rail"; seed?: number }) {
  return (
    <svg viewBox="0 0 48 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={variant === "journey" ? JOURNEY_PATH : RAIL_PATHS[seed % RAIL_PATHS.length]}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
