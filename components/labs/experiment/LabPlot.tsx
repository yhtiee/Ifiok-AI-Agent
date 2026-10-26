import type { Fit, Point } from "@ifiok/core/labs/engine";
import { fmt, ticks } from "./model";

// The results graph: the student's points and, once drawn, the best-fit line. Plain SVG (no plot
// library on the lab route); every plot has a text summary (07 §3.4).

const W = 340;
const H = 240;
const PAD = { l: 48, r: 12, t: 12, b: 40 };

export function plotSummary(points: Point[], fit: Fit | null, xLabel: string, yLabel: string): string {
  if (points.length < 2) return `Plot of ${yLabel} against ${xLabel}: take readings at two or more settings to see it.`;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const base = `Plot of ${yLabel} against ${xLabel}: ${points.length} points, ${xLabel} from ${fmt(Math.min(...xs))} to ${fmt(Math.max(...xs))}, ${yLabel} from ${fmt(Math.min(...ys))} to ${fmt(Math.max(...ys))}.`;
  return fit ? `${base} Best-fit line: gradient ${fmt(fit.gradient)}, intercept ${fmt(fit.intercept)}.` : base;
}

export function LabPlot(props: {
  points: Point[];
  fit: Fit | null;
  xLabel: string;
  yLabel: string;
  textOnly?: boolean;
}) {
  const { points, fit, xLabel, yLabel } = props;
  const summary = plotSummary(points, fit, xLabel, yLabel);
  if (props.textOnly) return <p className="text-base">{summary}</p>;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  if (fit && xs.length) ys.push(fit.intercept, fit.gradient * Math.max(...xs) + fit.intercept);
  // Include the origin: these graphs usually start near zero, and the intercept matters.
  const x0 = Math.min(0, ...xs);
  const x1 = Math.max(1e-9, ...xs) * 1.08;
  const y0 = Math.min(0, ...ys);
  const y1 = Math.max(1e-9, ...ys) * 1.08;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => H - PAD.b - ((y - y0) / (y1 - y0)) * (H - PAD.t - PAD.b);
  const xt = ticks(x0, x1);
  const yt = ticks(y0, y1);

  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-xl text-ink"
        role="img"
        aria-label={summary}
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="currentColor" strokeWidth="1" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="currentColor" strokeWidth="1" />
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} y1={H - PAD.b} x2={sx(t)} y2={H - PAD.b + 4} stroke="currentColor" />
            <text x={sx(t)} y={H - PAD.b + 16} textAnchor="middle" className="fill-ink-2 text-[10px]">
              {fmt(t)}
            </text>
          </g>
        ))}
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.l - 4} y1={sy(t)} x2={PAD.l} y2={sy(t)} stroke="currentColor" />
            <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" className="fill-ink-2 text-[10px]">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={(PAD.l + W - PAD.r) / 2} y={H - 6} textAnchor="middle" className="fill-ink text-[11px]">
          {xLabel}
        </text>
        <text
          x={12}
          y={(PAD.t + H - PAD.b) / 2}
          textAnchor="middle"
          transform={`rotate(-90 12 ${(PAD.t + H - PAD.b) / 2})`}
          className="fill-ink text-[11px]"
        >
          {yLabel}
        </text>
        {fit ? (
          <line
            x1={sx(x0)}
            y1={sy(fit.gradient * x0 + fit.intercept)}
            x2={sx(x1)}
            y2={sy(fit.gradient * x1 + fit.intercept)}
            className="stroke-change"
            strokeWidth="2"
          />
        ) : null}
        {points.map((p, i) => (
          <g key={i} className="text-quantity">
            <line x1={sx(p.x) - 4} y1={sy(p.y)} x2={sx(p.x) + 4} y2={sy(p.y)} stroke="currentColor" strokeWidth="2" />
            <line x1={sx(p.x)} y1={sy(p.y) - 4} x2={sx(p.x)} y2={sy(p.y) + 4} stroke="currentColor" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <figcaption className="text-sm text-ink-2">{summary}</figcaption>
    </figure>
  );
}
