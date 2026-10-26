import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedTexts, EmbeddingError, toVector } from "./embed";

// Retrieval (03 §9, 04 §6, guardrail 7). The only caller of match_chunks in the app: the user id
// always comes from the signed-in viewer, never from a request. ESLint bans match_chunks anywhere
// else, and bans request-shaped names in this file (eslint.config.mjs).

export type RetrievalScope = { courseId: string; conceptId?: null } | { conceptId: string; courseId?: null };

export type RetrievedChunk = { id: number; sourceId: string; page: number | null; content: string; score: number };

/** The retrieval RPC's optional uuid arguments: the generated types don't mark them nullable. */
const optionalId = (id: string | null | undefined) => (id ?? null) as unknown as string;

export async function retrieveChunks(
  viewer: Viewer,
  scope: RetrievalScope,
  query: string,
  limit = 6,
): Promise<RetrievedChunk[]> {
  let embedding: string | null = null;
  try {
    const [vector] = await embedTexts([query]);
    embedding = vector ? toVector(vector) : null;
  } catch (err) {
    // Keyword search still works without the vector half of the hybrid ranking.
    if (!(err instanceof EmbeddingError)) throw err;
  }

  const { data, error } = await createAdminClient().rpc("match_chunks", {
    p_user: viewer.userId,
    p_course: optionalId(scope.courseId),
    p_concept: optionalId(scope.conceptId),
    p_query: query,
    p_embedding: embedding as unknown as string,
    p_limit: limit,
  });
  if (error) throw new Error("Retrieval failed");
  return (data ?? []).map((r) => ({
    id: r.id,
    sourceId: r.source_id,
    page: r.page,
    content: r.content,
    score: r.score,
  }));
}
