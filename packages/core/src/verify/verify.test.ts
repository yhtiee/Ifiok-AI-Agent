import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDerivative, checkAntiderivative, checkDefiniteIntegral } from "./calculus";
import { equivalent } from "./equivalent";
import { renderKatex } from "./katex";
import { checkPlotFunction } from "./plot";
import { checkQuote } from "./quote";
import { checkStep } from "./steps";
import { mathEvaluate, mathDerivative, mathSimplify } from "./tools";
import { verifyLesson } from "./lesson";

describe("Maths Verifier (P0-08 Acceptance Criteria)", () => {
  it("verifies the 6 acceptance checks specified in P0-08", () => {
    // 1. 2x + h → 2x + 2h is wrong
    expect(checkStep("2*x + h", "2*x + 2*h", ["x", "h"])).toBe("wrong");

    // 2. x = 2 → x² = 4 is ok (implication: root 2 preserved)
    expect(checkStep("x = 2", "x^2 = 4", ["x"])).toBe("ok");

    // 3. x² = 4 → x = 2 is wrong (root lost: -2 is missing)
    expect(checkStep("x^2 = 4", "x = 2", ["x"])).toBe("wrong");

    // 4. x² = 4 → x = 2 or x = -2 is ok
    expect(checkStep("x^2 = 4", "x = 2 or x = -2", ["x"])).toBe("ok");

    // 5. let u = x² is unchecked
    expect(checkStep("x^2 = 4", "let u = x^2")).toBe("unchecked");

    // 6. sqrt(x) equivalence is true, not unknown (via the (0, 5] retry rule)
    expect(equivalent("sqrt(x)", "x^(1/2)", ["x"])).toBe(true);
  });

  describe("Calculus Verifier", () => {
    it("checks derivatives", () => {
      expect(checkDerivative("x^3", "3*x^2")).toBe(true);
      expect(checkDerivative("sin(x)", "cos(x)")).toBe(true);
      expect(checkDerivative("x^2", "5*x")).toBe(false);
    });

    it("checks antiderivatives", () => {
      expect(checkAntiderivative("x^3 / 3", "x^2")).toBe(true);
      expect(checkAntiderivative("sin(x)", "cos(x)")).toBe(true);
      expect(checkAntiderivative("x^2", "3*x")).toBe(false);
    });

    it("checks definite integrals using composite Simpson's rule", () => {
      // integral from 0 to 3 of x^2 is [x^3/3]_0^3 = 9
      expect(checkDefiniteIntegral("x^2", 0, 3, 9)).toBe(true);
      // integral from 0 to pi of sin(x) is [-cos(x)]_0^pi = 1 - (-1) = 2
      expect(checkDefiniteIntegral("sin(x)", 0, Math.PI, 2)).toBe(true);
      expect(checkDefiniteIntegral("x^2", 0, 3, 15)).toBe(false);
    });
  });

  describe("Plot & Quote Verifiers", () => {
    it("checks plot finiteness", () => {
      expect(checkPlotFunction("x^2", [-3, 3]).valid).toBe(true);
      expect(checkPlotFunction("1/x", [-3, 3]).valid).toBe(true); // finite at >= 50%
      expect(checkPlotFunction("sqrt(x)", [0, 4]).valid).toBe(true);
    });

    it("checks source quote substrings", () => {
      const chunk = "The derivative represents the instantaneous rate of change of a function.";
      expect(checkQuote("instantaneous rate of change", chunk)).toBe(true);
      expect(checkQuote("  Instantaneous   Rate OF change  ", chunk)).toBe(true);
      expect(checkQuote("unrelated statement not in text", chunk)).toBe(false);
    });
  });

  describe("KaTeX Pre-renderer & Tutor Math Tools", () => {
    it("pre-renders KaTeX to HTML", () => {
      const res = renderKatex("\\frac{1}{2}");
      expect(res.ok).toBe(true);
      expect(res.html).toContain("katex");
    });

    it("evaluates math expressions securely", () => {
      expect(mathEvaluate("2 * 1.5")).toBe(3);
      expect(mathEvaluate("sin(pi / 2)")).toBeCloseTo(1, 6);
      expect(mathDerivative("x^2", "x")).toBe("2 * x");
      expect(mathSimplify("2 * x + 3 * x", "x")).toBe("5 * x");
    });
  });

  describe("Master verifyLesson", () => {
    it("verifies the 6-screen slope fixture cleanly and enriches with html and compiled ASTs", () => {
      const fixturePath = join(process.cwd(), "content", "fixtures", "slope-of-a-curve.json");
      const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));

      const res = verifyLesson(raw);
      expect(res.ok).toBe(true);
      expect(res.errors).toHaveLength(0);

      // Check KaTeX was rendered to html
      const screen1 = res.verifiedSpec.screens[0]!;
      const plotBlock = screen1.blocks.find((b) => b.type === "plot");
      expect(plotBlock).toBeDefined();
      if (plotBlock && plotBlock.type === "plot") {
        expect(plotBlock.compiled).toBeDefined();
        expect(plotBlock.compiled?.functions).toHaveLength(1);
      }
    });

    it("catches wrong numeric checkpoint stated value", () => {
      const fixturePath = join(process.cwd(), "content", "fixtures", "slope-of-a-curve.json");
      const raw = JSON.parse(readFileSync(fixturePath, "utf-8"));

      // Alter checkpoint stated answer to be wrong
      raw.screens[2].blocks[0].item.stated = 999;
      const res = verifyLesson(raw);
      expect(res.ok).toBe(false);
      expect(res.errors.some((e: string) => e.includes("numeric checkpoint self-consistency error"))).toBe(true);
    });
  });
});

describe("stripMathDelimiters", () => {
  it("removes one outer pair of math delimiters a model added", async () => {
    const { stripMathDelimiters } = await import("./lesson");
    expect(stripMathDelimiters(String.raw`\(x^2 - 5x + 6 = 0\)`)).toBe("x^2 - 5x + 6 = 0");
    expect(stripMathDelimiters(String.raw`\[ \frac{1}{x} \]`)).toBe(String.raw`\frac{1}{x}`);
    expect(stripMathDelimiters("$$a+b$$")).toBe("a+b");
    expect(stripMathDelimiters("$a+b$")).toBe("a+b");
    expect(stripMathDelimiters(String.raw`f(x) = \left(x\right)`)).toBe(String.raw`f(x) = \left(x\right)`);
    expect(stripMathDelimiters(String.raw`\{1,2\}`)).toBe(String.raw`\{1,2\}`);
  });

  it("lets a wrapped math block verify instead of failing KaTeX", () => {
    const spec = JSON.parse(readFileSync(join(process.cwd(), "content/fixtures/slope-of-a-curve.json"), "utf-8"));
    spec.screens[0].blocks[0] = { id: "s1b1", type: "math", latex: String.raw`\(x^2 - 5x + 6 = 0\)`, display: true };
    const r = verifyLesson(spec);
    expect(r.ok).toBe(true);
    expect(r.verifiedSpec.screens[0]!.blocks[0]).toMatchObject({ latex: "x^2 - 5x + 6 = 0" });
  });
});
