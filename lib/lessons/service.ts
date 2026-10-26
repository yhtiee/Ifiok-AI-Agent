import "server-only";
import { lessonSpecSchema, verifyLesson, type LessonSpec } from "@ifiok/core";
import { createSupabaseLessonRepo } from "@ifiok/core/lessons/repo";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/types";
import { citedChunkIds, TOPIC_MIN_SCREENS } from "./pipeline";
import { activePrivateJob, citationLabels, findPrivateLesson, startPrivateLesson } from "./private";
import type { ConceptRow, GetLessonResult, LessonFlagInput, LessonRow, LessonStatus, LessonTrust } from "./types";

// Shared lessons in Next: where a concept's lesson stands, starting generation (the worker Edge
// Function runs it, P0-11), flags and curator edits. Generation itself: packages/core/jobs/lesson-gen.

type Admin = ReturnType<typeof createAdminClient>;
type JobResult = { lesson_id?: string; status?: string; reason?: string; waiting?: string; day?: string };

/** Generation attempts per concept per day before retry is offered no more. */
const MAX_ATTEMPTS_PER_DAY = 3;

const MSG = {
  failed: "Ifiok couldn't build this lesson just now. Read the quick explanation below, then try again.",
  checks:
    "This lesson didn't pass Ifiok's checks, so it isn't shown. Read the quick explanation below, then try again.",
  noRetry:
    "This lesson didn't pass Ifiok's checks today, so a curator will look at it. The quick explanation below still covers the basics.",
  curator:
    "Lessons in this subject are checked by a curator before anyone sees them. Until then, use the quick explanation below. It's a general explanation, not from course material.",
  tomorrow: "Your lesson will be ready by tomorrow morning. Start with the quick explanation below.",
} as const;

const dedupeKey = (conceptId: string) => `lesson:${conceptId}`;

export function generateQuickExplainer(concept: Pick<ConceptRow, "title" | "subject" | "description">): string {
  if (concept.description) {
    return `${concept.title}: ${concept.description}`;
  }
  return `${concept.title} is a core concept in ${concept.subject}. Your interactive step-by-step lesson with practice checkpoints is being assembled now.`;
}

function toLessonRow(data: Database["public"]["Tables"]["lessons"]["Row"]): LessonRow {
  return {
    ...data,
    status: data.status as LessonStatus,
    trust: data.trust as LessonTrust,
    spec: data.spec as unknown as LessonSpec,
    source_refs: (data.source_refs as number[]) ?? [],
    hidden_blocks: data.hidden_blocks ?? [],
  };
}

/** Loads a lesson by ID under RLS (students see published and superseded shared lessons). */
export async function getLesson(lessonId: string): Promise<LessonRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (error || !data) return null;
  return toLessonRow(data);
}

async function loadConcept(admin: Admin, conceptId: string) {
  const { data } = await admin
    .from("concepts")
    .select("id, title, subject, description, current_lesson_id")
    .eq("id", conceptId)
    .maybeSingle();
  if (!data)
    throw new RouteError(404, "That topic doesn't exist. Search for it again from Courses.", "concept_not_found");
  return data;
}

/**
 * Where the lesson a student should see stands (F2-FR4, MVP-02): their own private lesson from
 * their materials when there is one, otherwise the shared lesson; while a private lesson is being
 * built, the shared lesson (if any) is shown meanwhile. Read-only: never starts generation or
 * charges quota, so it is safe on GET and in server components.
 */
export async function getLessonState(
  conceptId: string,
  ctx?: { viewer: Viewer; courseId?: string | null },
): Promise<GetLessonResult> {
  if (!ctx) return getSharedLessonState(conceptId);
  const courseId = ctx.courseId ?? null;
  const own = await findPrivateLesson(ctx.viewer, conceptId, courseId);
  if (own) return { status: "published", lesson: own, fromNotes: { citations: await citationLabels(own.source_refs) } };

  const [shared, building] = await Promise.all([
    getSharedLessonState(conceptId),
    activePrivateJob(ctx.viewer, conceptId, courseId),
  ]);
  if (!building) return shared;
  if (shared.status === "published") return { ...shared, notesBuilding: { jobId: building } };
  if ("concept" in shared) {
    return { status: "generating", jobId: building, concept: shared.concept, quickExplainer: shared.quickExplainer };
  }
  return shared;
}

