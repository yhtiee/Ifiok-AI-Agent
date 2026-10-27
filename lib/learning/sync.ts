import "server-only";
import { z } from "zod";
import type { ExplainErrorOutput } from "@ifiok/core/ai/skills/explain-error";
import { attemptResponseSchema, describeResponse, gradeAttempt } from "@ifiok/core/learning/grade";
import { getGateway } from "@/lib/ai";
import { describeError } from "@/lib/api/trace";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/sync (10 MVP-03, guardrail 6): the only writer of learning evidence. Attempts are
// re-marked here from the stored item; nothing the client says about correctness is used. Each
// attempt and screen carries a client UUID, so a resend records nothing twice. Mastery moves in
// the same SQL call as the attempt (record_attempt). Wrong answers are explained after the
// response (explain_error), so feedback never waits for the AI.

const uuid = z.string().uuid();
/** Wrong answers explained per request (the rest stay untagged); the daily cap is the quota. */
const EXPLAIN_PER_REQUEST = 3;

export const syncBody = z.object({
  attempts: z
    .array(
      z
        .object({
          id: uuid,
          /** A practice item, or a lesson checkpoint by lesson and block. */
          item_id: uuid.optional(),
          lesson_id: uuid.optional(),
          block_id: z.string().max(40).optional(),
          response: attemptResponseSchema,
          duration_ms: z.number().int().min(0).max(3_600_000).optional(),
        })
        .refine((a) => Boolean(a.item_id) !== Boolean(a.lesson_id && a.block_id), {
          message: "give item_id, or lesson_id with block_id",
        }),
    )
    .max(50)
    .default([]),
  screens: z
    .array(
      z.object({
        id: uuid,
        lesson_id: uuid,
        screen_id: z.string().max(40),
        completed_at: z.string().datetime({ offset: true }),
      }),
    )
    .max(100)
    .default([]),
});
export type SyncBody = z.infer<typeof syncBody>;

export type AttemptResult =
  | {
      id: string;
      status: "recorded" | "duplicate";
      correct: boolean;
      why: string | null;
      answer: string | null;
      conceptId: string;
      mastery: { m: number; level: string };
    }
  | { id: string; status: "not_found" };

export type SyncResult = { attempts: AttemptResult[]; screens: number };

type ItemRow = {
  id: string;
  type: string;
  stem: unknown;
  answer: unknown;
  verification: unknown;
  concept_id: string;
  owner_id: string | null;
  status: string;
  lesson_id: string | null;
  block_id: string | null;
  origin: string;
  course_id: string | null;
};

export type PendingExplanation = {
  attemptId: string;
  item: ItemRow;
  response: SyncBody["attempts"][number]["response"];
  answer: string | null;
};

export async function syncEvidence(
  viewer: Viewer,
  body: SyncBody,
): Promise<{ result: SyncResult; explain: PendingExplanation[] }> {
  const admin = createAdminClient();

  // Resolve every attempt's item: by id, or a checkpoint by (lesson, block).
  const itemIds = body.attempts.flatMap((a) => (a.item_id ? [a.item_id] : []));
  const lessonIds = [...new Set(body.attempts.flatMap((a) => (a.lesson_id ? [a.lesson_id] : [])))];
  const cols =
    "id, type, stem, answer, verification, concept_id, owner_id, status, lesson_id, block_id, origin, course_id";
  const [byId, byLesson] = await Promise.all([
    itemIds.length ? admin.from("items").select(cols).in("id", itemIds) : Promise.resolve({ data: [] as ItemRow[] }),
    lessonIds.length
      ? admin.from("items").select(cols).in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] as ItemRow[] }),
  ]);
  const items = new Map<string, ItemRow>();
  for (const i of (byId.data ?? []) as ItemRow[]) items.set(i.id, i);
  const checkpoints = new Map<string, ItemRow>();
  for (const i of (byLesson.data ?? []) as ItemRow[])
    if (i.lesson_id && i.block_id) checkpoints.set(`${i.lesson_id}:${i.block_id}`, i);

  // Past-paper questions belong to their course: only its members may answer them (items_read RLS).
  const pastCourses = [
    ...new Set([...items.values()].flatMap((i) => (i.origin === "past_paper" && i.course_id ? [i.course_id] : []))),
  ];
  const memberOf = new Set<string>();
  if (pastCourses.length) {
    const { data } = await admin
      .from("enrollments")
      .select("course_id")
      .eq("user_id", viewer.userId)
      .in("course_id", pastCourses);
    for (const e of data ?? []) memberOf.add(e.course_id);
  }
  const visible = (i: ItemRow) =>
    i.status === "published" &&
    (i.owner_id === viewer.userId ||
      (i.owner_id === null && (i.origin !== "past_paper" || (i.course_id !== null && memberOf.has(i.course_id)))));

  const results: AttemptResult[] = [];
  const explain: PendingExplanation[] = [];
  for (const a of body.attempts) {
    const item = a.item_id ? items.get(a.item_id) : checkpoints.get(`${a.lesson_id}:${a.block_id}`);
    if (!item || !visible(item)) {
      results.push({ id: a.id, status: "not_found" });
      continue;
    }
    const grade = gradeAttempt(item, a.response);
    const { data, error } = await admin.rpc("record_attempt", {
      p_id: a.id,
      p_user: viewer.userId,
      p_item: item.id,
      p_response: a.response,
      p_correct: grade.correct,
      p_duration_ms: a.duration_ms ?? undefined,
      p_weight_factor: grade.weight,
    });
    const row = data?.[0];
    if (error || !row) throw new Error(`Couldn't record the attempt (${error?.code ?? "no row"})`);
    results.push({
      id: a.id,
      status: row.inserted ? "recorded" : "duplicate",
      correct: grade.correct,
      why: grade.why,
      answer: grade.answer,
      conceptId: row.concept_id,
      mastery: { m: Number(row.m), level: row.level },
    });
    if (row.inserted && !grade.correct && explain.length < EXPLAIN_PER_REQUEST) {
      explain.push({ attemptId: a.id, item, response: a.response, answer: grade.answer });
    }
  }

  // Finished screens of lessons the student can see.
  let screens = 0;
  if (body.screens.length) {
    const ids = [...new Set(body.screens.map((s) => s.lesson_id))];
    const { data: lessons } = await admin.from("lessons").select("id, owner_id, status, spec").in("id", ids);
    const ok = new Set(
      (lessons ?? [])
        .filter(
          (l) =>
            ["published", "superseded"].includes(l.status) && (l.owner_id === null || l.owner_id === viewer.userId),
        )
        .map((l) => l.id),
    );
    const finished: { lesson_id: string; screen_id: string }[] = [];
    for (const s of body.screens) {
      if (!ok.has(s.lesson_id)) continue;
      const { data } = await admin.rpc("record_screen", {
        p_id: s.id,
        p_user: viewer.userId,
        p_lesson: s.lesson_id,
        p_screen: s.screen_id,
        p_completed_at: s.completed_at,
      });
      if (data) {
        screens++;
        finished.push(s);
      }
    }
    // Usage points (06 §4, MVP-06): a finished screen of a shared lesson that quotes material from
    // the contribution pool counts once per (material, student, month) for its contributor.
    await recordSourceUsage(admin, viewer.userId, finished, lessons ?? []);
  }

  return { result: { attempts: results, screens }, explain };
}

