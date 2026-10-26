import "server-only";
import { createEmbedder, toVector, EmbeddingError } from "@ifiok/core/materials/embed-client";
import { publicEnv } from "@/lib/env";
import { requireServerEnv } from "@/lib/env/server";

// Embeddings with gte-small (384-d) from the `embed` Edge Function (02 §1). The client lives in
// packages/core so the worker's embed job uses the same one.

export { EmbeddingError, toVector };

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const embed = createEmbedder({
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    secret: requireServerEnv("INTERNAL_FUNCTION_SECRET"),
    // Outline topics ("title. description") and queries: 8 per call stays well inside the embed
    // function's CPU limit even on a cold start; a refused call is retried twice.
    batch: 8,
    retries: 2,
  });
  return embed(texts);
}
