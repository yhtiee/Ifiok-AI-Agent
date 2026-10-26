// Client for the `embed` Edge Function (gte-small, 384-d, 02 §1), shared by Next and the worker.
// Never mix embedding models: switching means re-embedding every concept and chunk.
//
// The function has ~2 s of CPU per call; a big batch, long texts or a cold start (loading the model)
// can exceed it and the call fails (WORKER_RESOURCE_LIMIT, status 546). So callers pick a batch size
// for their text length, and each failed call is retried once after a short pause.

export const EMBED_BATCH = 16;

export class EmbeddingError extends Error {
  constructor(
    message: string,
    /** HTTP status from the embed function, or 0 when it was unreachable. */
    readonly status = 0,
  ) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export type Embedder = (texts: string[]) => Promise<number[][]>;

export function createEmbedder(opts: {
  supabaseUrl: string;
  secret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Texts per call (default 16; use fewer for long texts). */
  batch?: number;
  /** Extra attempts per call after a failure (default 1). */
  retries?: number;
  retryDelayMs?: number;
}): Embedder {
  const doFetch = opts.fetch ?? fetch;
  const batchSize = opts.batch ?? EMBED_BATCH;
  const retries = opts.retries ?? 1;

  const call = async (batch: string[]): Promise<number[][]> => {
    let res: Response;
    try {
      res = await doFetch(`${opts.supabaseUrl}/functions/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ifiok-secret": opts.secret },
        body: JSON.stringify({ texts: batch }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      });
    } catch {
      throw new EmbeddingError("The embedding service is unreachable.");
    }
    const json = (await res.json().catch(() => ({}))) as { embeddings?: number[][]; code?: string };
    if (!res.ok || !json.embeddings || json.embeddings.length !== batch.length) {
      throw new EmbeddingError(`Embedding failed (${res.status}${json.code ? ` ${json.code}` : ""}).`, res.status);
    }
    return json.embeddings;
  };

  return async (texts) => {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      for (let attempt = 0; ; attempt++) {
        try {
          out.push(...(await call(batch)));
          break;
        } catch (err) {
          if (attempt >= retries) throw err;
          await new Promise((r) => setTimeout(r, opts.retryDelayMs ?? 400));
        }
      }
    }
    return out;
  };
}

/** pgvector's text form, for RPC arguments. */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
