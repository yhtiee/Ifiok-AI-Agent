import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GatewayError, type Gateway } from "../ai/gateway";
import type { CurateClassifyOutput } from "../ai/skills/contribute";
import type { UsageConfig } from "../ai/config-schema";
import type { Database } from "../db/types";
import { mergeChunks } from "./exam-extract";
import { secondsUntilLagosMidnight } from "./lesson-gen";
import { JobFailure, type JobHandler } from "./types";

// curate (F11-FR2, 10 MVP-06): material a student shared → checks → approved into the
// contribution pool (its chunks become pool material, each tagged with its topic, so
// shared_lesson_sources() uses them for everyone) or held / rejected with a reason the student
// sees. Approval earns +5 pending Units and rebuilds a topic's shared lesson when it had no sources.

export const curatePayload = z.object({ source_id: z.string().uuid(), user_id: z.string().uuid() });

/** A share of chunks that nearly repeat pool material at or above this is a duplicate (F11-FR2). */
export const DUPLICATE_SHARE = 0.5;
/**
 * Cosine similarity at which a chunk "nearly repeats" pool material. F11-FR2 says 0.92, but on gte-small
 * different notes on the same topic score 0.94–0.95 and a retyped copy 0.998 (measured 27 Oct 2026,
 * 12 §4 Q57), so 0.92 would reject other students' own notes as duplicates.
 */
export const DUPLICATE_SIMILARITY = 0.97;
/** Embedding candidates below this similarity aren't offered to the classifier. */
export const CANDIDATE_MIN_SCORE = 0.75;
const MAX_TEXT = 12_000;

/** Signals of a published book (08 §8): held for a person, never auto-approved. */
const COPYRIGHT_SIGNALS = [
  /\bISBN(?:-1[03])?:?\s*[\d-]{10,17}/i,
  /all rights reserved/i,
  /no part of this (?:publication|book) may be reproduced/i,
  /\b(?:Pearson|McGraw[- ]Hill|Wiley|Cengage|Oxford University Press|Cambridge University Press|Elsevier|Springer)\b/,
];
const INJECTION =
  /ignore (?:all |the )?(?:previous|above) instructions|system prompt|you are (?:now )?(?:an? )?(?:ai|assistant|chatgpt)/i;

export type CurateOutcome =
  { status: "approved"; concepts: string[] } | { status: "needs_review" | "rejected"; reason: string };

const MSG = { failed: "Ifiok couldn't check this material. Share it again in a few minutes." } as const;

export type CurateRepo = {
  source(id: string): Promise<{
    ownerId: string;
    kind: string;
    courseId: string | null;
    /** The topic it was filed under (a Library upload or a free-standing topic's materials). */
    concept: { id: string; title: string } | null;
    sha256: string | null;
    sharedAt: string | null;
  } | null>;
  /** Chunks still waiting for their embeddings (the embed job runs after upload). */
  pendingEmbeddings(sourceId: string): Promise<number>;
  chunks(sourceId: string): Promise<{ page: number | null; content: string }[]>;
  course(courseId: string): Promise<{ code: string; title: string } | null>;
  courseTopics(courseId: string): Promise<{ id: string; title: string }[]>;
  candidates(sourceId: string): Promise<{ id: string; title: string; score: number }[]>;
  /** Another approved pool source with the same text hash. */
  sameHashInPool(sourceId: string, sha256: string): Promise<boolean>;
  duplicateShare(sourceId: string): Promise<number>;
  approve(sourceId: string, concepts: string[]): Promise<void>;
  setReview(sourceId: string, status: "needs_review" | "rejected", reason: string): Promise<void>;
  awardUnits(userId: string, units: number, key: string): Promise<void>;
  /** Of these topics, the ones whose shared lesson is missing or has no sources. */
  topicsWithoutSourcedLesson(conceptIds: string[]): Promise<string[]>;
  queueSharedLesson(conceptId: string): Promise<void>;
};

