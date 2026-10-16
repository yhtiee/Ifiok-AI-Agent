// How close a numeric answer must be to the stated value (05 §4). Shared by the verifier (stated vs
// the engine's value of answer_expr) and the on-screen check (student vs stated), so both agree.
// Dependency-free: client-safe.

/** Decimal places a number is written with: 0.498 → 3, 2.44 → 2, 6 → 0, 1.5e-5 → 6. */
export function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const [mantissa, exp] = n.toExponential().split("e");
  const fraction = (mantissa!.split(".")[1] ?? "").length;
  return Math.max(0, fraction - Number(exp));
}

/**
 * A value rounded to the precision it is written with counts as equal (0.498 for 0.49768), but the
 * rounding allowance never exceeds 0.5% of the value, so "6" does not pass for 5.6. An explicit
 * tolerance on the item widens it.
 */
export function numericTolerance(stated: number, tolerance?: { abs?: number; rel?: number }): number {
  const magnitude = Math.abs(stated);
  const rounding = Math.min(0.5 * 10 ** -decimalsOf(stated), 0.005 * magnitude);
  return Math.max(tolerance?.abs ?? 0, (tolerance?.rel ?? 0) * magnitude, rounding, 1e-9 * Math.max(1, magnitude));
}

export function numericMatches(value: number, stated: number, tolerance?: { abs?: number; rel?: number }): boolean {
  return Number.isFinite(value) && Math.abs(value - stated) <= numericTolerance(stated, tolerance);
}
