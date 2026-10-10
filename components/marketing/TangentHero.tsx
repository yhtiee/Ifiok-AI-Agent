"use client";

import { useCallback, useId, useRef, useState, type FormEvent, type PointerEvent } from "react";

// The landing hero: a live mini-lesson (specifications/07-brand-ui-ux.md §5.11),
// built from the example lesson in 05 §7 ("The slope of a curve").
// It mirrors a Lesson DSL `plot` block: f(x) = x^2 (role quantity), a tangent annotation
// at param a (role rate), x in [-3, 3], y in [-1, 9], a in [-2.5, 2.5] step 0.05.
// Replace with the real plot block renderer once P0-09 lands.

const X_MIN = -3;
const X_MAX = 3;
const Y_MIN = -1;
const Y_MAX = 9;
const A_MIN = -2.5;
const A_MAX = 2.5;
const A_STEP = 0.05;
const A_DEFAULT = 1;

const W = 600;
const H = 400;

// Every number shown is computed here, never typed in copy ("Never guess a number").
const f = (x: number) => x * x;
const slopeAt = (a: number) => 2 * a;

const sx = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
const sy = (y: number) => ((Y_MAX - y) / (Y_MAX - Y_MIN)) * H;

const CHECK_X = 1.5;
const CHECK_ANSWER = slopeAt(CHECK_X);

function snap(a: number) {
  const clamped = Math.min(A_MAX, Math.max(A_MIN, a));
  return Math.round(clamped / A_STEP) * A_STEP;
}

function fmt(n: number) {
  const v = Math.abs(n) < 1e-9 ? 0 : n;
  return v.toFixed(2).replace("-", "−");
}

const curvePath = (() => {
  const pts: string[] = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / n;
    pts.push(`${i === 0 ? "M" : "L"}${sx(x).toFixed(1)},${sy(f(x)).toFixed(1)}`);
  }
  return pts.join(" ");
})();

const xTicks = [-3, -2, -1, 0, 1, 2, 3];
const yTicks = [0, 2, 4, 6, 8];

type Verdict = { kind: "correct" | "wrong" | "invalid"; text: string } | null;

