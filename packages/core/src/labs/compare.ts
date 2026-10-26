import { pctError, resultOf, settings, type SettingReadings } from "./engine";
import type { CompiledExperiment } from "./experiment";

// Comparing a student's result with the accepted value (05 §9 "Run"). The explanation of the gap is
// rules-based, from the readings they actually took: no AI at runtime (F4 cost notes).

export type LabComparison = {
  accepted: number;
  unit: string;
  /** The student's own value, as they calculated it. */
  stated: number;
  errorPct: number;
  withinTolerance: boolean;
  tolerancePct: number;
  /** The value their readings give through a correct calculation (null when no line fits). */
  fromReadings: number | null;
  notes: string[];
};

const fmt = (v: number) => Number(v.toPrecision(4)).toString();

export function compareRun(c: CompiledExperiment, taken: SettingReadings[], stated: number): LabComparison {
  const { analysis, min_readings, repeats, independent } = c.config;
  const accepted = analysis.accepted;
  const unit = analysis.derive.unit;
  const errorPct = pctError(stated, accepted);
  const withinTolerance = errorPct <= analysis.tolerance_pct;
  const own = resultOf(c, taken);
  const notes: string[] = [];

  if (own && pctError(stated, own.value) > 1)
    notes.push(
      `Your readings give ${analysis.derive.symbol} = ${fmt(own.value)} ${unit} through the ${analysis.derive.from}; check your calculation.`,
    );
  if (taken.length < min_readings)
    notes.push(`You took ${taken.length} settings; at least ${min_readings} give a more reliable line.`);
  const grid = settings(independent);
  const values = taken.map((t) => t.value);
  const span = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const fullSpan = grid[grid.length - 1]! - grid[0]!;
  if (fullSpan > 0 && span < 0.6 * fullSpan)
    notes.push(
      `Your readings cover ${independent.symbol} from ${fmt(Math.min(...values))} to ${fmt(Math.max(...values))} ${independent.unit}; spreading them over the whole range reduces the error in the gradient.`,
    );
  if (taken.some((t) => t.readings.length < repeats))
    notes.push(`Repeating each reading ${repeats} times and averaging reduces random error.`);
  if (own && own.fit.r2 < 0.98)
    notes.push(
      "The points scatter about the line: that is random error in the readings, which more readings and repeats reduce.",
    );
  if (!notes.length)
    notes.push(
      withinTolerance
        ? "The small remaining gap comes from random error in the readings and the instrument's resolution."
        : "Random error in the readings and the instrument's resolution cause the gap; more readings over the full range narrow it.",
    );

  return {
    accepted,
    unit,
    stated,
    errorPct,
    withinTolerance,
    tolerancePct: analysis.tolerance_pct,
    fromReadings: own ? own.value : null,
    notes,
  };
}
