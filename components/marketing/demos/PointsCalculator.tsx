"use client";

import { useRef, useState } from "react";
import { PoolScene } from "../illustrations/PoolScene";
import { Stage } from "../illustrations/parts";
import { usePointerEyes } from "../illustrations/usePointerEyes";
import { POINTS_MAX, clampStudents, computePoints, formatCount, formatShare, parseCount } from "./points";

// "Work out your points" (specifications/landing/04 §5.7): points and percentages only, no naira (Q42).

const DEFAULTS = { uploads: 30, explainers: 12, all: 1400 };

function Stepper({
  label,
  id,
  value,
  onChange,
}: {
  label: string;
  id: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="lp-calc-row">
      <span className="lp-lbl" id={id}>
        {label}
      </span>
      <span className="lp-stepper">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(clampStudents(value - 1))}
          disabled={value <= 0}
        >
          −
        </button>
        <output aria-labelledby={id}>{value}</output>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(clampStudents(value + 1))}
          disabled={value >= POINTS_MAX}
        >
          +
        </button>
      </span>
    </div>
  );
}

export function PointsCalculator() {
  const [uploads, setUploads] = useState(DEFAULTS.uploads);
  const [explainers, setExplainers] = useState(DEFAULTS.explainers);
  const [allText, setAllText] = useState(formatCount(DEFAULTS.all));
  const root = useRef<HTMLDivElement>(null);
  usePointerEyes(root);

  const r = computePoints({ uploads, explainers, all: parseCount(allText) });

  return (
    <div ref={root}>
      <Stage path="earn">
        <PoolScene share={r.share} />
        <div className="lp-stage-ui">
          <form className="lp-calc" aria-labelledby="lp-calc-t" onSubmit={(e) => e.preventDefault()}>
            <p id="lp-calc-t" className="lp-calc-title">
              <span className="lp-tag">Example</span>Work out your points
            </p>
            <Stepper label="Students who used your uploads" id="lp-u" value={uploads} onChange={setUploads} />
            <Stepper
              label="Students who finished your explainers"
              id="lp-e"
              value={explainers}
              onChange={setExplainers}
            />
            <div className="lp-calc-row">
              <label className="lp-lbl" htmlFor="lp-all">
                All contributors&apos; points
              </label>
              <input
                className="lp-num"
                id="lp-all"
                inputMode="numeric"
                autoComplete="off"
                value={allText}
                onChange={(e) => setAllText(e.target.value)}
                onBlur={() => setAllText(formatCount(parseCount(allText)))}
              />
            </div>
            <div className="lp-calc-out" aria-live="polite" data-testid="calc-out">
              <span>
                Your points<b>{r.points}</b>
              </span>
              <span>
                Your share<b>{formatShare(r.share)}</b>
              </span>
              <span className="lp-capped">{r.capped ? "of the pool, capped at 20%" : "of the pool"}</span>
            </div>
          </form>
        </div>
      </Stage>
    </div>
  );
}