/** The pool sources quoted on the finished screens of shared lessons, each recorded once. */
async function recordSourceUsage(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  finished: { lesson_id: string; screen_id: string }[],
  lessons: { id: string; owner_id: string | null; spec: unknown }[],
) {
  const chunkIds = new Set<number>();
  for (const f of finished) {
    const lesson = lessons.find((l) => l.id === f.lesson_id && l.owner_id === null);
    const screen = (
      lesson?.spec as { screens?: { id?: string; blocks?: { chunk_id?: unknown }[] }[] } | undefined
    )?.screens?.find((x) => x.id === f.screen_id);
    for (const block of screen?.blocks ?? []) if (typeof block.chunk_id === "number") chunkIds.add(block.chunk_id);
  }
  if (!chunkIds.size) return;
  const { data: chunks } = await admin
    .from("chunks")
    .select("source_id")
    .in("id", [...chunkIds])
    .eq("visibility", "bank");
  for (const source of new Set((chunks ?? []).map((c) => c.source_id))) {
    await admin.rpc("record_usage", { p_kind: "source", p_resource: source, p_consumer: userId });
  }
}

/** Explains wrong answers and tags them with a micro-skill. Runs after the response; never throws. */
export async function explainWrongAnswers(viewer: Viewer, pending: PendingExplanation[]) {
  if (pending.length === 0) return;
  const admin = createAdminClient();
  const concepts = new Map<string, { subject: string; micro_skills: string[] }>();
  const { data } = await admin
    .from("concepts")
    .select("id, subject, micro_skills")
    .in("id", [...new Set(pending.map((p) => p.item.concept_id))]);
  for (const c of data ?? []) concepts.set(c.id, { subject: c.subject, micro_skills: c.micro_skills ?? [] });

  for (const p of pending) {
    const concept = concepts.get(p.item.concept_id);
    const vocabulary = concept?.micro_skills ?? [];
    const stem = (p.item.stem ?? {}) as { prompt?: string };
    try {
      const { output } = await getGateway().run<ExplainErrorOutput>("explain_error", {
        userId: viewer.userId,
        input: {
          question: (stem.prompt ?? "").slice(0, 2000),
          student_answer: describeResponse(p.response).slice(0, 500),
          correct_answer: p.answer?.slice(0, 500) ?? null,
          micro_skills: vocabulary.slice(0, 20),
        },
      });
      // Only the topic's own codes are accepted; anything else is "unknown".
      const tag = vocabulary.includes(output.error_tag) ? output.error_tag : "unknown";
      await admin.rpc("tag_attempt", {
        p_attempt: p.attemptId,
        p_user: viewer.userId,
        p_tag: tag,
        p_subject: concept?.subject ?? "general",
        p_title: tag === "unknown" ? "Unknown" : skillTitle(tag),
      });
    } catch (err) {
      // Quota used up or the AI is unavailable: the answer stays untagged. Metadata only (guardrail 10).
      console.warn("[sync.explain]", JSON.stringify(describeError(err)));
    }
  }
}

/** "sql.window_functions" → "Window functions". */
export function skillTitle(code: string): string {
  const last = code.split(".").pop() ?? code;
  const words = last.replace(/[_-]+/g, " ").trim();
  return words ? words[0]!.toUpperCase() + words.slice(1) : code;
}
