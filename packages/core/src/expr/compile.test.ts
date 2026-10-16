import { describe, expect, it } from "vitest";
import { compileExpressionToAst, normalizeExpressionString } from "./compile";
import { ExprSecurityError } from "./walk";

describe("Expression Compilation & Security Walk", () => {
  it("normalizes ln to log", () => {
    expect(normalizeExpressionString("ln(x)")).toBe("log(x)");
    expect(normalizeExpressionString("2 * ln(x + 1)")).toBe("2 * log(x + 1)");
    expect(normalizeExpressionString("alnum")).toBe("alnum"); // does not rewrite substrings
  });

  it("compiles valid arithmetic and functions", () => {
    const ast = compileExpressionToAst("sin(x) + 2 * x^2 - log(x + 1)");
    expect(ast.type).toBe("binary");
  });

  it("rejects expressions exceeding length limit", () => {
    const longExpr = "x + ".repeat(200) + "1";
    expect(() => compileExpressionToAst(longExpr)).toThrow(ExprSecurityError);
  });

  it("rejects expressions exceeding depth limit (40)", () => {
    let deepExpr = "x";
    for (let i = 0; i < 45; i++) {
      deepExpr = `sin(${deepExpr})`;
    }
    expect(() => compileExpressionToAst(deepExpr)).toThrow(ExprSecurityError);
  });

  it("rejects forbidden constructs: assignments, imports, unknown functions", () => {
    expect(() => compileExpressionToAst("x = 2")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("f(x) = x^2")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("import('fs')")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("eval('2+2')")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("[1, 2, 3]")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("{ a: 1 }")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("alert(1)")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("customFunction(x)")).toThrow(ExprSecurityError);
  });

  it("rejects disallowed operators like bitwise, comparison, assignment", () => {
    expect(() => compileExpressionToAst("x & y")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("x | y")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("x == y")).toThrow(ExprSecurityError);
    expect(() => compileExpressionToAst("x < y")).toThrow(ExprSecurityError);
  });

  it("allows declared variables and units", () => {
    const ast = compileExpressionToAst("2 * R + 5 * mA", ["R"], ["mA"]);
    expect(ast).toBeDefined();
  });
});
