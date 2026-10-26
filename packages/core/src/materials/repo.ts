import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db/types";
import { toVector } from "./embed-client";

// Database side of the embed job (service role). Chunks are written by POST /api/materials; the
// job only fills their embeddings.

export type PendingChunk = { id: number; content: string };

export type SourceInfo = { ownerId: string; courseId: string | null; conceptId: string | null };

export interface MaterialsRepo {
  /** The source's owner and where it is filed, or null when it no longer exists (deleted while queued). */
  sourceInfo(sourceId: string): Promise<SourceInfo | null>;
  /** Chunks of the source still without an embedding, oldest first. */
  pendingChunks(sourceId: string, limit: number): Promise<PendingChunk[]>;
  setEmbeddings(sourceId: string, ids: number[], embeddings: number[][]): Promise<number>;
}

export function createSupabaseMaterialsRepo(db: SupabaseClient<Database>): MaterialsRepo {
  return {
    async sourceInfo(sourceId) {
      const { data, error } = await db
        .from("sources")
        .select("owner_id, course_id, concept_id")
        .eq("id", sourceId)
        .maybeSingle();
      if (error) throw new Error("Couldn't load the source");
      return data ? { ownerId: data.owner_id, courseId: data.course_id, conceptId: data.concept_id } : null;
    },

    async pendingChunks(sourceId, limit) {
      const { data, error } = await db
        .from("chunks")
        .select("id, content")
        .eq("source_id", sourceId)
        .is("embedding", null)
        .order("id")
        .limit(limit);
      if (error) throw new Error("Couldn't load chunks");
      return data ?? [];
    },

    async setEmbeddings(sourceId, ids, embeddings) {
      const { data, error } = await db.rpc("set_chunk_embeddings", {
        p_source: sourceId,
        p_ids: ids,
        p_embeddings: embeddings.map(toVector),
      });
      if (error) throw new Error("Couldn't save embeddings");
      return data ?? 0;
    },
  };
}
