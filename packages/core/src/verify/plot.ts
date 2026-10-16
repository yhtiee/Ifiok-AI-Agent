import { compile, parse } from "mathjs";
import { compileExpressionToAst, normalizeExpressionString } from "../expr/compile";
import { ExprAst } from "../expr/types";
import { walkAndValidateNode } from "../expr/walk";

export type PlotCheckResult = {
  valid: boolean;
  finiteRatio: number;
  compiledAst?: ExprAst;
  error?: string;
};

/**
 * Verifies that a plot function evaluates to a finite real number at >= 50%
 * of 200 sample points across the given x bounds (05 §6).
 */
export function checkPlotFunction(
  expr: string,
  xRange: [number, number],
  params: Record<string, number> = {},
): PlotCheckResult {
  try {
    const norm = normalizeExpressionString(expr);
    const allowedVars = new Set(["x", ...Object.keys(params)]);
    walkAndValidateNode(parse(norm), 1, allowedVars);

    const compiled = compile(norm);
    const compiledAst = compileExpressionToAst(expr, ["x", ...Object.keys(params)]);

    const [minX, maxX] = xRange;
    const samples = 200;
    const step = (maxX - minX) / samples;
    let finiteCount = 0;

    for (let i = 0; i <= samples; i++) {
      const xVal = minX + i * step;
      const scope = { ...params, x: xVal };
      try {
        const val = compiled.evaluate(scope);
        if (typeof val === "number" && Number.isFinite(val) && !Number.isNaN(val)) {
          finiteCount++;
        }
      } catch {
        // Discontinuity or non-real result
      }
    }

    const ratio = finiteCount / (samples + 1);
    return {
      valid: ratio >= 0.5,
      finiteRatio: ratio,
      compiledAst,
    };
  } catch (err: unknown) {
    return {
      valid: false,
      finiteRatio: 0,
      error: (err as Error).message,
    };
  }
}
