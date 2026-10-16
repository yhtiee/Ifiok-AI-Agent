import { evaluate as mathjsEvaluate } from "mathjs";
import { describe, expect, it } from "vitest";
import { compileExpressionToAst } from "../expr/compile";
import { evaluateAst } from "./index";

describe("Lightweight AST Interpreter vs mathjs", () => {
  it("evaluates basic arithmetic and constants identically to mathjs", () => {
    const scope = { x: 2.5, a: 1.2 };
    const exprs = [
      "2 + 3 * 4",
      "x^2 + 2*x + 1",
      "sin(x) + cos(a)",
      "exp(0.5) - log(2)",
      "sqrt(x) * abs(-4.5)",
      "min(x, a) + max(x, 10)",
      "floor(x) + ceil(a)",
      "pi * 2 + e",
      "-x + 5",
      "((x + 1) * (x - 1)) / 2",
    ];

    for (const expr of exprs) {
      const ast = compileExpressionToAst(expr);
      const evalResult = evaluateAst(ast, scope);
      const mathjsResult = Number(mathjsEvaluate(expr, scope));

      expect(evalResult).toBeCloseTo(mathjsResult, 6);
    }
  });

  it("matches mathjs across 500 randomly generated valid expressions", () => {
    const leafGenerators = [
      () => (Math.floor(Math.random() * 20) + 1).toString(), // positive numbers to avoid sqrt/log domain errors
      () => "x",
      () => "y",
      () => "pi",
      () => "e",
    ];

    const binaryOps = ["+", "-", "*", "/"];
    const unaryFuncs = ["sin", "cos", "exp", "abs", "floor", "ceil", "sqrt", "log"];

    function generateRandomExpr(depth: number): string {
      if (depth <= 1 || Math.random() < 0.3) {
        return leafGenerators[Math.floor(Math.random() * leafGenerators.length)]!();
      }

      const roll = Math.random();
      if (roll < 0.6) {
        const op = binaryOps[Math.floor(Math.random() * binaryOps.length)];
        return `(${generateRandomExpr(depth - 1)} ${op} ${generateRandomExpr(depth - 1)})`;
      } else {
        const fn = unaryFuncs[Math.floor(Math.random() * unaryFuncs.length)];
        // For sqrt and log, wrap in abs() + 1 to keep domain strictly positive
        if (fn === "sqrt" || fn === "log") {
          return `${fn}(abs(${generateRandomExpr(depth - 1)}) + 1)`;
        }
        return `${fn}(${generateRandomExpr(depth - 1)})`;
      }
    }

    const testScope = { x: 2.4, y: 1.8 };
    let testedCount = 0;

    for (let i = 0; i < 500; i++) {
      const expr = generateRandomExpr(4);
      let ast;
      try {
        ast = compileExpressionToAst(expr);
      } catch {
        continue;
      }

      const ourVal = evaluateAst(ast, testScope);
      const mathVal = Number(mathjsEvaluate(expr, testScope));

      if (Number.isFinite(ourVal) && Number.isFinite(mathVal)) {
        expect(ourVal, `Mismatch on expr: ${expr}`).toBeCloseTo(mathVal, 4);
        testedCount++;
      } else if (!Number.isFinite(ourVal)) {
        expect(Number.isFinite(mathVal), `Both should be non-finite for expr: ${expr}`).toBe(false);
        testedCount++;
      }
    }

    expect(testedCount).toBeGreaterThanOrEqual(450);
  });
});