/** Where a concept's shared lesson stands. */
async function getSharedLessonState(conceptId: string): Promise<GetLessonResult> {
  const admin = createAdminClient();
  const concept = await loadConcept(admin, conceptId);
  const summary = { id: concept.id, title: concept.title, subject: concept.subject };
  const quickExplainer = generateQuickExplainer(concept);

  if (concept.current_lesson_id) {
    const lesson = await getLesson(concept.current_lesson_id);
    if (lesson?.status === "published") return { status: "published", lesson };
  }

  const key = dedupeKey(conceptId);
  const { data: active } = await admin
    .from("jobs")
    .select("id, result")
    .eq("dedupe_key", key)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (active) {
    // A job parked on the library budget waits in the queue until midnight (F2-FR8).
    return ((active.result ?? {}) as JobResult).waiting === "library_budget"
      ? { status: "waiting", jobId: active.id, concept: summary, quickExplainer, message: MSG.tomorrow }
      : { status: "generating", jobId: active.id, concept: summary, quickExplainer };
  }

  // A sensitive lesson waiting for its curator: never regenerate it (F2-FR5). The gate is off until
  // the Grow stage (app_config.curation, 12 §4 Q51), so this only applies when it is switched on.
  const [{ data: subject }, { data: latestReview }, curation] = await Promise.all([
    admin.from("subjects").select("sensitive").eq("code", concept.subject).maybeSingle(),
    admin
      .from("lessons")
      .select("id")
      .eq("concept_id", conceptId)
      .eq("kind", "topic")
      .is("owner_id", null)
      .eq("status", "review")
      .limit(1)
      .maybeSingle(),
    getConfig("curation").catch(() => ({ sensitive_lessons_need_curator: false })),
  ]);
  if (curation.sensitive_lessons_need_curator && subject?.sensitive && latestReview) {
    return { status: "review", concept: summary, quickExplainer, message: MSG.curator };
  }

  const { data: lastJob } = await admin
    .from("jobs")
    .select("status, result")
    .eq("dedupe_key", key)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastJob) return { status: "none", concept: summary, quickExplainer };

  // The last job failed or its lesson failed a check: the student gets the explainer and a retry.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("dedupe_key", key)
    .gte("created_at", since);
  const canRetry = (count ?? 0) < MAX_ATTEMPTS_PER_DAY;
  const checksFailed = ((lastJob.result ?? {}) as JobResult).reason === "checks_failed";
  return {
    status: "failed",
    concept: summary,
    quickExplainer,
    canRetry,
    message: !canRetry ? MSG.noRetry : checksFailed ? MSG.checks : MSG.failed,
  };
}

/**
 * Opens a concept's lesson, enqueueing generation when there is none (F2-FR4, FR8). One job per
 * concept; the new_lesson quota is charged only when this request created the job: it is reserved
 * first and refunded if the request joined someone else's job, so the worker never starts a job
 * whose quota could still fail. The enqueue trigger wakes the worker.
 */
export async function startLessonForConcept(
  viewer: Viewer,
  conceptId: string,
  courseId?: string,
): Promise<GetLessonResult> {
  const state = await getLessonState(conceptId, { viewer, courseId });
  if (state.status === "published" && (state.fromNotes || state.notesBuilding)) return state;
  if (state.status === "generating") return state;

  // MVP-02: when the student's materials cover this topic, build their own lesson from them.
  const privateJob = await startPrivateLesson(viewer, conceptId, courseId ?? null);
  if (privateJob) {
    if (state.status === "published") return { ...state, notesBuilding: { jobId: privateJob } };
    if ("concept" in state) {
      return { status: "generating", jobId: privateJob, concept: state.concept, quickExplainer: state.quickExplainer };
    }
  }
  if (state.status !== "none" && !(state.status === "failed" && state.canRetry)) return state;

  const admin = createAdminClient();
  const limit = (await getConfig("ai_quotas")).new_lesson?.limit ?? 0;
  const { data: reserved } = await admin.rpc("consume_quota", {
    p_user: viewer.userId,
    p_feature: "new_lesson",
    p_limit: limit,
  });
  if (!reserved) {
    throw new RouteError(
      429,
      `You've started ${limit} new lessons today, the most for one day. Lessons other students have opened are still free, and your allowance resets at midnight.`,
      "quota_exhausted",
    );
  }

  const { data: rows, error } = await admin.rpc("enqueue_job_once", {
    p_queue: "lesson_gen",
    p_payload: { concept_id: conceptId, course_id: courseId ?? null, user_id: viewer.userId },
    p_dedupe: dedupeKey(conceptId),
    p_owner: viewer.userId,
  });
  const enqueued = rows?.[0];
  if (error || !enqueued || !enqueued.created) {
    await admin.rpc("refund_quota", { p_user: viewer.userId, p_feature: "new_lesson" });
    if (error || !enqueued) {
      throw new RouteError(503, "Ifiok couldn't start this lesson. Try again in a minute.", "job_failed");
    }
  }

  return { status: "generating", jobId: enqueued.job_id, concept: state.concept, quickExplainer: state.quickExplainer };
}

