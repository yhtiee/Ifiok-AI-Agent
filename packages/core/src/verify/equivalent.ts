import { compile, parse } from "mathjs";
import { normalizeExpressionString } from "../expr/compile";
import { walkAndValidateNode } from "../expr/walk";

export type EquivalenceResult = boolean | "unknown";

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Tests numerical equivalence between two mathjs expressions:
 * 1. Draw points from [-5, 5] per variable (or declared domain) until 8 valid points are found (max 64 tries).
 * 2. If < 8 valid points found, retry once on (0, 5] (covers sqrt, log).
 * 3. Pass if |a - b| <= 1e-9 + 1e-6 * max(|a|, |b|) at every valid point.
 * 4. Fewer than 5 valid points in the end -> 'unknown' (never true).
 */
export function equivalent(
  exprA: string,
  exprB: string,
  vars: string[] = ["x"],
  domain?: Record<string, [number, number]>,
  seed = 42,
): EquivalenceResult {
  const normA = normalizeExpressionString(exprA);
  const normB = normalizeExpressionString(exprB);

  const varsSet = new Set(vars);
  const parsedA = parse(normA);
  const parsedB = parse(normB);

  walkAndValidateNode(parsedA, 1, varsSet);
  walkAndValidateNode(parsedB, 1, varsSet);

  const compiledA = compile(normA);
  const compiledB = compile(normB);

  const rng = seededRandom(seed);

  function samplePass(minVal: number, maxVal: number, requiredPoints: number): { valid: number; passed: boolean } {
    let validCount = 0;
    const maxTries = 64;

    for (let tryIdx = 0; tryIdx < maxTries && validCount < requiredPoints; tryIdx++) {
      const scope: Record<string, number> = {};
      for (const v of vars) {
        const d = domain?.[v] ?? [minVal, maxVal];
        scope[v] = d[0] + rng() * (d[1] - d[0]);
      }

      let valA: unknown;
      let valB: unknown;
      try {
        valA = compiledA.evaluate(scope);
        valB = compiledB.evaluate(scope);
      } catch {
        continue;
      }

      if (
        typeof valA === "number" &&
        typeof valB === "number" &&
        Number.isFinite(valA) &&
        Number.isFinite(valB) &&
        !Number.isNaN(valA) &&
        !Number.isNaN(valB)
      ) {
        validCount++;
        const diff = Math.abs(valA - valB);
        const tol = 1e-9 + 1e-6 * Math.max(Math.abs(valA), Math.abs(valB));
        if (diff > tol) {
          return { valid: validCount, passed: false };
        }
      }
    }

    return { valid: validCount, passed: true };
  }

  // Pass 1: [-5, 5]
  let result = samplePass(-5, 5, 8);
  if (!result.passed) return false;

  // Pass 2: If fewer than 8 valid points, retry on (0, 5]
  if (result.valid < 8) {
    result = samplePass(0.001, 5, 8);
    if (!result.passed) return false;
  }

  // Fewer than 5 valid points in total -> 'unknown'
  if (result.valid < 5) {
    return "unknown";
  }

  return true;
}
