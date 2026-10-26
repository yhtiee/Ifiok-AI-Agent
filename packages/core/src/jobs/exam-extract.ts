import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GatewayError, type Gateway } from "../ai/gateway";
import type { ExamClassifyOutput, ExamExtractOutput } from "../ai/skills/exam";
import type { Database, Json } from "../db/types";
import { lagosDay } from "../streak";
import { secondsUntilLagosMidnight } from "./lesson-gen";
import { JobFailure, type JobHandler } from "./types";

// exam_extract (F8-FR1/FR2, 04 §4.6, 10 MVP-04): a past paper's text (rebuilt from the student's
// own chunks) → questions (exam_extract) → each tagged to a course topic (exam_classify). The
// result is a DRAFT in the job's result: the student reviews and fixes it before anything is saved.

export const examExtractPayload = z.object({
  source_id: z.string().uuid(),
  course_id: z.string().uuid(),
  user_id: z.string().uuid(),
});

/** Below this the topic is left "Unassigned" for the student to choose (F8-FR2). */
export const CLASSIFY_MIN_CONFIDENCE = 0.6;
const MAX_TEXT = 40_000;
const CLASSIFY_BATCH = 40;

const MSG = { failed: "Ifiok couldn't read the questions from these pages. Try adding them again." } as const;

export type DraftQuestion = ExamExtractOutput["questions"][number] & {
  concept_id: string | null;
  concept_confidence: number;
};
export type ExamDraft = { year: number | null; instructions: string | null; questions: DraftQuestion[] };

export type ExamRepo = {
  source(sourceId: string): Promise<{ ownerId: string; courseId: string | null; kind: string } | null>;
  /** The source's chunks in order. */
  chunks(sourceId: string): Promise<{ id: number; page: number | null; content: string }[]>;
  course(courseId: string): Promise<{ code: string; title: string } | null>;
  /** The outline's topics with their concepts. */
  topics(courseId: string): Promise<{ conceptId: string; title: string }[]>;
};

export function createSupabaseExamRepo(db: SupabaseClient<Database>): ExamRepo {
  return {
    async source(id) {
      const { data } = await db.from("sources").select("owner_id, course_id, kind").eq("id", id).maybeSingle();
      return data ? { ownerId: data.owner_id, courseId: data.course_id, kind: data.kind } : null;
    },
    async chunks(id) {
      const { data, error } = await db.from("chunks").select("id, page, content").eq("source_id", id).order("id");
      if (error) throw new Error("Couldn't load the paper");
      return (data ?? []).map((c) => ({ id: Number(c.id), page: c.page, content: c.content }));
    },
    async course(id) {
      const { data } = await db.from("courses").select("code, title").eq("id", id).maybeSingle();
      return data;
    },
    async topics(id) {
      const { data } = await db
        .from("topics")
        .select("concept_id, title")
        .eq("course_id", id)
        .is("archived_at", null)
        .order("position");
      return (data ?? []).flatMap((t) => (t.concept_id ? [{ conceptId: t.concept_id, title: t.title }] : []));
    },
  };
}

/**
 * Rebuilds page text from chunks: consecutive chunks of one page overlap by a few dozen words
 * (materials/chunk.ts), so the repeated words are dropped; pages are separated by a blank line.
 */
export function mergeChunks(chunks: { page: number | null; content: string }[]): string {
  const out: string[] = [];
  let prevPage: number | null | undefined;
  let prevWords: string[] = [];
  for (const c of chunks) {
    let words = c.content.split(/\s+/).filter(Boolean);
    if (c.page === prevPage && prevWords.length) {
      for (let k = Math.min(80, prevWords.length, words.length); k > 0; k--) {
        if (prevWords.slice(-k).join(" ") === words.slice(0, k).join(" ")) {
          words = words.slice(k);
          break;
        }
      }
      out.push(words.join(" "));
    } else {
      if (out.length) out.push(`\n\n[page ${c.page ?? "?"}]\n`);
      out.push(words.join(" "));
    }
    prevPage = c.page;
    prevWords = c.content.split(/\s+/).filter(Boolean);
  }
  return out.join(" ").replace(/ \n/g, "\n").trim();
}

