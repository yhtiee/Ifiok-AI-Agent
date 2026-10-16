"use client";

import { useState } from "react";
import { stripMathDelimiters } from "@ifiok/core/dsl/inline-math";
import { Formula, RichText } from "../RichText";
import type { BlockOf } from "./types";

export function StepperBlock({ block }: { block: BlockOf<"stepper"> }) {
  const [shown, setShown] = useState(1);
  const total = block.steps.length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-2">
        Step {Math.min(shown, total)} of {total}
      </p>
      <ol className="space-y-3 border-l-2 border-quantity pl-3">
        {block.steps.slice(0, shown).map((s, i) => (
          <li key={i} className="text-base leading-relaxed text-ink">
            <span className="font-semibold text-quantity">Step {i + 1}. </span>
            <RichText text={s.why} />
            <div className="mt-1 overflow-x-auto rounded bg-quantity-soft p-2 text-quantity">
              <Formula latex={stripMathDelimiters(s.latex)} />
            </div>
          </li>
        ))}
      </ol>
      {shown < total ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + 1)}
          className="min-h-11 rounded-lg border border-quantity px-4 text-sm font-semibold text-quantity hover:bg-quantity-soft"
        >
          Show the next step
        </button>
      ) : null}
    </div>
  );
}