export function createSupabaseCurateRepo(db: SupabaseClient<Database>): CurateRepo {
  return {
    async source(id) {
      const { data } = await db
        .from("sources")
        .select("owner_id, kind, course_id, sha256, shared_at, concepts(id, title)")
        .eq("id", id)
        .maybeSingle();
      return data
        ? {
            ownerId: data.owner_id,
            kind: data.kind,
            courseId: data.course_id,
            concept: data.concepts ? { id: data.concepts.id, title: data.concepts.title } : null,
            sha256: data.sha256,
            sharedAt: data.shared_at,
          }
        : null;
    },
    async pendingEmbeddings(id) {
      const { count } = await db
        .from("chunks")
        .select("id", { count: "exact", head: true })
        .eq("source_id", id)
        .is("embedding", null);
      return count ?? 0;
    },
    async chunks(id) {
      const { data, error } = await db.from("chunks").select("page, content").eq("source_id", id).order("id");
      if (error) throw new Error("Couldn't load the material");
      return data ?? [];
    },
    async course(id) {
      const { data } = await db.from("courses").select("code, title").eq("id", id).maybeSingle();
      return data;
    },
    async courseTopics(id) {
      const { data } = await db
        .from("topics")
        .select("concept_id, title")
        .eq("course_id", id)
        .is("archived_at", null)
        .order("position");
      return (data ?? []).flatMap((t) => (t.concept_id ? [{ id: t.concept_id, title: t.title }] : []));
    },
    async candidates(id) {
      const { data, error } = await db.rpc("curate_candidates", { p_source: id, p_limit: 10 });
      if (error) throw new Error("Couldn't match topics");
      return (data ?? []).map((r) => ({ id: r.concept_id, title: r.title, score: r.score }));
    },
    async sameHashInPool(id, sha) {
      const { count } = await db
        .from("sources")
        .select("id", { count: "exact", head: true })
        .eq("sha256", sha)
        .eq("visibility", "bank")
        .eq("review", "approved")
        .neq("id", id);
      return (count ?? 0) > 0;
    },
    async duplicateShare(id) {
      const { data, error } = await db.rpc("bank_duplicate_share", { p_source: id, p_threshold: DUPLICATE_SIMILARITY });
      if (error) throw new Error("Couldn't check for duplicates");
      return Number(data ?? 0);
    },
    async approve(id, concepts) {
      const { error } = await db.rpc("approve_shared_source", { p_source: id, p_concepts: concepts });
      if (error) throw new Error("Couldn't approve the material");
    },
    async setReview(id, status, reason) {
      const { error } = await db.from("sources").update({ review: status, review_reason: reason }).eq("id", id);
      if (error) throw new Error("Couldn't save the review");
    },
    async awardUnits(userId, units, key) {
      const { error } = await db.rpc("award_pending_units", {
        p_user: userId,
        p_units: units,
        p_reason: "upload_approved",
        p_key: key,
      });
      if (error) throw new Error("Couldn't record the Units");
    },
    async topicsWithoutSourcedLesson(ids) {
      if (!ids.length) return [];
      const { data } = await db.from("concepts").select("id, current_lesson_id").in("id", ids);
      const lessonIds = (data ?? []).flatMap((c) => (c.current_lesson_id ? [c.current_lesson_id] : []));
      const { data: lessons } = lessonIds.length
        ? await db.from("lessons").select("id, sources_used").in("id", lessonIds)
        : { data: [] as { id: string; sources_used: number }[] };
      const sourced = new Set((lessons ?? []).filter((l) => l.sources_used > 0).map((l) => l.id));
      return (data ?? []).filter((c) => !c.current_lesson_id || !sourced.has(c.current_lesson_id)).map((c) => c.id);
    },
    async queueSharedLesson(conceptId) {
      const { error } = await db.rpc("enqueue_job_once", {
        p_queue: "lesson_gen",
        p_payload: { concept_id: conceptId, course_id: null, user_id: null },
        p_dedupe: `lesson:${conceptId}`,
        p_owner: null as unknown as string,
      });
      if (error) throw new Error("Couldn't queue the lesson");
    },
  };
}

export type CurateDeps = {
  repo: CurateRepo;
  gateway: Pick<Gateway, "run">;
  usage: () => Promise<UsageConfig>;
  now?: () => Date;
};

/** The decision, from what the checks found. Pure, so the rules are tested on their own. */
export function decide(input: {
  sameHash: boolean;
  duplicateShare: number;
  copyrightSignal: boolean;
  injectionSignal: boolean;
  classified: CurateClassifyOutput | null;
  candidates: string[];
}): CurateOutcome {
  if (input.sameHash) return { status: "rejected", reason: "This material is already in the library." };
  if (input.duplicateShare >= DUPLICATE_SHARE)
    return { status: "rejected", reason: "Most of this material is already in the library." };
  if (input.copyrightSignal)
    return {
      status: "needs_review",
      reason: "It looks like it's from a published book, so a person will check it before it's shared.",
    };
  if (input.injectionSignal || input.classified?.injection)
    return {
      status: "needs_review",
      reason: "Some of the text looks like instructions to an AI, so a person will check it.",
    };
  if (!input.candidates.length || !input.classified)
    return { status: "needs_review", reason: "Ifiok couldn't match it to a topic yet, so a person will check it." };
  const c = input.classified;
  if (!c.readable)
    return { status: "rejected", reason: c.reason ?? "The text isn't readable study material. Pick clearer pages." };
  if (c.copyrighted)
    return {
      status: "needs_review",
      reason: c.reason ?? "It looks like it's from a published book, so a person will check it before it's shared.",
    };
  if (c.personal_data)
    return {
      status: "needs_review",
      reason: c.reason ?? "It still contains someone's personal details, so a person will check it.",
    };
  const concepts = c.concept_ids.filter((id) => input.candidates.includes(id));
  if (!concepts.length)
    return { status: "needs_review", reason: "Ifiok couldn't match it to a topic yet, so a person will check it." };
  return { status: "approved", concepts };
}