export type ExamExtractDeps = { repo: ExamRepo; gateway: Pick<Gateway, "run">; now?: () => Date };

export function createExamExtractHandler(deps: ExamExtractDeps): JobHandler {
  /** Primary model first, then the backup provider (04 §3), unless the library budget is spent. */
  const run = async <T>(skill: "exam_extract" | "exam_classify", userId: string, input: unknown) => {
    try {
      return (await deps.gateway.run<T>(skill, { userId, mode: "job", attempt: 1, input })).output;
    } catch (err) {
      if (err instanceof GatewayError && err.code === "library_budget") throw err;
      return (await deps.gateway.run<T>(skill, { userId, mode: "job", attempt: 2, input })).output;
    }
  };

  return {
    async run(job) {
      const parsed = examExtractPayload.safeParse(job.payload);
      if (!parsed.success) throw new JobFailure("bad_payload", MSG.failed, false);
      const p = parsed.data;
      // Guardrail 7: the paper is the job owner's, a past paper, filed under this course.
      const source = await deps.repo.source(p.source_id);
      if (!source || source.ownerId !== job.ownerId || p.user_id !== job.ownerId) {
        throw new JobFailure("payload_owner_mismatch", MSG.failed, false);
      }
      if (source.kind !== "past_paper" || source.courseId !== p.course_id) {
        throw new JobFailure("not_a_course_paper", MSG.failed, false);
      }

      const [chunks, course, topics] = await Promise.all([
        deps.repo.chunks(p.source_id),
        deps.repo.course(p.course_id),
        deps.repo.topics(p.course_id),
      ]);
      if (!course || chunks.length === 0) throw new JobFailure("nothing_to_read", MSG.failed, false);
      const text = mergeChunks(chunks).slice(0, MAX_TEXT);

      let extracted: ExamExtractOutput;
      const classified = new Map<number, { concept_id: string | null; confidence: number }>();
      try {
        extracted = await run<ExamExtractOutput>("exam_extract", p.user_id, { course, text });
        const known = new Set(topics.map((t) => t.conceptId));
        for (let start = 0; start < extracted.questions.length && topics.length; start += CLASSIFY_BATCH) {
          const batch = extracted.questions.slice(start, start + CLASSIFY_BATCH);
          const out = await run<ExamClassifyOutput>("exam_classify", p.user_id, {
            topics: topics.map((t) => ({ id: t.conceptId, title: t.title })),
            questions: batch.map((q, i) => ({ index: start + i, text: q.text.slice(0, 1500) })),
          });
          for (const r of out.results) {
            // Only the course's own topics, and only when the model is sure enough (F8-FR2).
            const ok = r.topic_id && known.has(r.topic_id) && r.confidence >= CLASSIFY_MIN_CONFIDENCE;
            classified.set(r.index, { concept_id: ok ? r.topic_id : null, confidence: r.confidence });
          }
        }
      } catch (err) {
        if (err instanceof GatewayError && err.code === "library_budget") {
          const now = deps.now?.() ?? new Date();
          return {
            kind: "defer",
            seconds: secondsUntilLagosMidnight(now),
            result: { waiting: "library_budget", day: lagosDay(now) },
          };
        }
        throw new JobFailure(err instanceof GatewayError ? err.code : "extract_failed", MSG.failed);
      }

      const draft: ExamDraft = {
        year: extracted.year,
        instructions: extracted.instructions,
        questions: extracted.questions.map((q, i) => ({
          ...q,
          concept_id: classified.get(i)?.concept_id ?? null,
          concept_confidence: classified.get(i)?.confidence ?? 0,
        })),
      };
      return { kind: "done", result: { source_id: p.source_id, draft } as unknown as Json };
    },
  };
}
