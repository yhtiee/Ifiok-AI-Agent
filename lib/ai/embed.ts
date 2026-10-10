import "server-only";
import { publicEnv } from "@/lib/env";
import { requireServerEnv } from "@/lib/env/server";

// Embeddings with gte-small (384-d) from the `embed` Edge Function (02 §1). Never mix embedding
// models: switching means re-embedding every concept and chunk.

const BATCH = 16;

export class EmbeddingError extends Error {}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const secret = requireServerEnv("INTERNAL_FUNCTION_SECRET");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-ifiok-secret": secret },
        body: JSON.stringify({ texts: batch }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new EmbeddingError("The embedding service is unreachable.");
    }
    const json = (await res.json().catch(() => ({}))) as { embeddings?: number[][] };
    if (!res.ok || !json.embeddings || json.embeddings.length !== batch.length) {
      throw new EmbeddingError(`Embedding failed (${res.status}).`);
    }
    out.push(...json.embeddings);
  }
  return out;
}

/** pgvector's text form, for RPC arguments. */
export function toVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