/**
 * Flags a block (F2-FR6). Three distinct students hide it (trigger `hide_flagged_block`).
 */
export async function flagLessonBlock(
  viewer: Viewer,
  lessonId: string,
  input: LessonFlagInput,
): Promise<{ id: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lesson_flags")
    .insert({
      lesson_id: lessonId,
      block_id: input.blockId,
      user_id: viewer.userId,
      reason: input.reason,
      note: input.note?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new RouteError(409, "You've already flagged this block. A curator will look at it.", "already_flagged");
    }
    throw new RouteError(500, "Ifiok couldn't save your flag. Try again in a minute.", "flag_failed");
  }
  return { id: Number(data.id) };
}

/**
 * A curator's fix (F2-FR6, guardrail 14): verification gate, a new version that supersedes the
 * old one atomically, checkpoint items, and an admin_audit row. Curators act only in their subject.
 */
export async function curateLesson(viewer: Viewer, lessonId: string, updatedSpec: LessonSpec): Promise<LessonRow> {
  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: old } = await admin.from("lessons").select("*").eq("id", lessonId).maybeSingle();
  if (!old || old.owner_id !== null) throw new RouteError(404, "That lesson doesn't exist.", "lesson_not_found");

  const [{ data: isCurator }, { data: isAdmin }] = await Promise.all([
    supabase.rpc("is_curator", { p_concept: old.concept_id }),
    supabase.rpc("is_admin"),
  ]);
  if (!isCurator && !isAdmin) {
    throw new RouteError(403, "Only curators for this subject can edit its lessons.", "not_curator");
  }

  const parsed = lessonSpecSchema.safeParse(updatedSpec);
  if (!parsed.success) {
    throw new RouteError(
      422,
      `The lesson isn't valid: ${parsed.error.issues[0]?.message ?? "bad lesson"}.`,
      "invalid_dsl",
    );
  }

  const { data: chunkRows } = await admin.rpc("shared_lesson_sources", { p_concept: old.concept_id, p_limit: 40 });
  const chunks = (chunkRows ?? []).map((c) => ({ id: Number(c.id), content: c.content }));
  const verified = verifyLesson(parsed.data, chunks, { minScreens: old.kind === "topic" ? TOPIC_MIN_SCREENS : 3 });
  if (!verified.ok) {
    throw new RouteError(
      422,
      `The lesson didn't pass verification: ${verified.errors.slice(0, 3).join("; ")}. Fix it and save again.`,
      "verification_failed",
    );
  }

  // A curator's approval makes a lesson trusted; past 50 completions a second curator is needed
  // (F2-FR5), so the fix keeps its current trust until that review flow exists.
  const trust: LessonTrust = old.completions >= 50 ? (old.trust as LessonTrust) : "trusted";
  const sourceRefs = citedChunkIds(verified.verifiedSpec);

  const repo = createSupabaseLessonRepo(admin);
  let newId: string;
  try {
    newId = await repo.publish({
      conceptId: old.concept_id,
      kind: old.kind,
      spec: verified.verifiedSpec,
      status: "published",
      trust,
      sourceRefs,
      sourcesUsed: sourceRefs.length,
      model: old.model,
      courseId: old.course_id,
      requestedBy: old.requested_by,
      verifiedBy: viewer.userId,
      supersede: old.id,
    });
    await repo.materializeCheckpoints(newId, old.concept_id, verified.verifiedSpec);
  } catch {
    throw new RouteError(500, "Ifiok couldn't publish the fix. Try again in a minute.", "publish_failed");
  }
  await admin.from("admin_audit").insert({
    admin_id: viewer.userId,
    action: "lesson.curate",
    target: `lesson:${newId}`,
    detail: { previous: old.id, previous_version: old.version, trust } as Json,
  });

  const { data: fresh } = await admin.from("lessons").select("*").eq("id", newId).single();
  if (!fresh) throw new RouteError(500, "Ifiok couldn't load the published fix.", "publish_failed");
  return toLessonRow(fresh);
}
