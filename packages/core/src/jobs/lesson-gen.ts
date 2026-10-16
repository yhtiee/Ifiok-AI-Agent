import { z } from "zod";
import { GatewayError, type Gateway } from "../ai/gateway";
import type { ClaimCheckOutput } from "../ai/skills/claim-check";
import type { Json } from "../db/types";
import type { LessonSpec } from "../dsl/schema";
import { runLessonPipeline } from "../lessons/pipeline";
import type { LessonRepo } from "../lessons/repo";
import { lagosDay } from "../streak";
import { JobFailure, type ClaimedJob, type JobHandler } from "./types";

// lesson_gen (F2-FR4/FR5, 04 §4.2): sources → generate → verify → claim check → publish or review.
// One job per concept (dedupe), so only one runner ever generates a concept's lesson.

export const lessonGenPayload = z.object({
  concept_id: z.string().uuid(),
  course_id: z.string().uuid().nullable().default(null),
  user_id: z.string().uuid().nullable().default(null),
});

// Until subjects carry a profile column (P1-02 remainder), STEM is decided by subject code.
const STEM_SUBJECTS = new Set([
  "mathematics",
  "physics",
  "chemistry",
  "engineering",
  "computer_science",
  "statistics",
  "economics",
  "accounting",
]);

const MSG = {
  failed: "Ifiok couldn't build this lesson just now. Read the quick explanation below, then try again.",
  missing: "This topic no longer exists. Search for it again from Courses.",
} as const;

/** Seconds until the next midnight in Lagos (WAT, UTC+1, no daylight saving). */
export function secondsUntilLagosMidnight(now: Date = new Date()): number {
  const lagosMs = now.getTime() + 3600_000;
  const nextMidnightLagos = Math.floor(lagosMs / 86_400_000 + 1) * 86_400_000;
  return Math.max(60, Math.ceil((nextMidnightLagos - lagosMs) / 1000));
}

export type LessonGenDeps = {
  repo: LessonRepo;
  gateway: Pick<Gateway, "run">;
  now?: () => Date;
};

export function createLessonGenHandler(deps: LessonGenDeps): JobHandler {
  const userOf = (job: ClaimedJob) => {
    const parsed = lessonGenPayload.safeParse(job.payload);
    return parsed.success ? (parsed.data.user_id ?? job.ownerId) : job.ownerId;
  };

  return {
    async run(job) {
      const parsed = lessonGenPayload.safeParse(job.payload);
      if (!parsed.success) throw new JobFailure("bad_payload", MSG.failed, false);
      const payload = parsed.data;
      // Guardrail 7: ids in a payload must belong to the job owner (the concept itself is shared).
      if (payload.user_id && job.ownerId && payload.user_id !== job.ownerId) {
        throw new JobFailure("payload_owner_mismatch", MSG.failed, false);
      }
      const userId = payload.user_id ?? job.ownerId;

      const concept = await deps.repo.loadConcept(payload.concept_id);
      if (!concept) throw new JobFailure("concept_missing", MSG.missing, false);

      const [chunks, sensitive, course] = await Promise.all([
        deps.repo.sharedSources(concept.id),
        deps.repo.isSensitive(concept.subject),
        payload.course_id && userId ? deps.repo.courseContext(payload.course_id, userId, concept.id) : null,
      ]);

      const genInput = {
        concept: {
          id: concept.id,
          title: concept.title,
          description: concept.description,
          subject: concept.subject,
          level_band: concept.level_band ?? undefined,
          prerequisites: [],
          micro_skills: concept.micro_skills,
        },
        course_context: course,
        chunks,
        subject_profile: STEM_SUBJECTS.has(concept.subject.toLowerCase()) ? ("stem" as const) : ("humanities" as const),
      };

      let result;
      try {
        result = await runLessonPipeline(
          {
            // Job mode: the primary model on attempt 1, the backup provider on attempt 2 (04 §3).
            generate: async () => {
              try {
                const r = await deps.gateway.run<LessonSpec>("lesson_generate", {
                  userId,
                  mode: "job",
                  attempt: 1,
                  input: genInput,
                });
                return { output: r.output, model: r.model };
              } catch (err) {
                if (err instanceof GatewayError && err.code === "library_budget") throw err;
                const r = await deps.gateway.run<LessonSpec>("lesson_generate", {
                  userId,
                  mode: "job",
                  attempt: 2,
                  input: genInput,
                });
                return { output: r.output, model: r.model };
              }
            },
            claimCheck: async (input) =>
              (await deps.gateway.run<ClaimCheckOutput>("claim_check", { userId, mode: "job", input })).output,
          },
          { chunks, sensitive },
        );
      } catch (err) {
        if (err instanceof GatewayError && err.code === "library_budget") {
          // Not a failure: park the job until the library budget resets (F2-FR8).
          const now = deps.now?.() ?? new Date();
          return {
            kind: "defer",
            seconds: secondsUntilLagosMidnight(now),
            result: { waiting: "library_budget", day: lagosDay(now) },
          };
        }
        if (err instanceof GatewayError && (err.code === "not_allowed" || err.code === "kill_switched")) {
          throw new JobFailure(err.code, err.message, false);
        }
        throw new JobFailure(err instanceof GatewayError ? err.code : "generate_failed", MSG.failed);
      }

      const lessonId = await deps.repo.publish({
        conceptId: concept.id,
        kind: "topic",
        spec: result.spec,
        status: result.status,
        trust: "new",
        sourceRefs: result.sourceRefs,
        sourcesUsed: result.sourcesUsed,
        model: result.model,
        courseId: payload.course_id,
        requestedBy: userId,
      });
      if (result.status === "published") {
        await deps.repo.materializeCheckpoints(lessonId, concept.id, result.spec);
      }
      // A lesson that failed its checks is never shown, and its quota is refunded (F2-FR8).
      if (result.reason === "checks_failed" && userId) await deps.repo.refundNewLesson(userId);

      return {
        kind: "done",
        result: {
          lesson_id: lessonId,
          status: result.status,
          reason: result.reason,
          issues: result.issues.slice(0, 20),
        } satisfies Json,
      };
    },

    async giveUp(job) {
      const userId = userOf(job);
      if (userId) await deps.repo.refundNewLesson(userId).catch(() => {});
    },
  };
}
