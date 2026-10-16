"use client";

import { useId, useState, type ReactNode } from "react";
import type { BlockOf, CheckpointItem } from "./types";

// Checkpoint feedback on the device. The server re-grades every attempt through /api/sync
// (guardrail 6, P1-04); this is only the instant feedback.

const inputClass =
  "min-h-11 flex-1 rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-ink-3 focus:border-change focus:outline-hidden";
const checkClass =
  "min-h-11 rounded-lg bg-change px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";

function Feedback({ correct, children }: { correct: boolean; children: ReactNode }) {
  return (
    <div
      role="status"
      className={`rounded-lg border-l-4 p-3 text-base leading-relaxed text-ink ${
        correct ? "border-ok bg-built-soft" : "border-bad bg-change-soft"
      }`}
    >
      <p className="font-semibold">{correct ? "Correct." : "Not quite."}</p>
      <div>{children}</div>
    </div>
  );
}

export function CheckpointBlock({ block }: { block: BlockOf<"checkpoint"> }) {
  const item = block.item;
  switch (item.type) {
    case "mcq":
      return <McqCheckpoint item={item} />;
    case "numeric":
      return <NumericCheckpoint item={item} />;
    case "expression":
      return <ExpressionCheckpoint item={item} />;
    default:
      // short_text, order and match get their own renderers with the practice items (P1-04).
      return (
        <div className="space-y-2">
          <p className="text-base font-semibold text-ink">{item.stem_md}</p>
          <p className="rounded-lg bg-paper p-3 text-base text-ink-2">{item.why}</p>
        </div>
      );
  }
}

function McqCheckpoint({ item }: { item: CheckpointItem<"mcq"> }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const chosen = item.options.find((o) => o.id === selected);

  return (
    <fieldset className="space-y-3">
      <legend className="text-base font-semibold text-ink">{item.stem_md}</legend>
      <div className="space-y-2">
        {item.options.map((opt) => {
          const isSelected = selected === opt.id;
          const isCorrect = opt.id === item.correct;
          const tone = submitted
            ? isCorrect
              ? "border-ok bg-built-soft"
              : isSelected
                ? "border-bad bg-change-soft"
                : "border-line bg-paper"
            : isSelected
              ? "border-quantity bg-quantity-soft"
              : "border-line bg-paper hover:border-quantity";
          return (
            <button
              key={opt.id}
              type="button"
              disabled={submitted}
              aria-pressed={isSelected}
              onClick={() => setSelected(opt.id)}
              className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border p-3 text-left text-base text-ink ${tone}`}
            >
              <span>{opt.md}</span>
              {submitted && isCorrect ? <span className="text-sm font-semibold text-ok">Correct answer</span> : null}
              {submitted && isSelected && !isCorrect ? (
                <span className="text-sm font-semibold text-bad">Your answer</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!submitted ? (
        <button type="button" disabled={!selected} onClick={() => setSubmitted(true)} className={checkClass}>
          Check answer
        </button>
      ) : chosen ? (
        <Feedback correct={chosen.id === item.correct}>{chosen.why}</Feedback>
      ) : null}
    </fieldset>
  );
}

function NumericCheckpoint({ item }: { item: CheckpointItem<"numeric"> }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"idle" | "correct" | "wrong" | "invalid">("idle");

  const check = () => {
    const n = Number(value.trim().replace(/,/g, ""));
    if (value.trim() === "" || !Number.isFinite(n)) return setResult("invalid");
    const tol = Math.max(item.tolerance?.abs ?? 0, (item.tolerance?.rel ?? 0) * Math.abs(item.stated), 1e-4);
    setResult(Math.abs(n - item.stated) <= tol ? "correct" : "wrong");
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {item.stem_md}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setResult("idle");
          }}
          placeholder={item.unit ? `Answer in ${item.unit}` : "Your answer"}
          className={inputClass}
        />
        <button type="button" onClick={check} className={checkClass}>
          Check
        </button>
      </div>
      {result === "invalid" ? <p className="text-base text-bad">Enter a number, for example 2.5.</p> : null}
      {result === "correct" ? <Feedback correct>{item.why}</Feedback> : null}
      {result === "wrong" ? (
        <Feedback correct={false}>
          The answer is {item.stated}
          {item.unit ? ` ${item.unit}` : ""}. {item.why}
        </Feedback>
      ) : null}
    </div>
  );
}

function ExpressionCheckpoint({ item }: { item: CheckpointItem<"expression"> }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"idle" | "checking" | "correct" | "wrong" | "unknown">("idle");

  // mathjs loads only here, on the first check of an expression item (02 §7).
  const check = async () => {
    if (!value.trim()) return;
    setResult("checking");
    try {
      const { equivalent } = await import("@ifiok/core/verify/equivalent");
      const r = equivalent(value, item.answer_expr, item.vars, item.domain);
      setResult(r === "unknown" ? "unknown" : r ? "correct" : "wrong");
    } catch {
      setResult("unknown");
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {item.stem_md}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => {
            setValue(e.target.value);
            setResult("idle");
          }}
          placeholder={`Use ${item.vars.join(", ")}, for example 2*${item.vars[0]}`}
          className={inputClass}
        />
        <button type="button" onClick={check} disabled={result === "checking"} className={checkClass}>
          Check
        </button>
      </div>
      {result === "correct" ? <Feedback correct>{item.why}</Feedback> : null}
      {result === "wrong" ? (
        <Feedback correct={false}>
          One answer is {item.answer_expr}. {item.why}
        </Feedback>
      ) : null}
      {result === "unknown" ? (
        <p className="text-base text-ink-2">
          Ifiok couldn&apos;t read that expression. Write it with * for multiplication and ^ for powers, then check
          again.
        </p>
      ) : null}
    </div>
  );
}
