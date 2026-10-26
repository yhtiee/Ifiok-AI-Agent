import { z } from "zod";
import type { Json } from "../db/types";
import { EmbeddingError, type Embedder } from "../materials/embed-client";
import type { MaterialsRepo, SourceInfo } from "../materials/repo";
import { JobFailure, type JobHandler } from "./types";

// embed (10 MVP-01, 02 §4): fills the embeddings of one source's chunks through the `embed`
// function. Full-size chunks cost far more CPU than short texts: measured on the hosted project
// (23 Oct 2026), 6 or more ~260-word chunks per call can exceed the function's ~2 s CPU limit
// (WORKER_RESOURCE_LIMIT), while 4 take 1.5–2 s. So each call gets 4 chunks, and 3 calls run in
// parallel (each is its own invocation with its own CPU budget). Each round is saved as it lands,
// so a crash or a retry only redoes the round in flight. Work stops after a time budget and the job
// defers itself to carry on, which keeps one run inside the worker's deadline.

export const embedPayload = z.object({ source_id: z.string().uuid() });

/** Chunks per call to the `embed` function. */
export const CHUNK_EMBED_BATCH = 4;
/** Calls in flight at once. */
export const EMBED_PARALLEL = 3;
/** Time one run may spend before deferring (the light-queue loop stops 10 s before the deadline). */
export const EMBED_RUN_BUDGET_MS = 25_000;

const MSG = {
  failed: "Ifiok couldn't finish reading these materials. Delete them and add them again.",
} as const;

export type EmbedDeps = {
  repo: MaterialsRepo;
  embed: Embedder;
  /** Runs once the source is fully embedded (MVP-02: queue private lessons for covered topics). Never fails the job. */
  onReady?: (source: SourceInfo) => Promise<unknown>;
  now?: () => number;
  budgetMs?: number;
};

export function createEmbedHandler(deps: EmbedDeps): JobHandler {
  const now = deps.now ?? Date.now;
  const budget = deps.budgetMs ?? EMBED_RUN_BUDGET_MS;

  /** One call, retried once: a call that hits the CPU limit usually fits on a second try. */
  const embedBatch = async (texts: string[]) => {
    try {
      return await deps.embed(texts);
    } catch {
      return await deps.embed(texts);
    }
  };

  return {
    async run(job) {
      const parsed = embedPayload.safeParse(job.payload);
      if (!parsed.success) throw new JobFailure("bad_payload", MSG.failed, false);
      const sourceId = parsed.data.source_id;

      const source = await deps.repo.sourceInfo(sourceId);
      // Deleted while queued: nothing left to do.
      if (!source) return { kind: "done", result: { embedded: 0, skipped: "source_deleted" } satisfies Json };
      // Guardrail 7: the source must belong to the job's owner.
      if (job.ownerId && source.ownerId !== job.ownerId) {
        throw new JobFailure("payload_owner_mismatch", MSG.failed, false);
      }

      const started = now();
      let embedded = 0;
      for (;;) {
        const pending = await deps.repo.pendingChunks(sourceId, CHUNK_EMBED_BATCH * EMBED_PARALLEL);
        if (pending.length === 0) {
          const followUp = deps.onReady
            ? await deps.onReady(source).then(
                () => "queued",
                () => "failed",
              )
            : null;
          return { kind: "done", result: { embedded, ...(followUp ? { lessons: followUp } : {}) } satisfies Json };
        }
        if (now() - started >= budget) {
          return { kind: "defer", seconds: 1, result: { embedded, remaining: true } satisfies Json };
        }
        const groups: (typeof pending)[] = [];
        for (let i = 0; i < pending.length; i += CHUNK_EMBED_BATCH)
          groups.push(pending.slice(i, i + CHUNK_EMBED_BATCH));
        let vectors: number[][];
        try {
          vectors = (await Promise.all(groups.map((g) => embedBatch(g.map((c) => c.content))))).flat();
        } catch (err) {
          throw new JobFailure(err instanceof EmbeddingError ? "embedding_failed" : "embed_error", MSG.failed);
        }
        const saved = await deps.repo.setEmbeddings(
          sourceId,
          pending.map((c) => c.id),
          vectors,
        );
        // Nothing saved means the same chunks would come back forever.
        if (saved === 0) throw new JobFailure("embeddings_not_saved", MSG.failed);
        embedded += saved;
      }
    },
  };
}