export function TangentHero() {
  const [a, setA] = useState(A_DEFAULT);
  const [touched, setTouched] = useState(false);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const ids = useId();

  const ya = f(a);
  const m = slopeAt(a);
  // Tangent y = f(a) + m (x - a), drawn across the full x range and clipped to the plot.
  const tx1 = X_MIN;
  const tx2 = X_MAX;
  const ty1 = ya + m * (tx1 - a);
  const ty2 = ya + m * (tx2 - a);

  const moveTo = useCallback((clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = X_MIN + ((clientX - rect.left) / rect.width) * (X_MAX - X_MIN);
    setA(snap(x));
    setTouched(true);
  }, []);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (dragging.current) moveTo(e.clientX);
  };
  const endDrag = () => {
    dragging.current = false;
  };

  const onCheck = (e: FormEvent) => {
    e.preventDefault();
    const value = Number(answer.trim().replace(",", ".").replace("−", "-"));
    if (answer.trim() === "" || !Number.isFinite(value)) {
      setVerdict({ kind: "invalid", text: "Type a number, for example 2.5." });
      return;
    }
    const ok = Math.abs(value - CHECK_ANSWER) <= 1e-9 + 1e-6 * Math.abs(CHECK_ANSWER);
    setVerdict(
      ok
        ? {
            kind: "correct",
            text: `Correct. The slope is 2x, and 2 × ${CHECK_X} = ${CHECK_ANSWER}.`,
          }
        : {
            kind: "wrong",
            text: `Not quite. Drag the point to x = ${CHECK_X} and read the slope off the line.`,
          },
    );
  };

  const summaryId = `${ids}-summary`;
  const titleId = `${ids}-title`;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <p className="text-sm text-ink-2">
          Try it now · <span className="text-ink">The slope of a curve</span>
        </p>
        <p className="text-sm text-ink-2 tabular-nums">1 min</p>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        <p className="max-w-[60ch] text-base">
          A straight line has one slope everywhere. A curve&apos;s steepness keeps changing.{" "}
          <strong className="font-semibold">Drag the point</strong> and watch the{" "}
          <span className="font-semibold text-change">orange line</span>.
        </p>
      </div>

      <figure className="m-0 px-2 pt-3 sm:px-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full cursor-ew-resize select-none"
          style={{ touchAction: "pan-y" }}
          role="img"
          aria-labelledby={`${titleId} ${summaryId}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <title id={titleId}>Graph of y = x squared with its tangent line</title>
          <defs>
            <clipPath id={`${ids}-clip`}>
              <rect x="0" y="0" width={W} height={H} />
            </clipPath>
          </defs>

          {/* grid */}
          <g stroke="var(--line)" strokeWidth="1">
            {xTicks.map((x) => (
              <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={H} />
            ))}
            {yTicks.map((y) => (
              <line key={`gy${y}`} x1={0} x2={W} y1={sy(y)} y2={sy(y)} />
            ))}
          </g>
          {/* axes */}
          <g stroke="var(--ink-3)" strokeWidth="1.5">
            <line x1={0} x2={W} y1={sy(0)} y2={sy(0)} />
            <line x1={sx(0)} x2={sx(0)} y1={0} y2={H} />
          </g>
          <g fill="var(--ink-2)" fontSize="15" className="tabular-nums">
            {xTicks
              .filter((x) => x !== 0)
              .map((x) => (
                <text
                  key={`lx${x}`}
                  x={x === X_MIN ? sx(x) + 4 : x === X_MAX ? sx(x) - 4 : sx(x)}
                  y={sy(0) + 20}
                  textAnchor={x === X_MIN ? "start" : x === X_MAX ? "end" : "middle"}
                >
                  {String(x).replace("-", "−")}
                </text>
              ))}
            {yTicks
              .filter((y) => y !== 0)
              .map((y) => (
                <text key={`ly${y}`} x={sx(0) - 10} y={sy(y) + 5} textAnchor="end">
                  {y}
                </text>
              ))}
          </g>

          <g clipPath={`url(#${ids}-clip)`}>
            {/* f(x) = x^2, role quantity */}
            <path d={curvePath} fill="none" stroke="var(--quantity)" strokeWidth="3.5" strokeLinecap="round" />
            {/* tangent, role rate */}
            <line
              x1={sx(tx1)}
              y1={sy(ty1)}
              x2={sx(tx2)}
              y2={sy(ty2)}
              stroke="var(--change)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* drop line to the x-axis */}
            <line
              x1={sx(a)}
              x2={sx(a)}
              y1={sy(ya)}
              y2={sy(0)}
              stroke="var(--ink-3)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
            />
          </g>

          <text x={sx(2.15)} y={sy(f(2.15)) - 4} fill="var(--quantity)" fontSize="17" fontWeight="600" textAnchor="end">
            y = x²
          </text>

          {/* handle: large hit area, visible ring + dot */}
          <g aria-hidden="true">
            <circle cx={sx(a)} cy={sy(ya)} r="22" fill="var(--change)" opacity="0.14" />
            <circle cx={sx(a)} cy={sy(ya)} r="10" fill="var(--surface)" stroke="var(--change)" strokeWidth="3.5" />
          </g>
        </svg>

        <figcaption className="px-2 pt-2 pb-1 text-sm text-ink-2 sm:px-2">
          The orange line touches the curve at one point: the tangent. Its slope is the slope of the curve there.
        </figcaption>
      </figure>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-2 pb-4 sm:px-5">
        <dl
          id={summaryId}
          aria-live="polite"
          className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-input)] border border-line text-center tabular-nums"
        >
          <div className="px-2 py-2">
            <dt className="text-xs text-ink-2">Point x</dt>
            <dd className="font-display text-lg font-semibold">{fmt(a)}</dd>
          </div>
          <div className="border-x border-line px-2 py-2">
            <dt className="text-xs text-ink-2">y = x²</dt>
            <dd className="font-display text-lg font-semibold text-quantity">{fmt(ya)}</dd>
          </div>
          <div className="px-2 py-2">
            <dt className="text-xs text-ink-2">Slope</dt>
            <dd className="font-display text-lg font-semibold text-change">{fmt(m)}</dd>
          </div>
        </dl>

        <label className="grid gap-1 text-sm text-ink-2">
          <span>Point x (you can also use this slider or the arrow keys)</span>
          <input
            type="range"
            min={A_MIN}
            max={A_MAX}
            step={A_STEP}
            value={a}
            onChange={(e) => {
              setA(snap(Number(e.target.value)));
              setTouched(true);
            }}
            className="h-11 w-full accent-[var(--change)]"
          />
        </label>

        {!touched ? (
          <p className="text-sm text-ink-2">Drag the point to see what happens.</p>
        ) : (
          <form
            onSubmit={onCheck}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border-t border-line pt-3"
            noValidate
          >
            <label htmlFor={`${ids}-answer`} className="text-base">
              Check yourself: what is the slope of y = x² at x = {CHECK_X}?
            </label>
            <div className="flex gap-2">
              <input
                id={`${ids}-answer`}
                inputMode="decimal"
                autoComplete="off"
                value={answer}
                onChange={(e) => {
                  setAnswer(e.target.value);
                  setVerdict(null);
                }}
                className="h-11 w-0 min-w-0 flex-1 rounded-[var(--radius-input)] border border-line bg-paper px-3 text-base tabular-nums"
                aria-describedby={`${ids}-verdict`}
              />
              <button
                type="submit"
                className="h-11 rounded-full border border-ink px-5 text-base font-semibold hover:bg-paper"
              >
                Check
              </button>
            </div>
            <p
              id={`${ids}-verdict`}
              aria-live="polite"
              className={
                verdict?.kind === "correct" ? "text-sm font-semibold text-ok" : verdict ? "text-sm text-bad" : "sr-only"
              }
            >
              {verdict?.text ?? ""}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
