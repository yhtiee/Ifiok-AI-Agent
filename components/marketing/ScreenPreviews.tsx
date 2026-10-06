// Static previews of three core screens (specifications/07-brand-ui-ux.md §5.3–§5.5),
// drawn with the real tokens. Replace with real screenshots once those screens are built.
import type { ReactNode } from "react";

function Phone({ children, label, bench = false }: { children: ReactNode; label: string; bench?: boolean }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`mx-auto w-full max-w-[300px] overflow-hidden rounded-[28px] border-[6px] ${
        bench ? "border-bench-2 bg-bench text-bench-ink" : "border-ink bg-paper text-ink"
      }`}
    >
      <div aria-hidden="true" className="flex min-h-[520px] flex-col">
        {children}
      </div>
    </div>
  );
}

/** Lesson player (Brilliant pattern): progress, one idea, feedback sheet with the why. */
export function LessonPreview() {
  return (
    <Phone label="Lesson player: a stepper showing why the slope of x squared is 2x, with a Correct feedback sheet.">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="text-lg leading-none text-ink-2">×</span>
        <div className="h-1.5 flex-1 rounded-full bg-line">
          <div className="h-full w-1/2 rounded-full bg-quantity" />
        </div>
      </div>
      <div className="flex-1 px-4 pt-5">
        <p className="font-display text-lg font-semibold leading-tight">Why the slope is 2x</p>
        <ol className="mt-4 grid gap-3 text-sm">
          <li className="rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2">
            <p className="font-semibold">((x + h)² − x²) / h</p>
            <p className="text-xs text-ink-2">Slope between x and x + h.</p>
          </li>
          <li className="rounded-[var(--radius-input)] border border-line bg-surface px-3 py-2">
            <p className="font-semibold">(2xh + h²) / h</p>
            <p className="text-xs text-ink-2">Expand; the x² terms cancel.</p>
          </li>
          <li className="rounded-[var(--radius-input)] border border-change bg-change-soft px-3 py-2">
            <p className="font-semibold">2x + h</p>
            <p className="text-xs text-ink-2">Divide each term by h. Now let h shrink to 0.</p>
          </li>
        </ol>
      </div>
      <div className="rounded-t-[20px] border-t border-line bg-surface px-4 pb-4 pt-3">
        <p className="font-display text-lg font-semibold text-ok">Correct</p>
        <p className="mt-1 text-sm text-ink-2">The slope is 2x, and 2 × 1.5 = 3.</p>
        <div className="mt-3 flex gap-2">
          <span className="flex h-11 flex-1 items-center justify-center rounded-full border border-line text-sm">
            Explain differently
          </span>
          <span className="flex h-11 flex-1 items-center justify-center rounded-full bg-change text-sm font-semibold text-on-change">
            Continue
          </span>
        </div>
      </div>
    </Phone>
  );
}

// Ohm's law reading, computed: EMF 3.0 V, internal resistance 0.5 Ω, R = 47 Ω.
const EMF = 3.0;
const R_INT = 0.5;
const R_LOAD = 47;
const CURRENT = EMF / (R_LOAD + R_INT);
const VOLTAGE = CURRENT * R_LOAD;

