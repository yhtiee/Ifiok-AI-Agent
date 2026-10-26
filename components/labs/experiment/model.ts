import { analysisPoints, fitLine, type Fit, type Point, type SettingReadings } from "@ifiok/core/labs/engine";
import type { PublicExperiment } from "@ifiok/core/labs/experiment";

// UI state for the experiment lab (05 §8 rule: logic in pure functions, the UI only renders).
// Readings come from the server for one seed; taking a reading reveals the next one at a setting.

/** How many readings of each setting the student has taken, keyed by the setting's value. */
export type Taken = Record<string, number>;

export function takeReading(taken: Taken, value: number, repeats: number): Taken {
  const k = String(value);
  const n = taken[k] ?? 0;
  return n >= repeats ? taken : { ...taken, [k]: n + 1 };
}

export function removeSetting(taken: Taken, value: number): Taken {
  const next = { ...taken };
  delete next[String(value)];
  return next;
}

/** The taken readings, in setting order, as the engine's shape. */
export function takenReadings(all: SettingReadings[], taken: Taken): SettingReadings[] {
  return all.flatMap((s) => {
    const n = taken[String(s.value)] ?? 0;
    return n ? [{ value: s.value, readings: s.readings.slice(0, n) }] : [];
  });
}

export function points(exp: PublicExperiment, readings: SettingReadings[]): Point[] {
  return analysisPoints(exp.analysis, { independent: exp.independent.symbol, measured: exp.measured.symbol }, readings);
}

export function fit(exp: PublicExperiment, readings: SettingReadings[]): Fit | null {
  return fitLine(points(exp, readings));
}

/** A percentage error: one decimal place under 10%, whole numbers above ("0.5%", "12%"). */
export const fmtPct = (v: number) => `${v < 10 ? v.toFixed(1) : Math.round(v)}%`;

/** 4 significant figures, no trailing noise. */
export const fmt = (v: number) => (Number.isFinite(v) ? Number(v.toPrecision(4)).toString() : "—");

/** "4 * pi^2 / gradient" → "4π² / gradient": readable, not rendered maths. */
export function prettyExpr(expr: string): string {
  return expr
    .replace(/\bpi\b/g, "π")
    .replace(/\s*\*\s*/g, " × ")
    .replace(/\^2\b/g, "²")
    .replace(/\^3\b/g, "³")
    .replace(/\bsqrt\(/g, "√(")
    .replace(/×\s*π/g, "π")
    .replace(/(\d) π/g, "$1π");
}

export const axisLabel = (exp: PublicExperiment, axis: "x" | "y") =>
  (axis === "x" ? exp.analysis.x_label : exp.analysis.y_label) || prettyExpr(exp.analysis[axis]);

/** The method as numbered steps (text mode and the report). */
export function methodSteps(exp: PublicExperiment): string[] {
  const iv = exp.independent;
  const mv = exp.measured;
  const unit = (u: string) => (u ? ` ${u}` : "");
  return [
    `Set up the apparatus: ${exp.apparatus.join(", ")}.`,
    `Set the ${iv.label.toLowerCase()} (${iv.symbol}) between ${fmt(iv.min)} and ${fmt(iv.max)}${unit(iv.unit)}.`,
    `Measure the ${mv.label.toLowerCase()} (${mv.symbol})${exp.repeats > 1 ? ` ${exp.repeats} times and take the mean` : ""}.`,
    `Repeat for at least ${exp.min_readings} values of ${iv.symbol} spread over the whole range.`,
    `Plot ${axisLabel(exp, "y")} against ${axisLabel(exp, "x")} and draw the best-fit straight line.`,
    `Find the ${exp.analysis.derive.from} and calculate ${exp.analysis.derive.symbol} = ${prettyExpr(exp.analysis.derive.expr)}.`,
  ];
}

/** "Nice" tick values covering [lo, hi]. */
export function ticks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
