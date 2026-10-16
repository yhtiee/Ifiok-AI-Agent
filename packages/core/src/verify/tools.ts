import { compile, derivative, parse, simplify } from "mathjs";
import { normalizeExpressionString } from "../expr/compile";
import { walkAndValidateNode } from "../expr/walk";
import { checkAntiderivative } from "./calculus";
import { equivalent } from "./equivalent";

// Math verification tools for AI tutor and evaluation (specifications/04-ai.md §4.1).
// Any number shown to a student that comes from calculation must come from a tool result.

export function mathEvaluate(expr: string, scope: Record<string, number> = {}): number {
  const norm = normalizeExpressionString(expr);
  walkAndValidateNode(parse(norm), 1, new Set(Object.keys(scope)));
  const res = compile(norm).evaluate(scope);
  if (typeof res !== "number" || !Number.isFinite(res) || Number.isNaN(res)) {
    throw new Error(`Evaluation produced non-finite number`);
  }
  return res;
}

export function mathDerivative(expr: string, variable = "x"): string {
  const norm = normalizeExpressionString(expr);
  walkAndValidateNode(parse(norm), 1, new Set([variable]));
  return derivative(norm, variable).toString();
}

export function mathSimplify(expr: string, variable = "x"): string {
  const norm = normalizeExpressionString(expr);
  walkAndValidateNode(parse(norm), 1, new Set([variable]));
  return simplify(norm).toString();
}

export function mathCheckEquivalent(a: string, b: string, vars: string[] = ["x"]): boolean | "unknown" {
  return equivalent(a, b, vars);
}

export function mathIntegrateCheck(f: string, F: string, variable = "x"): boolean | "unknown" {
  return checkAntiderivative(F, f, variable);
}
