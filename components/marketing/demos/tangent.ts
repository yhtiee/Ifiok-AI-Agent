// Maths for the hero mini-lesson: y = x² with its tangent at x = a (a Lesson DSL `plot` block:
// f(x) = x^2, tangent at param a, x in [-3, 3], y in [-1, 9], a in [-2.5, 2.5] step 0.05).
// Every number on screen is computed here, never typed in copy (guardrail 2).

export const X_MIN = -3;
export const X_MAX = 3;
export const Y_MIN = -1;
export const Y_MAX = 9;
export const A_MIN = -2.5;
export const A_MAX = 2.5;
export const A_STEP = 0.05;
export const A_DEFAULT = 1;
export const W = 600;
export const H = 400;

export const f = (x: number) => x * x;
export const slopeAt = (a: number) => 2 * a;
export const sx = (x: number) => ((x - X_MIN) / (X_MAX - X_MIN)) * W;
export const sy = (y: number) => ((Y_MAX - y) / (Y_MAX - Y_MIN)) * H;

export function snap(a: number) {
  const clamped = Math.min(A_MAX, Math.max(A_MIN, a));
  return Math.round(clamped / A_STEP) * A_STEP;
}

/** Two decimals with a true minus sign. */
export function fmt(n: number) {
  const v = Math.abs(n) < 1e-9 ? 0 : n;
  return v.toFixed(2).replace("-", "−");
}

export type DotPose = "flat" | "smile" | "steep";

/** Everything the hero draws for a point a. */
export function tangentFrame(a: number) {
  const y = f(a);
  const m = slopeAt(a);
  // Dot leans by half the tangent's on-screen angle, clamped so it stays readable (05 §3.3).
  const screenAngle = (Math.atan2(-m * (H / (Y_MAX - Y_MIN)), W / (X_MAX - X_MIN)) * 180) / Math.PI;
  const lean = Math.max(-28, Math.min(28, screenAngle / 2));
  const pose: DotPose = Math.abs(m) > 3.4 ? "steep" : Math.abs(m) < 0.3 ? "smile" : "flat";
  return {
    a,
    y,
    m,
    px: sx(a),
    py: sy(y),
    tangent: { x1: 0, y1: sy(y + m * (X_MIN - a)), x2: W, y2: sy(y + m * (X_MAX - a)) },
    lean,
    pose,
  };
}
