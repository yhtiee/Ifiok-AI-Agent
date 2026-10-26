import { z } from "zod";
import { compileExpressionToAst } from "../expr/compile";
import { ALLOWED_CONSTANTS, ALLOWED_FUNCTIONS, type ExprAst } from "../expr/types";

// The virtual experiment configuration (05 §9, 10 MVP-05). The AI fills it in from a lab manual or
// a requested topic (`lab_extract`); the hand-built engine does everything else. It is data only:
// expressions are compiled through the allow-listed mathjs subset (05 §6) and never run as code.

const RESERVED = new Set<string>([...ALLOWED_FUNCTIONS, ...ALLOWED_CONSTANTS, "gradient", "intercept"]);
const symbol = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]{0,11}$/, "a short symbol such as L, T or R")
  .refine((s) => !RESERVED.has(s), "that name is reserved");
const text = (max: number) => z.string().trim().min(1).max(max);
/** A list the model sometimes writes as one string ("a, b; c"): split it rather than decline the lab. */
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(/[;\n]|,(?![^(]*\))/)
            .map((x) => x.trim())
            .filter(Boolean)
        : v,
    z.array(item),
  );

export const NOISE_KINDS = ["gaussian", "reaction_time", "uniform"] as const;

export const experimentConfig = z.object({
  title: text(120),
  aim: text(400),
  apparatus: list(text(120)).pipe(z.array(z.string()).min(1).max(15)),
  independent: z.object({
    symbol,
    label: text(80),
    unit: z.string().trim().max(20),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().finite().positive(),
  }),
  measured: z.object({
    symbol,
    label: text(80),
    unit: z.string().trim().max(20),
    resolution: z.number().finite().positive(),
  }),
  /** The measured quantity in terms of the independent variable and the hidden constants. */
  relation: text(300),
  /** True constants used by the relation; never sent to the browser. */
  hidden: z.record(symbol, z.number().finite()).refine((h) => {
    const n = Object.keys(h).length;
    return n >= 1 && n <= 4;
  }, "1 to 4 hidden constants"),
  noise: z.object({ kind: z.enum(NOISE_KINDS), sd: z.number().finite().min(0) }),
  repeats: z.number().int().min(1).max(5),
  min_readings: z.number().int().min(3).max(12),
  analysis: z.object({
    /** Axes of the straight-line graph, in terms of the independent and measured symbols. */
    x: text(120),
    y: text(120),
    x_label: z.string().trim().max(60).optional(),
    y_label: z.string().trim().max(60).optional(),
    derive: z.object({
      symbol,
      label: text(80),
      from: z.enum(["gradient", "intercept"]),
      /** In terms of `gradient` or `intercept`, e.g. "4*pi^2/gradient". */
      expr: text(120),
      unit: z.string().trim().max(20),
    }),
    accepted: z.number().finite(),
    tolerance_pct: z.number().min(0.5).max(20),
  }),
  precautions: list(text(240)).pipe(z.array(z.string()).max(10)).default([]),
  viva: z
    .array(z.object({ q: text(300), a: text(600) }))
    .max(6)
    .default([]),
  source: z.enum(["manual", "topic"]),
});
export type ExperimentConfig = z.infer<typeof experimentConfig>;

/** Every expression compiled to an allow-listed AST, ready for the engine. */
export type CompiledExperiment = {
  config: ExperimentConfig;
  relation: ExprAst;
  x: ExprAst;
  y: ExprAst;
  derive: ExprAst;
};

export class ExperimentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExperimentConfigError";
  }
}

function compileIn(where: string, expr: string, vars: string[]): ExprAst {
  try {
    return compileExpressionToAst(expr, vars, []);
  } catch (err) {
    throw new ExperimentConfigError(`${where}: ${err instanceof Error ? err.message : "not a valid expression"}`);
  }
}

/** Compiles every expression, allowing only the symbols each one may use. Throws ExperimentConfigError. */
export function compileExperiment(config: ExperimentConfig): CompiledExperiment {
  const iv = config.independent.symbol;
  const mv = config.measured.symbol;
  const hidden = Object.keys(config.hidden);
  if (iv === mv) throw new ExperimentConfigError("the independent and measured variables need different symbols");
  if (hidden.includes(iv) || hidden.includes(mv))
    throw new ExperimentConfigError("a hidden constant can't share a symbol with a variable");
  if (!hidden.includes(config.analysis.derive.symbol))
    throw new ExperimentConfigError("the derived quantity must be one of the hidden constants");
  return {
    config,
    relation: compileIn("relation", config.relation, [iv, ...hidden]),
    x: compileIn("analysis.x", config.analysis.x, [iv, mv]),
    y: compileIn("analysis.y", config.analysis.y, [iv, mv]),
    derive: compileIn("analysis.derive.expr", config.analysis.derive.expr, [config.analysis.derive.from]),
  };
}

/**
 * What the browser gets: no relation, hidden constants or accepted value, so the true answer
 * can't be read from the page before the student's analysis (the server reveals it on compare).
 */
export type PublicExperiment = Omit<ExperimentConfig, "relation" | "hidden" | "analysis" | "noise"> & {
  noise: { kind: ExperimentConfig["noise"]["kind"] };
  analysis: Omit<ExperimentConfig["analysis"], "accepted"> & { xAst: ExprAst; yAst: ExprAst; deriveAst: ExprAst };
};

export function publicExperiment(c: CompiledExperiment): PublicExperiment {
  const { relation: _relation, hidden: _hidden, noise, analysis, ...rest } = c.config;
  const { accepted: _accepted, ...publicAnalysis } = analysis;
  return {
    ...rest,
    noise: { kind: noise.kind },
    analysis: { ...publicAnalysis, xAst: c.x, yAst: c.y, deriveAst: c.derive },
  };
}
