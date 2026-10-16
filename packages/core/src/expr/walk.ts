import { MathNode } from "mathjs";
import { ALLOWED_CONSTANTS, ALLOWED_FUNCTIONS, MAX_EXPR_DEPTH } from "./types";

export class ExprSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExprSecurityError";
  }
}

export interface ConstantMathNode extends MathNode {
  type: "ConstantNode";
  value: unknown;
}

export interface SymbolMathNode extends MathNode {
  type: "SymbolNode";
  name: string;
}

export interface OperatorMathNode extends MathNode {
  type: "OperatorNode";
  op: string;
  args: MathNode[];
}

export interface ParenthesisMathNode extends MathNode {
  type: "ParenthesisNode";
  content: MathNode;
}

export interface FunctionMathNode extends MathNode {
  type: "FunctionNode";
  name: string;
  args: MathNode[];
}

export function isConstantNode(node: MathNode): node is ConstantMathNode {
  return node.type === "ConstantNode";
}

export function isSymbolNode(node: MathNode): node is SymbolMathNode {
  return node.type === "SymbolNode";
}

export function isOperatorNode(node: MathNode): node is OperatorMathNode {
  return node.type === "OperatorNode";
}

export function isParenthesisNode(node: MathNode): node is ParenthesisMathNode {
  return node.type === "ParenthesisNode";
}

export function isFunctionNode(node: MathNode): node is FunctionMathNode {
  return node.type === "FunctionNode";
}

const VARIABLE_REGEX = /^[a-zA-Z](_[0-9a-z]+)?$/;

/**
 * Traverses a mathjs AST node to verify it strictly adheres to the whitelist:
 * - Allowed nodes: ConstantNode, SymbolNode, OperatorNode (+ - * / ^), ParenthesisNode, FunctionNode (whitelist)
 * - Depth capped at MAX_EXPR_DEPTH (40)
 * - Throws ExprSecurityError if forbidden construct or depth exceeded.
 */
export function walkAndValidateNode(
  node: MathNode,
  depth = 1,
  allowedVars?: Set<string>,
  allowedUnits?: Set<string>,
): number {
  if (depth > MAX_EXPR_DEPTH) {
    throw new ExprSecurityError(`Expression exceeds maximum AST depth limit of ${MAX_EXPR_DEPTH}`);
  }

  let maxChildDepth = depth;

  if (isConstantNode(node)) {
    const val = node.value;
    if (typeof val !== "number" || !Number.isFinite(val)) {
      throw new ExprSecurityError(`Only finite numeric constants are allowed in expressions, got: ${val}`);
    }
  } else if (isSymbolNode(node)) {
    const name = node.name;
    const isConstant = (ALLOWED_CONSTANTS as readonly string[]).includes(name);
    const isAllowedVar = allowedVars ? allowedVars.has(name) : VARIABLE_REGEX.test(name);
    const isAllowedUnit = allowedUnits?.has(name) ?? false;

    if (!isConstant && !isAllowedVar && !isAllowedUnit) {
      throw new ExprSecurityError(`Disallowed symbol '${name}' in expression`);
    }
  } else if (isOperatorNode(node)) {
    const op = node.op;
    if (!["+", "-", "*", "/", "^"].includes(op)) {
      throw new ExprSecurityError(`Disallowed operator '${op}' in expression`);
    }
    // Operator must be unary or binary
    if (node.args.length !== 1 && node.args.length !== 2) {
      throw new ExprSecurityError(`Operator '${op}' has invalid number of arguments: ${node.args.length}`);
    }
    for (const child of node.args) {
      const d = walkAndValidateNode(child, depth + 1, allowedVars, allowedUnits);
      if (d > maxChildDepth) maxChildDepth = d;
    }
  } else if (isParenthesisNode(node)) {
    const d = walkAndValidateNode(node.content, depth + 1, allowedVars, allowedUnits);
    if (d > maxChildDepth) maxChildDepth = d;
  } else if (isFunctionNode(node)) {
    const name = node.name;
    if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(name)) {
      throw new ExprSecurityError(`Disallowed function '${name}' in expression`);
    }
    for (const child of node.args) {
      const d = walkAndValidateNode(child, depth + 1, allowedVars, allowedUnits);
      if (d > maxChildDepth) maxChildDepth = d;
    }
  } else {
    throw new ExprSecurityError(`Disallowed AST node type '${node.type}' in expression`);
  }

  return maxChildDepth;
}
