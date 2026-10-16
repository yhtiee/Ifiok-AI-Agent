"use client";

import { evaluateAst } from "@ifiok/core/expr-eval/index";
import type { ExprAst } from "@ifiok/core/expr/types";
import type { BlockOf } from "./types";

const WIDTH = 360;
const HEIGHT = 180;
const SAMPLES = 80;

/**
 * Plots the ASTs the server compiled at save time (`block.compiled`) with the small AST
 * interpreter, so no mathjs ships to the client (02 §7). Every plot has a text summary.
 */
export function PlotBlock({ block }: { block: BlockOf<"plot"> }) {
  const [xMin, xMax] = block.x;
  const [yMin, yMax] = block.y ?? [-10, 10];
  const scope = Object.fromEntries((block.params ?? []).map((p) => [p.name, p.value]));
  const asts = (block.compiled?.functions ?? []) as ExprAst[];

  const toSvgX = (x: number) => ((x - xMin) / (xMax - xMin)) * WIDTH;
  const toSvgY = (y: number) => HEIGHT - ((y - yMin) / (yMax - yMin)) * HEIGHT;

  const paths = asts.map((ast) => {
    let d = "";
    let pen = false;
    for (let i = 0; i < SAMPLES; i++) {
      const x = xMin + (i * (xMax - xMin)) / (SAMPLES - 1);
      let y = Number.NaN;
      try {
        y = evaluateAst(ast, { ...scope, x });
      } catch {
        // leave a gap
      }
      if (!Number.isFinite(y) || y < yMin - (yMax - yMin) || y > yMax + (yMax - yMin)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"} ${toSvgX(x).toFixed(1)} ${toSvgY(y).toFixed(1)} `;
      pen = true;
    }
    return d.trim();
  });

  const labels = block.functions.map((f) => f.label ?? `y = ${f.expr}`).join(", ");
  const summary = `Graph of ${labels} for x from ${xMin} to ${xMax}.${block.caption ? ` ${block.caption}` : ""}`;

  return (
    <figure className="flex flex-col items-center">
      <figcaption className="mb-2 text-sm font-semibold text-ink-2">{block.caption ?? labels}</figcaption>
      <div className="max-w-full overflow-x-auto rounded-lg border border-line bg-paper p-2">
        <svg width={WIDTH} height={HEIGHT} role="img" aria-label={summary} className="overflow-visible">
          {yMin <= 0 && yMax >= 0 ? (
            <line x1={0} y1={toSvgY(0)} x2={WIDTH} y2={toSvgY(0)} stroke="var(--line)" strokeDasharray="2,2" />
          ) : null}
          {xMin <= 0 && xMax >= 0 ? (
            <line x1={toSvgX(0)} y1={0} x2={toSvgX(0)} y2={HEIGHT} stroke="var(--line)" strokeDasharray="2,2" />
          ) : null}
          {paths.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={i === 0 ? "var(--quantity)" : "var(--change)"} strokeWidth="2.5" />
          ))}
        </svg>
      </div>
      <p className="mt-2 text-sm text-ink-2">{summary}</p>
    </figure>
  );
}
