import { compile, parse, EvalFunction } from "mathjs";
import { normalizeExpressionString } from "../expr/compile";
import { walkAndValidateNode } from "../expr/walk";
import { equivalent } from "./equivalent";

export type StepCheckOutcome = "ok" | "wrong" | "unchecked";

/**
 * Finds approximate real roots of D(x) = 0 in [-10, 10].
 */
function findRealRoots(expr: string, variable = "x", range: [number, number] = [-10, 10]): number[] {
  let compiled: EvalFunction;
  try {
    const norm = normalizeExpressionString(expr);
    walkAndValidateNode(parse(norm), 1, new Set([variable]));
    compiled = compile(norm);
  } catch {
    return [];
  }

  const roots: number[] = [];
  const [minX, maxX] = range;
  const numSteps = 400;
  const stepSize = (maxX - minX) / numSteps;

  function evalD(val: number): number | null {
    try {
      const res = compiled.evaluate({ [variable]: val });
      if (typeof res === "number" && Number.isFinite(res) && !Number.isNaN(res)) {
        return res;
      }
    } catch {
      // ignore
    }
    return null;
  }

  // Also check integer points explicitly
  for (let i = Math.ceil(minX); i <= Math.floor(maxX); i++) {
    const v = evalD(i);
    if (v !== null && Math.abs(v) < 1e-7) {
      if (!roots.some((r) => Math.abs(r - i) < 1e-3)) {
        roots.push(i);
      }
    }
  }

  let prevX = minX;
  let prevY = evalD(prevX);

  for (let i = 1; i <= numSteps; i++) {
    const currX = minX + i * stepSize;
    const currY = evalD(currX);

    if (prevY !== null && currY !== null) {
      // Check for zero crossing
      if ((prevY <= 0 && currY >= 0) || (prevY >= 0 && currY <= 0)) {
        // Bisection to refine
        let low = prevX;
        let high = currX;
        for (let b = 0; b < 20; b++) {
          const mid = (low + high) / 2;
          const midY = evalD(mid);
          if (midY === null) break;
          if (Math.abs(midY) < 1e-7) {
            low = mid;
            break;
          }
          if ((prevY <= 0 && midY >= 0) || (prevY >= 0 && midY <= 0)) {
            high = mid;
          } else {
            low = mid;
          }
        }
        const refinedRoot = (low + high) / 2;
        if (!roots.some((r) => Math.abs(r - refinedRoot) < 1e-3)) {
          roots.push(refinedRoot);
        }
      }
    }

    prevX = currX;
    prevY = currY;
  }

  return roots.sort((a, b) => a - b);
}

/**
 * Parses an equation or branch like "x = 2 or x = -2" into D(x) expressions.
 */
function parseEquationDifference(line: string): string[] {
  const branches = line
    .split(/\bor\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const diffs: string[] = [];

  for (const branch of branches) {
    const eqIdx = branch.indexOf("=");
    if (eqIdx !== -1) {
      const left = branch.slice(0, eqIdx).trim();
      const right = branch.slice(eqIdx + 1).trim();
      diffs.push(`(${left}) - (${right})`);
    } else {
      diffs.push(branch);
    }
  }

  return diffs;
}

/**
 * Checks a step in a stepper derivation or snap-and-mark working.
 * Returns 'ok', 'wrong', or 'unchecked' according to 05 §6 rules.
 */
export function checkStep(
  prevLine: string | null | undefined,
  currLine: string | null | undefined,
  vars: string[] = ["x", "h"],
): StepCheckOutcome {
  if (!currLine || !currLine.trim()) return "unchecked";

  const curr = currLine.trim();

  // Definitions like "let u = x^2" or text annotations are unchecked (05 §6)
  if (/^(let|where|suppose|assume|substitute|set)\b/i.test(curr)) {
    return "unchecked";
  }

  // First line in a derivation is unchecked by definition
  if (!prevLine || !prevLine.trim()) {
    return "ok";
  }

  const prev = prevLine.trim();
  if (/^(let|where|suppose|assume|substitute|set)\b/i.test(prev)) {
    return "unchecked";
  }

  // Handle continuation lines starting with '=': "= 2x + h"
  if (curr.startsWith("=")) {
    const exprPart = curr.slice(1).trim();
    const prevEqIdx = prev.lastIndexOf("=");
    if (prevEqIdx !== -1) {
      const prevLhs = prev.slice(0, prevEqIdx).trim();
      return checkStep(prev, `${prevLhs} = ${exprPart}`, vars);
    } else {
      return checkStep(prev, exprPart, vars);
    }
  }

  const prevHasEq = prev.includes("=");
  const currHasEq = curr.includes("=");

  // Case 1: Pure expression comparison (no '=' in either)
  if (!prevHasEq && !currHasEq) {
    try {
      const isEq = equivalent(prev, curr, vars);
      if (isEq === true) return "ok";
      if (isEq === false) return "wrong";
      return "unchecked";
    } catch {
      return "unchecked";
    }
  }

  // Case 2: Equation comparison (at least one has '=')
  try {
    const prevDiffs = parseEquationDifference(prev);
    const currDiffs = parseEquationDifference(curr);

    // Root finding for single-variable equations (default x)
    const variable = vars[0] || "x";
    const prevRoots = prevDiffs.flatMap((d) => findRealRoots(d, variable));

    if (prevRoots.length > 0) {
      // Check if ALL roots of prevLine are preserved in currLine (implication rule)
      const allPrevRootsPreserved = prevRoots.every((root) => {
        // Must satisfy at least one branch of currDiffs
        return currDiffs.some((d) => {
          try {
            const compiled = compile(normalizeExpressionString(d));
            const val = compiled.evaluate({ [variable]: root });
            return typeof val === "number" && Math.abs(val) < 1e-4;
          } catch {
            return false;
          }
        });
      });

      if (allPrevRootsPreserved) {
        return "ok";
      } else {
        // Lost root detected! (e.g. x^2 = 4 -> x = 2 loses root -2)
        return "wrong";
      }
    }

    // Fallback: Check if difference expressions are proportional across random samples
    const prevD = prevDiffs[0]!;
    const currD = currDiffs[0]!;
    const isEquiv = equivalent(prevD, currD, vars);
    if (isEquiv === true) return "ok";
    if (isEquiv === false) return "wrong";

    return "unchecked";
  } catch {
    return "unchecked";
  }
}
