// AST types and constants for restricted mathematical expressions
// (specifications/05-lesson-and-lab-engine.md §6).

export const ALLOWED_FUNCTIONS = [
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sinh",
  "cosh",
  "tanh",
  "exp",
  "log",
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "min",
  "max",
] as const;

export type AllowedFunction = (typeof ALLOWED_FUNCTIONS)[number];

export const ALLOWED_CONSTANTS = ["pi", "e"] as const;
export type AllowedConstant = (typeof ALLOWED_CONSTANTS)[number];

export const MAX_EXPR_LENGTH = 500;
export const MAX_EXPR_DEPTH = 40;

export type ExprAst =
  | { type: "num"; value: number }
  | { type: "var"; name: string }
  | { type: "unary"; op: "+" | "-"; arg: ExprAst }
  | { type: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: ExprAst; right: ExprAst }
  | { type: "call"; fn: AllowedFunction; args: ExprAst[] };
