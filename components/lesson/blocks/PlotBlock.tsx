"use client";

import { evaluateAst } from "@ifiok/core/expr-eval/index";
import type { ExprAst } from "@ifiok/core/expr/types";
import { useId, useState } from "react";
import { RichText } from "../RichText";
import type { BlockOf } from "./types";

const WIDTH = 360;
const HEIGHT = 180;
const SAMPLES = 80;

/**
 * Plots the ASTs the server compiled at save time (`block.compiled`) with the small AST
 * interpreter, so no mathjs ships to the client (02 §7). Sliders change the parameters live; the
 * text summary under the graph says what is drawn and the current slider values.
 */
export function PlotBlock({ block }: { block: BlockOf<"plot"> }) {
  const id = useId();
  const params = block.params ?? [];
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(params.map((p) => [p.name, p.value])),
  );
  const [xMin, xMax] = block.x;
  const [yMin, yMax] = block.y ?? [-10, 10];
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
        y = evaluateAst(ast, { ...values, x });
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
  const settings = params.map((p) => `${p.label} = ${values[p.name]}${p.unit ? ` ${p.unit}` : ""}`).join(", ");
  const summary = `Graph of ${labels} for x from ${xMin} to ${xMax}${settings ? `, with ${settings}` : ""}.`;

  return (
    // Fluid: the graph scales to its box (same 2:1 drawing, lines stay 2.5 px), up to a size that
    // stays readable on a wide screen.
    <figure className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <figcaption className="mb-2 text-sm font-semibold text-ink-2">
        <RichText text={block.caption ?? labels} />
      </figcaption>
      <div className="w-full rounded-lg border border-line bg-paper p-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={summary}
          className="block h-auto w-full overflow-visible"
        >
          {yMin <= 0 && yMax >= 0 ? (
            <line
              x1={0}
              y1={toSvgY(0)}
              x2={WIDTH}
              y2={toSvgY(0)}
              stroke="var(--line)"
              strokeDasharray="2,2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {xMin <= 0 && xMax >= 0 ? (
            <line
              x1={toSvgX(0)}
              y1={0}
              x2={toSvgX(0)}
              y2={HEIGHT}
              stroke="var(--line)"
              strokeDasharray="2,2"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={i === 0 ? "var(--quantity)" : "var(--change)"}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
      {params.length ? (
        <div className="mt-3 grid w-full gap-3">
          {params.map((p) => (
            <div key={p.name} className="grid gap-1">
              <label htmlFor={`${id}-${p.name}`} className="flex justify-between text-sm text-ink">
                <span>{p.label}</span>
                <output htmlFor={`${id}-${p.name}`} className="font-semibold text-quantity tabular-nums">
                  {values[p.name]}
                  {p.unit ? ` ${p.unit}` : ""}
                </output>
              </label>
              <input
                id={`${id}-${p.name}`}
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={values[p.name]}
                onChange={(e) => setValues((v) => ({ ...v, [p.name]: Number(e.target.value) }))}
                className="min-h-11 w-full accent-[var(--quantity)]"
              />
            </div>
          ))}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-ink-2">{summary}</p>
    </figure>
  );
}