/** Lab on the Bench (PhET pattern): stations, canvas, instrument readings in mono. */
export function LabPreview() {
  const stations = ["Brief", "Build", "Measure", "Analyse", "Report"];
  return (
    <Phone bench label="Ohm's law lab on the dark Bench surface: a circuit with live meter readings.">
      <div className="px-3 pt-4">
        <p className="rounded-[var(--radius-bench)] border border-bench-line bg-bench-2 px-3 py-2 text-xs">
          Close the switch, then read both meters.
        </p>
        <div className="mt-3 grid grid-cols-5 rounded-[var(--radius-bench)] border border-bench-line text-center text-[11px]">
          {stations.map((s) => (
            <span
              key={s}
              className={`py-1.5 ${s === "Measure" ? "rounded-[6px] bg-bench-ink font-semibold text-bench" : "text-bench-ink"}`}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 280 200" className="mt-2 w-full flex-1" aria-hidden="true">
        <g fill="none" stroke="var(--bench-ink)" strokeWidth="2" strokeLinecap="round">
          <path d="M40 50 H240 V150 H40 Z" />
        </g>
        {/* battery */}
        <g stroke="var(--bench-ink)" strokeWidth="2.5">
          <line x1="34" y1="92" x2="46" y2="92" />
          <line x1="30" y1="100" x2="50" y2="100" strokeWidth="4" />
        </g>
        {/* resistor */}
        <rect x="115" y="40" width="50" height="20" rx="3" fill="var(--bench)" stroke="var(--bench-change)" strokeWidth="2.5" />
        <text x="140" y="34" textAnchor="middle" fontSize="11" fill="var(--bench-change)">R</text>
        {/* ammeter */}
        <circle cx="240" cy="100" r="17" fill="var(--bench)" stroke="var(--bench-quantity)" strokeWidth="2.5" />
        <text x="240" y="105" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--bench-quantity)">A</text>
        {/* voltmeter across R */}
        <path d="M115 50 V20 H130 M150 20 H165 V50" fill="none" stroke="var(--bench-ink)" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="140" cy="20" r="11" fill="var(--bench)" stroke="var(--bench-quantity)" strokeWidth="2" />
        <text x="140" y="24" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--bench-quantity)">V</text>
        {/* current arrows */}
        <path d="M80 150 l-8 -5 v10 z M200 50 l8 -5 v10 z" fill="var(--bench-built)" />
      </svg>
      <div className="grid grid-cols-2 gap-2 px-3 pb-4 font-mono">
        <div className="rounded-[var(--radius-bench)] border border-bench-line bg-bench-2 px-3 py-2">
          <p className="font-sans text-[11px] text-bench-ink">Voltmeter</p>
          <p className="text-lg text-bench-quantity tabular-nums">{VOLTAGE.toFixed(2)} V</p>
        </div>
        <div className="rounded-[var(--radius-bench)] border border-bench-line bg-bench-2 px-3 py-2">
          <p className="font-sans text-[11px] text-bench-ink">Ammeter</p>
          <p className="text-lg text-bench-quantity tabular-nums">{(CURRENT * 1000).toFixed(1)} mA</p>
        </div>
        <span className="col-span-2 mt-1 flex h-11 items-center justify-center rounded-full bg-bench-change font-sans text-sm font-semibold text-bench">
          Record reading
        </span>
      </div>
    </Phone>
  );
}

// Snap-and-mark example: ∫ from 1 to 3 of 2x dx. Correct value is computed, not typed.
const LOWER = 1;
const UPPER = 3;
const F = (x: number) => x * x;
const STUDENT_VALUE = F(LOWER) - F(UPPER);
const CORRECT_VALUE = F(UPPER) - F(LOWER);

/** Snap-and-mark result: each line marked, the first wrong line boxed in camwood. */
export function SnapPreview() {
  const lines: { text: string; state: "ok" | "wrong" | "after" }[] = [
    { text: `∫ from ${LOWER} to ${UPPER} of 2x dx`, state: "ok" },
    { text: `= [x²] from ${LOWER} to ${UPPER}`, state: "ok" },
    { text: `= ${LOWER}² − ${UPPER}²`, state: "wrong" },
    { text: `= ${String(STUDENT_VALUE).replace("-", "−")}`, state: "after" },
  ];
  return (
    <Phone label="Snap-and-mark result: handwritten working marked line by line, with the third line flagged and a fix hint.">
      <div className="px-4 pt-4">
        <p className="font-display text-lg font-semibold">Your working</p>
        <p className="text-xs text-ink-2">Marked line by line</p>
      </div>
      <ol className="mx-4 mt-3 grid gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-3 text-[15px]">
        {lines.map((l) => (
          <li
            key={l.text}
            className={`flex items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 ${
              l.state === "wrong" ? "border-2 border-change bg-change-soft" : "border-2 border-transparent"
            }`}
          >
            <span className={l.state === "after" ? "text-ink-3" : ""}>{l.text}</span>
            <span className={`text-xs ${l.state === "ok" ? "text-ok" : l.state === "wrong" ? "font-semibold text-change" : "text-ink-3"}`}>
              {l.state === "ok" ? "✓ ok" : l.state === "wrong" ? "Check this" : "—"}
            </span>
          </li>
        ))}
      </ol>
      <div className="mx-4 mt-3 grid gap-1">
        <p className="text-sm font-semibold">Not quite.</p>
        <p className="text-sm text-ink-2">
          You subtracted F({UPPER}) from F({LOWER}); it&apos;s top minus bottom: {UPPER}² − {LOWER}² = {CORRECT_VALUE}.
        </p>
      </div>
      <div className="mt-auto px-4 pb-4">
        <p className="mb-2 text-sm text-ink-2">
          Estimated marks <span className="font-semibold text-ink tabular-nums">2 / 4</span>
        </p>
        <span className="flex h-11 items-center justify-center rounded-full bg-change text-sm font-semibold text-on-change">
          Practise this
        </span>
      </div>
    </Phone>
  );
}
