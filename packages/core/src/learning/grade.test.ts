import { describe, expect, it } from "vitest";
import { gradeAttempt, parseNumber } from "./grade";

// MVP-03: the server marks every answer itself (guardrail 6). Items as checkpointItems/itemRows store them.

const mcq = {
  type: "mcq",
  stem: {
    prompt: "Q",
    options: [
      { id: "a", text: "zero" },
      { id: "b", text: "g" },
    ],
  },
  answer: { correct_option_id: "a", feedback: { a: "Right: it changes sign.", b: "g is an acceleration." } },
  verification: { type: "mcq" },
};
const numeric = {
  type: "numeric",
  stem: { prompt: "Range?", unit: "m" },
  answer: { expected: 34.64, answer_expr: "400*sin(pi/3)/10", why: "R = u² sin 2θ / g" },
  verification: { type: "numeric", stated: 34.64, tolerance: null },
};

describe("gradeAttempt", () => {
  it("marks multiple choice by option id and returns that option's explanation", () => {
    expect(gradeAttempt(mcq, { option_id: "a" })).toMatchObject({ correct: true, why: "Right: it changes sign." });
    expect(gradeAttempt(mcq, { option_id: "b" })).toMatchObject({
      correct: false,
      why: "g is an acceleration.",
      answer: "zero",
    });
  });

  it("marks numbers with the engine's tolerance, accepting a comma decimal", () => {
    expect(gradeAttempt(numeric, { value: "34.64" }).correct).toBe(true);
    expect(gradeAttempt(numeric, { value: "34,64" }).correct).toBe(true);
    expect(gradeAttempt(numeric, { value: 34.6 }).correct).toBe(false);
    expect(gradeAttempt(numeric, { value: "about 35" }).correct).toBe(false);
    expect(gradeAttempt(numeric, { value: "35" }).answer).toBe("34.64 m");
  });

  it("never trusts the shape of the answer: the wrong kind of response is wrong", () => {
    expect(gradeAttempt(mcq, { value: 1 }).correct).toBe(false);
    expect(gradeAttempt(numeric, { option_id: "a" }).correct).toBe(false);
  });

  it("marks expressions by equivalence, and unsafe input as wrong", () => {
    const item = {
      type: "expression",
      stem: {},
      answer: { answer_expr: "2*x", vars: ["x"], why: "d/dx x² = 2x" },
      verification: {},
    };
    expect(gradeAttempt(item, { expr: "x + x" }).correct).toBe(true);
    expect(gradeAttempt(item, { expr: "x^2" }).correct).toBe(false);
    expect(gradeAttempt(item, { expr: "import('fs')" }).correct).toBe(false);
  });

  it("marks order and match exactly", () => {
    const order = {
      type: "order",
      stem: {},
      answer: { order: ["Offer", "Acceptance", "Consideration"] },
      verification: {},
    };
    expect(gradeAttempt(order, { order: ["Offer", "Acceptance", "Consideration"] }).correct).toBe(true);
    expect(gradeAttempt(order, { order: ["Acceptance", "Offer", "Consideration"] }).correct).toBe(false);
    const match = {
      type: "match",
      stem: {},
      answer: {
        pairs: [
          ["F", "ma"],
          ["p", "mv"],
        ],
      },
      verification: {},
    };
    expect(
      gradeAttempt(match, {
        pairs: [
          ["p", "mv"],
          ["F", "ma"],
        ],
      }).correct,
    ).toBe(true);
    expect(
      gradeAttempt(match, {
        pairs: [
          ["p", "ma"],
          ["F", "mv"],
        ],
      }).correct,
    ).toBe(false);
  });

  it("never counts what the engine can't mark", () => {
    expect(
      gradeAttempt({ type: "short_text", stem: {}, answer: {}, verification: {} }, { expr: "anything" }).correct,
    ).toBe(false);
  });
});

describe("self-marks (MVP-04)", () => {
  const past = { type: "short_text", origin: "past_paper", stem: {}, answer: {}, verification: {} };
  it("count on past-paper questions: Got it and Partly are right, Partly at half weight", () => {
    expect(gradeAttempt(past, { self: "got" })).toMatchObject({ correct: true, weight: 1 });
    expect(gradeAttempt(past, { self: "partly" })).toMatchObject({ correct: true, weight: 0.5 });
    expect(gradeAttempt(past, { self: "missed" })).toMatchObject({ correct: false, weight: 1 });
  });

  it("never mark an item that has an answer key", () => {
    expect(gradeAttempt(mcq, { self: "got" }).correct).toBe(false);
    expect(gradeAttempt({ ...past, origin: "generated" }, { self: "got" }).correct).toBe(false);
  });
});

describe("parseNumber", () => {
  it("reads what students type", () => {
    expect(parseNumber(" 1e3 ")).toBe(1000);
    expect(parseNumber("-0.5")).toBe(-0.5);
    expect(parseNumber("1/2")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
});
