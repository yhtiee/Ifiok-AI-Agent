import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GatewayError, type Gateway } from "../ai/gateway";
import { redactPersonalData } from "../ai/redact";
import type { OcrPagesOutput } from "../ai/skills/ocr";
import type { ImageInput } from "../ai/types";
import type { Database } from "../db/types";
import { chunkPages } from "../materials/chunk";
import { MATERIALS_BUCKET, MAX_OCR_PAGES } from "../materials/kinds";
import { secondsUntilLagosMidnight } from "./lesson-gen";
import { JobFailure, type JobHandler } from "./types";

// ocr (12 §4 Q60): a stored photo, or the scanned pages of a stored PDF (rendered to images on the
// phone at upload), read with ocr_pages; the text is stripped of personal details, chunked into
// the student's private material and indexed by the embed job. One page per call, so the daily
// allowance counts pages; a used-up allowance waits for tomorrow instead of failing.

export { MATERIALS_BUCKET, MAX_OCR_PAGES };

export const ocrPayload = z.object({
  source_id: z.string().uuid(),
  user_id: z.string().uuid(),
  pages: z
    .array(z.object({ path: z.string().min(1), page: z.number().int().min(1).nullable() }))
    .min(1)
    .max(MAX_OCR_PAGES),
});

const MSG = { failed: "Ifiok couldn't read the photos or scanned pages. Add them again." } as const;
const MIN_TEXT = 20;

export type OcrRepo = {
  source(id: string): Promise<{
    ownerId: string;
    courseId: string | null;
    conceptId: string | null;
    kind: string;
    shared: boolean;
  } | null>;
  /** A scanned past paper or lab manual: start its exam or lab extraction now there's text. */
  followUp(source: { id: string; ownerId: string; courseId: string | null; kind: string }): Promise<void>;
  /** Pages already read by an earlier attempt of this job. */
  donePages(sourceId: string): Promise<Set<number | null>>;
  image(path: string): Promise<{ data: Uint8Array; mime: ImageInput["mime"] } | null>;
  saveChunks(
    source: { id: string; ownerId: string; courseId: string | null; conceptId: string | null },
    chunks: { page: number | null; content: string }[],
  ): Promise<void>;
  queueEmbed(sourceId: string, ownerId: string): Promise<void>;
};

const mimeOf = (path: string): ImageInput["mime"] =>
  /\.png$/i.test(path)
    ? "image/png"
    : /\.webp$/i.test(path)
      ? "image/webp"
      : /\.heic$/i.test(path)
        ? "image/heic"
        : "image/jpeg";

export function createSupabaseOcrRepo(db: SupabaseClient<Database>): OcrRepo {
  return {
    async source(id) {
      const { data } = await db
        .from("sources")
        .select("owner_id, course_id, concept_id, kind, shared_at")
        .eq("id", id)
        .maybeSingle();
      return data
        ? {
            ownerId: data.owner_id,
            courseId: data.course_id,
            conceptId: data.concept_id,
            kind: data.kind,
            shared: Boolean(data.shared_at),
          }
        : null;
    },
    async followUp(source) {
      if (source.kind === "past_paper" && source.courseId) {
        await db.rpc("enqueue_job_once", {
          p_queue: "exam_extract",
          p_payload: { source_id: source.id, course_id: source.courseId, user_id: source.ownerId },
          p_dedupe: `exam:${source.id}`,
          p_owner: source.ownerId,
        });
      } else if (source.kind === "lab_manual") {
        await db.rpc("enqueue_job_once", {
          p_queue: "lab_extract",
          p_payload: { mode: "manual", source_id: source.id, course_id: source.courseId, user_id: source.ownerId },
          p_dedupe: `lab:${source.id}`,
          p_owner: source.ownerId,
        });
      }
    },
    async donePages(id) {
      const { data } = await db.from("chunks").select("page").eq("source_id", id);
      return new Set((data ?? []).map((c) => c.page));
    },
    async image(path) {
      const { data } = await db.storage.from(MATERIALS_BUCKET).download(path);
      return data ? { data: new Uint8Array(await data.arrayBuffer()), mime: mimeOf(path) } : null;
    },
    async saveChunks(source, chunks) {
      if (!chunks.length) return;
      const { error } = await db.from("chunks").insert(
        chunks.map((c) => ({
          source_id: source.id,
          owner_id: source.ownerId,
          course_id: source.courseId,
          concept_id: source.conceptId,
          visibility: "private" as const,
          page: c.page,
          content: c.content,
        })),
      );
      if (error) throw new Error("Couldn't save the text");
    },
    async queueEmbed(sourceId, ownerId) {
      const { error } = await db.rpc("enqueue_job_once", {
        p_queue: "embed",
        p_payload: { source_id: sourceId },
        p_dedupe: `embed:${sourceId}:ocr`,
        p_owner: ownerId,
      });
      if (error) throw new Error("Couldn't queue indexing");
    },
  };
}

export type OcrDeps = { repo: OcrRepo; gateway: Pick<Gateway, "run">; now?: () => Date };

export function createOcrHandler(deps: OcrDeps): JobHandler {
  const { repo } = deps;
  return {
    async run(job) {
      const parsed = ocrPayload.safeParse(job.payload);
      if (!parsed.success || parsed.data.user_id !== job.ownerId)
        throw new JobFailure("bad_payload", MSG.failed, false);
      const p = parsed.data;
      // Guardrail 7: the job owner's own material, and images in their own folder.
      const source = await repo.source(p.source_id);
      if (!source || source.ownerId !== p.user_id) throw new JobFailure("payload_owner_mismatch", MSG.failed, false);
      if (p.pages.some((pg) => !pg.path.startsWith(`${p.user_id}/${p.source_id}/`)))
        throw new JobFailure("foreign_path", MSG.failed, false);

      const done = await repo.donePages(p.source_id);
      const pages: { page: number | null; text: string }[] = [];
      let waiting = false;
      for (const pg of p.pages) {
        if (done.has(pg.page)) continue;
        const image = await repo.image(pg.path);
        if (!image) continue;
        try {
          const out = (
            await deps.gateway.run<OcrPagesOutput>("ocr_pages", {
              userId: p.user_id,
              mode: "job",
              attempt: 1,
              input: { page: pg.page },
              images: [image],
            })
          ).output;
          const text = redactPersonalData(out.text).text.trim();
          if (text.length >= MIN_TEXT) pages.push({ page: pg.page, text });
        } catch (err) {
          // The allowance is used up: keep what was read and finish the rest tomorrow.
          if (err instanceof GatewayError && err.code === "quota_exhausted") {
            waiting = true;
            break;
          }
          if (err instanceof GatewayError && err.code === "not_allowed")
            throw new JobFailure(err.code, err.message, false);
          throw new JobFailure(err instanceof GatewayError ? err.code : "ocr_failed", MSG.failed);
        }
      }

      const chunks = chunkPages(pages);
      await repo.saveChunks({ id: p.source_id, ...source }, chunks);
      if (chunks.length) await repo.queueEmbed(p.source_id, p.user_id);
      // First text for a scanned course upload (not a Library upload): its exam or lab extraction.
      if (chunks.length && done.size === 0 && !source.shared)
        await repo.followUp({ id: p.source_id, ownerId: p.user_id, courseId: source.courseId, kind: source.kind });
      if (waiting) {
        return {
          kind: "defer",
          seconds: secondsUntilLagosMidnight(deps.now?.() ?? new Date()),
          result: { waiting: "ocr_allowance", read: pages.length },
        };
      }
      return { kind: "done", result: { read: pages.length, chunks: chunks.length } };
    },
  };
}
