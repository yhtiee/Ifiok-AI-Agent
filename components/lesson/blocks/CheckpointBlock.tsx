"use client";

import { useId, useState, type ReactNode } from "react";
import { numericMatches } from "@ifiok/core/dsl/numeric";
import { RichText } from "../RichText";
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
    case "order":
      return <OrderCheckpoint item={item} seed={block.id} />;
    case "match":
      return <MatchCheckpoint item={item} seed={block.id} />;
    default:
      // short_text needs the AI answer check (P1-04); show the model answer for now.
      return (
        <div className="space-y-2">
          <p className="text-base font-semibold text-ink">
            <RichText text={item.stem_md} />
          </p>
          <p className="rounded-lg bg-paper p-3 text-base text-ink-2">
            <RichText text={item.why} />
          </p>
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
      <legend className="text-base font-semibold text-ink">
        <RichText text={item.stem_md} />
      </legend>
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
              <span>
                <RichText text={opt.md} />
              </span>
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
        <Feedback correct={chosen.id === item.correct}>
          <RichText text={chosen.why} />
        </Feedback>
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
    setResult(numericMatches(n, item.stated, item.tolerance) ? "correct" : "wrong");
  };

  return (
    <div className="space-y-3">
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        <RichText text={item.stem_md} />
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
      {result === "correct" ? (
        <Feedback correct>
          <RichText text={item.why} />
        </Feedback>
      ) : null}
      {result === "wrong" ? (
        <Feedback correct={false}>
          The answer is {item.stated}
          {item.unit ? ` ${item.unit}` : ""}. <RichText text={item.why} />
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
        <RichText text={item.stem_md} />
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
      {result === "correct" ? (
        <Feedback correct>
          <RichText text={item.why} />
        </Feedback>
      ) : null}
      {result === "wrong" ? (
        <Feedback correct={false}>
          One answer is {item.answer_expr}. <RichText text={item.why} />
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

/** Deterministic shuffle (same order on every render and device), never the answer order. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length > 1 && out.every((v, i) => v === items[i])) out.push(out.shift()!);
  return out;
}

/** Put the steps in order: move each step up or down (buttons, not drag, so it works everywhere). */
function OrderCheckpoint({ item, seed }: { item: CheckpointItem<"order">; seed: string }) {
  const [order, setOrder] = useState(() => shuffled(item.steps, seed));
  const [submitted, setSubmitted] = useState(false);
  const correct = order.every((s, i) => s === item.steps[i]);

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setOrder(next);
    setSubmitted(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-ink">
        <RichText text={item.stem_md} />
      </p>
      <ol className="space-y-2">
        {order.map((step, i) => {
          const right = step === item.steps[i];
          return (
            <li
              key={`${i}:${step}`}
              className={`flex items-center gap-2 rounded-lg border p-2 ${
                submitted ? (right ? "border-ok bg-built-soft" : "border-bad bg-change-soft") : "border-line bg-paper"
              }`}
            >
              <span className="w-6 text-center text-sm text-ink-2 tabular-nums">{i + 1}</span>
              <span className="flex-1 text-base text-ink">
                <RichText text={step} />
              </span>
              {submitted ? (
                <span className={`text-sm font-semibold ${right ? "text-ok" : "text-bad"}`}>
                  {right ? "Right place" : "Wrong place"}
                </span>
              ) : (
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move step ${i + 1} up`}
                    className="min-h-11 min-w-11 rounded-md border border-line text-ink disabled:text-ink-3"
                  >
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move step ${i + 1} down`}
                    className="min-h-11 min-w-11 rounded-md border border-line text-ink disabled:text-ink-3"
                  >
                    Down
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!submitted ? (
        <button type="button" onClick={() => setSubmitted(true)} className={checkClass}>
          Check order
        </button>
      ) : (
        <>
          <Feedback correct={correct}>
            <RichText text={item.why} />
          </Feedback>
          {!correct ? (
            <button
              type="button"
              onClick={() => setSubmitted(false)}
              className="min-h-11 text-sm font-semibold text-change"
            >
              Try again
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Match each item on the left to one on the right. */
function MatchCheckpoint({ item, seed }: { item: CheckpointItem<"match">; seed: string }) {
  const id = useId();
  const rights = shuffled(
    item.pairs.map(([, r]) => r),
    seed,
  );
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const complete = item.pairs.every((_, i) => picks[i]);
  const allRight = item.pairs.every(([, r], i) => picks[i] === r);

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-ink">
        <RichText text={item.stem_md} />
      </p>
      <ul className="space-y-2">
        {item.pairs.map(([left, right], i) => {
          const ok = picks[i] === right;
          return (
            <li
              key={left}
              className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr] sm:items-center ${
                submitted ? (ok ? "border-ok bg-built-soft" : "border-bad bg-change-soft") : "border-line bg-paper"
              }`}
            >
              <label htmlFor={`${id}-${i}`} className="text-base text-ink">
                <RichText text={left} />
              </label>
              <select
                id={`${id}-${i}`}
                value={picks[i] ?? ""}
                disabled={submitted}
                onChange={(e) => setPicks({ ...picks, [i]: e.target.value })}
                className="min-h-11 rounded-lg border border-line bg-surface px-2 text-base text-ink"
              >
                <option value="">Choose a match</option>
                {rights.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {submitted && !ok ? (
                <p className="text-sm text-ink sm:col-span-2">
                  Matches: <RichText text={right} />
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!submitted ? (
        <button type="button" disabled={!complete} onClick={() => setSubmitted(true)} className={checkClass}>
          Check matches
        </button>
      ) : (
        <Feedback correct={allRight}>
          <RichText text={item.why} />
        </Feedback>
      )}
    </div>
  );
}
