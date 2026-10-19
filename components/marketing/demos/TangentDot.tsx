"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import { Eye } from "../illustrations/parts";
import { usePointerEyes } from "../illustrations/usePointerEyes";
import { A_DEFAULT, A_MAX, A_MIN, A_STEP, H, W, X_MAX, X_MIN, fmt, snap, tangentFrame } from "./tangent";

// The hero: one screen of a real lesson, with Dot (the wordmark's tittle) standing on the tangent
// (specifications/landing/05 §3.3). The server render is the complete resting frame at x = 1.

const GRID_X = [100, 200, 400, 500];
const GRID_Y = [280, 200, 120, 40];
const X_LABELS: [number, string][] = [
  [100, "−2"],
  [200, "−1"],
  [400, "1"],
  [500, "2"],
];
const Y_LABELS: [number, string][] = [
  [285, "2"],
  [205, "4"],
  [125, "6"],
  [45, "8"],
];

export function TangentDot({ initialX = A_DEFAULT }: { initialX?: number }) {
  const [a, setA] = useState(snap(initialX));
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const id = useId();
  usePointerEyes(svgRef);

  const fr = tangentFrame(a);
  const steep = fr.pose === "steep";

  const moveTo = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    setA(snap(X_MIN + ((clientX - r.left) / r.width) * (X_MAX - X_MIN)));
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) moveTo(e.clientX);
  };
  const stop = () => {
    dragging.current = false;
  };

  return (
    <div className="lp-stage lp-stage-learn lp-plot-stage">
      <svg
        ref={svgRef}
        className="lp-plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-labelledby={`${id}-t ${id}-s`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <title id={`${id}-t`}>Graph of y = x squared with its tangent line</title>
        <desc id={`${id}-s`}>
          A curve y = x² with a tangent line at a draggable point. The slope at the point equals 2x.
        </desc>
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect width={W} height={H} rx="6" />
          </clipPath>
        </defs>
        <g stroke="var(--ill-grid)" strokeWidth="1">
          {GRID_X.map((x) => (
            <line key={`x${x}`} x1={x} x2={x} y1="0" y2={H} />
          ))}
          {GRID_Y.map((y) => (
            <line key={`y${y}`} x1="0" x2={W} y1={y} y2={y} />
          ))}
        </g>
        <g stroke="var(--ill-line)" strokeWidth="1.5" opacity=".55">
          <line x1="0" x2={W} y1="360" y2="360" />
          <line x1="300" x2="300" y1="0" y2={H} />
        </g>
        <g fill="var(--ill-line)" fontSize="15" className="lp-tnum" opacity=".8">
          {X_LABELS.map(([x, t]) => (
            <text key={t} x={x} y="381" textAnchor="middle">
              {t}
            </text>
          ))}
          {Y_LABELS.map(([y, t]) => (
            <text key={t} x="290" y={y} textAnchor="end">
              {t}
            </text>
          ))}
        </g>
        <g clipPath={`url(#${id}-clip)`}>
          {/* y = x² exactly: a quadratic Bézier through (0,0), vertex (300,360), (600,0) */}
          <path d="M0,0 Q300,720 600,0" fill="none" stroke="var(--ill-learn)" strokeWidth="5" strokeLinecap="round" />
          <line
            x1={fr.px}
            x2={fr.px}
            y1={fr.py}
            y2="360"
            stroke="var(--ill-line)"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            opacity=".6"
          />
          <line
            x1={fr.tangent.x1}
            y1={fr.tangent.y1}
            x2={fr.tangent.x2}
            y2={fr.tangent.y2}
            stroke="var(--ill-dot)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </g>
        <text x="512" y="70" fill="var(--readout-quantity)" fontSize="19" fontWeight="600">
          y = x²
        </text>
        <g transform={`translate(${fr.px} ${fr.py}) rotate(${fr.lean.toFixed(2)})`}>
          <circle r="9" fill="var(--ill-paper)" stroke="var(--ill-dot)" strokeWidth="3.5" />
          <path d="M-9 -9 L-12 -24 M9 -9 L12 -24" stroke="var(--ill-line)" strokeWidth="3.5" strokeLinecap="round" />
          <g transform="translate(0 -50)">
            <path
              d={steep ? "M-25 0 L-44 -10 M25 0 L44 -10" : "M-25 6 L-33 20 M25 6 L33 20"}
              stroke="var(--ill-line)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <circle r="27" fill="var(--ill-dot)" stroke="var(--ill-line)" strokeWidth="3.5" />
            <Eye x={-9} y={-5} r={7} stroke={2.5} />
            <Eye x={9} y={-5} r={7} stroke={2.5} />
            {fr.pose === "smile" ? (
              <path d="M-7 10 Q0 16 7 10" fill="none" stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            ) : steep ? (
              <ellipse cx="0" cy="12" rx="3.5" ry="4.5" fill="var(--ill-line)" />
            ) : (
              <path d="M-5 12 L5 12" stroke="var(--ill-line)" strokeWidth="3" strokeLinecap="round" />
            )}
          </g>
        </g>
      </svg>
      <p className="lp-readout lp-tnum" id={`${id}-r`} aria-live="polite" data-testid="hero-readout">
        At x = <b className="lp-q">{fmt(fr.a)}</b>, the slope is <b className="lp-r">{fmt(fr.m)}</b>.
      </p>
      <input
        className="lp-slider"
        type="range"
        min={A_MIN}
        max={A_MAX}
        step={A_STEP}
        value={a}
        onChange={(e) => setA(snap(Number(e.target.value)))}
        aria-label="Point x"
        aria-describedby={`${id}-r`}
      />
    </div>
  );
}