export function createCurateHandler(deps: CurateDeps): JobHandler {
  const { repo } = deps;
  return {
    async run(job) {
      const parsed = curatePayload.safeParse(job.payload);
      if (!parsed.success || parsed.data.user_id !== job.ownerId)
        throw new JobFailure("bad_payload", MSG.failed, false);
      const p = parsed.data;
      // Guardrail 7: the job owner's own material, which they chose to share; never textbook pages.
      const source = await repo.source(p.source_id);
      if (!source || source.ownerId !== p.user_id || !source.sharedAt || source.kind === "textbook_private")
        throw new JobFailure("not_shareable", MSG.failed, false);

      // Embeddings come from the embed job; wait for them rather than judge half the material.
      if ((await repo.pendingEmbeddings(p.source_id)) > 0)
        return { kind: "defer", seconds: 60, result: { waiting: "embeddings" } };

      const [chunks, course, courseTopics, embedded] = await Promise.all([
        repo.chunks(p.source_id),
        source.courseId ? repo.course(source.courseId) : null,
        source.courseId ? repo.courseTopics(source.courseId) : [],
        repo.candidates(p.source_id),
      ]);
      const text = mergeChunks(chunks);
      // The topic the student filed it under is always offered, then the course's outline, then matches.
      const candidates = new Map<string, string>();
      if (source.concept) candidates.set(source.concept.id, source.concept.title);
      for (const t of courseTopics) candidates.set(t.id, t.title);
      for (const c of embedded) if (c.score >= CANDIDATE_MIN_SCORE) candidates.set(c.id, c.title);

      const [sameHash, duplicateShare] = await Promise.all([
        source.sha256 ? repo.sameHashInPool(p.source_id, source.sha256) : false,
        repo.duplicateShare(p.source_id),
      ]);

      let classified: CurateClassifyOutput | null = null;
      if (!sameHash && duplicateShare < DUPLICATE_SHARE && candidates.size) {
        const input = {
          kind: source.kind,
          course,
          candidates: [...candidates].slice(0, 40).map(([id, title]) => ({ id, title })),
          text: text.slice(0, MAX_TEXT),
        };
        try {
          classified = (
            await deps.gateway.run<CurateClassifyOutput>("curate_classify", {
              userId: p.user_id,
              mode: "job",
              attempt: job.attempts,
              input,
            })
          ).output;
        } catch (err) {
          if (err instanceof GatewayError && err.code === "library_budget") {
            return {
              kind: "defer",
              seconds: secondsUntilLagosMidnight(deps.now?.() ?? new Date()),
              result: { waiting: "library_budget" },
            };
          }
          throw new JobFailure(err instanceof GatewayError ? err.code : "classify_failed", MSG.failed);
        }
      }

      const outcome = decide({
        sameHash,
        duplicateShare,
        copyrightSignal: COPYRIGHT_SIGNALS.some((r) => r.test(text)),
        injectionSignal: INJECTION.test(text),
        classified,
        candidates: [...candidates.keys()],
      });

      if (outcome.status !== "approved") {
        await repo.setReview(p.source_id, outcome.status, outcome.reason);
        return { kind: "done", result: outcome };
      }
      await repo.approve(p.source_id, outcome.concepts);
      const usage = await deps.usage();
      await repo.awardUnits(p.user_id, usage.approved_upload_units, `upload:${p.source_id}`);
      // Past papers feed exam statistics only; they never ground lessons (F11-FR1).
      if (source.kind !== "past_paper") {
        for (const conceptId of await repo.topicsWithoutSourcedLesson(outcome.concepts))
          await repo.queueSharedLesson(conceptId);
      }
      return { kind: "done", result: outcome };
    },
  };
}
