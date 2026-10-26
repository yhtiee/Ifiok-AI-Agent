import "server-only";
import { GatewayError } from "@ifiok/core/ai/gateway";
import { EmbeddingError } from "@ifiok/core/materials/embed-client";
import { RouteError } from "./route";

// Step-by-step server logs for multi-step requests (e.g. saving an outline), so a failure says
// exactly which step broke and why. Metadata only: step names, timings, counts, error codes and
// statuses; never prompts, topic names or other student content (guardrail 10). In development
// every step is logged; in production only failures are.

type Meta = Record<string, string | number | boolean | null | undefined>;

const verbose = process.env.NODE_ENV !== "production";

/** What went wrong, without content: our own errors carry fixed messages and codes. */
export function describeError(err: unknown): Meta {
  if (err instanceof RouteError) return { error: "RouteError", status: err.status, code: err.code };
  if (err instanceof GatewayError) return { error: "GatewayError", status: err.status, code: err.code };
  if (err instanceof EmbeddingError) return { error: "EmbeddingError", status: err.status, detail: err.message };
  if (err instanceof Error) return { error: err.name, detail: err.message.slice(0, 160) };
  return { error: typeof err };
}

export type Trace = {
  /** Runs one step: logs its duration (dev) or its failure (always), then returns or rethrows. */
  step<T>(name: string, fn: () => Promise<T>, meta?: Meta): Promise<T>;
  /** A note between steps (dev only), e.g. counts. */
  note(name: string, meta: Meta): void;
  /** Total time at the end (dev only). */
  done(meta?: Meta): void;
};

export function startTrace(operation: string, context: Meta = {}): Trace {
  const started = Date.now();
  const emit = (level: "info" | "error", data: Meta) =>
    console[level](`[${operation}]`, JSON.stringify({ ...context, ...data }));

  return {
    async step(name, fn, meta) {
      const t0 = Date.now();
      try {
        const result = await fn();
        if (verbose) emit("info", { step: name, ok: true, ms: Date.now() - t0, ...meta });
        return result;
      } catch (err) {
        emit("error", { step: name, ok: false, ms: Date.now() - t0, ...meta, ...describeError(err) });
        throw err;
      }
    },
    note(name, meta) {
      if (verbose) emit("info", { step: name, ...meta });
    },
    done(meta) {
      if (verbose) emit("info", { step: "done", ms: Date.now() - started, ...meta });
    },
  };
}

/** A no-op trace for callers that don't trace. */
export const NO_TRACE: Trace = {
  step: (_name, fn) => fn(),
  note: () => {},
  done: () => {},
};
