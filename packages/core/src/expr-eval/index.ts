import type { ExprAst } from "../expr/types";

// Lightweight (~3 KB) client-side AST evaluator (specifications/05-lesson-and-lab-engine.md §3, §6).
// Runs in browser without loading mathjs.

export class EvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationError";
  }
}

/**
 * Evaluates a vetted ExprAst against a variable scope (e.g. { x: 2, a: 1.5 }).
 * Returns the numerical result or throws EvaluationError.
 */
export function evaluateAst(ast: ExprAst, scope: Record<string, number> = {}): number {
  switch (ast.type) {
    case "num":
      return ast.value;

    case "var": {
      if (ast.name === "pi") return Math.PI;
      if (ast.name === "e") return Math.E;
      if (Object.prototype.hasOwnProperty.call(scope, ast.name)) {
        const val = scope[ast.name];
        if (typeof val === "number") return val;
      }
      throw new EvaluationError(`Undefined variable '${ast.name}' in scope`);
    }

    case "unary": {
      const argVal = evaluateAst(ast.arg, scope);
      return ast.op === "-" ? -argVal : +argVal;
    }

    case "binary": {
      const leftVal = evaluateAst(ast.left, scope);
      const rightVal = evaluateAst(ast.right, scope);
      switch (ast.op) {
        case "+":
          return leftVal + rightVal;
        case "-":
          return leftVal - rightVal;
        case "*":
          return leftVal * rightVal;
        case "/":
          return leftVal / rightVal;
        case "^":
          return Math.pow(leftVal, rightVal);
      }
      break;
    }

    case "call": {
      const args = ast.args.map((arg) => evaluateAst(arg, scope));
      switch (ast.fn) {
        case "sin":
          return Math.sin(args[0]!);
        case "cos":
          return Math.cos(args[0]!);
        case "tan":
          return Math.tan(args[0]!);
        case "asin":
          return Math.asin(args[0]!);
        case "acos":
          return Math.acos(args[0]!);
        case "atan":
          return Math.atan(args[0]!);
        case "sinh":
          return Math.sinh(args[0]!);
        case "cosh":
          return Math.cosh(args[0]!);
        case "tanh":
          return Math.tanh(args[0]!);
        case "exp":
          return Math.exp(args[0]!);
        case "log":
          return Math.log(args[0]!);
        case "sqrt":
          return Math.sqrt(args[0]!);
        case "abs":
          return Math.abs(args[0]!);
        case "floor": {
          const v = args[0]!;
          const rounded = Math.round(v);
          return Math.floor(Math.abs(v - rounded) < 1e-12 ? rounded : v);
        }
        case "ceil": {
          const v = args[0]!;
          const rounded = Math.round(v);
          return Math.ceil(Math.abs(v - rounded) < 1e-12 ? rounded : v);
        }
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
      }
    }
  }

  throw new EvaluationError(`Unknown AST node: ${JSON.stringify(ast)}`);
}
