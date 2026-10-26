import "server-only";
import { privateLessonDedupe } from "@ifiok/core/lessons/private";
import type { Viewer } from "@/lib/auth/viewer";
import { privateLessonRepo } from "@/lib/lessons/private";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextUp, type MasteryLevel, type PathTopic } from "./path-rules";

// The course Path for one student (F5-FR6, 07 §5.2, 10 MVP-02): the outline's topics in order, each
// with its lesson state (their own lesson from their materials, or the shared one), mastery and
// practice count, and "Next up". Student data is read under RLS; job states and coverage need the
// service role (they span shared jobs and the retrieval functions) and are scoped to this student.

export type CoursePath = { topics: PathTopic[]; nextUpTopicId: string | null };

export async function getCoursePath(viewer: Viewer, courseId: string): Promise<CoursePath> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("topics")
    .select("id, title, week, position, concept_id, concepts(current_lesson_id)")
    .eq("course_id", courseId)
    .is("archived_at", null)
    .order("position");
  const topics = rows ?? [];
  const conceptIds = [...new Set(topics.flatMap((t) => (t.concept_id ? [t.concept_id] : [])))];
  if (conceptIds.length === 0) {
    return { topics: topics.map((t) => base(t, null)), nextUpTopicId: null };
  }

  const admin = createAdminClient();
  const dedupe = conceptIds.flatMap((c) => [`lesson:${c}`, privateLessonDedupe(viewer.userId, c, courseId)]);
  const priv = privateLessonRepo();
  const cfg = await priv.config();

  const [own, jobs, mastery, items, coverage] = await Promise.all([
    supabase
      .from("lessons")
      .select("concept_id")
      .eq("owner_id", viewer.userId)
      .eq("course_id", courseId)
      .eq("status", "published")
      .in("concept_id", conceptIds),
    admin.from("jobs").select("dedupe_key").in("dedupe_key", dedupe).in("status", ["queued", "running"]),
    supabase
      .from("mastery")
      .select("concept_id, level, attempts_count")
      .eq("user_id", viewer.userId)
      .in("concept_id", conceptIds),
    supabase.from("items").select("concept_id").in("type", ["mcq", "numeric"]).in("concept_id", conceptIds),
    priv.coverage({ userId: viewer.userId, courseId }, null, cfg).catch(() => new Map<string, number>()),
  ]);

  const ownSet = new Set((own.data ?? []).map((l) => l.concept_id));
  const building = new Set(
    (jobs.data ?? []).map((j) => (j.dedupe_key ?? "").replace(/^lesson:private:[^:]+:/, "lesson:").split(":")[1]),
  );
  const levels = new Map((mastery.data ?? []).map((m) => [m.concept_id, m.level as MasteryLevel]));
  const tried = new Set((mastery.data ?? []).filter((m) => m.attempts_count > 0).map((m) => m.concept_id));
  const practice = new Map<string, number>();
  for (const i of items.data ?? []) practice.set(i.concept_id, (practice.get(i.concept_id) ?? 0) + 1);

  const path = topics.map((t) => {
    const c = t.concept_id;
    const p = base(t, c);
    if (!c) return p;
    const covered = (coverage.get(c) ?? 0) >= cfg.min_chunks;
    const sharedReady = Boolean((t.concepts as { current_lesson_id: string | null } | null)?.current_lesson_id);
    return {
      ...p,
      fromNotes: ownSet.has(c),
      covered,
      lesson: ownSet.has(c) ? "ready" : building.has(c) ? "building" : sharedReady ? "ready" : "not_started",
      mastery: levels.get(c) ?? "not_started",
      tried: tried.has(c),
      practice: practice.get(c) ?? 0,
    } satisfies PathTopic;
  });
  return { topics: path, nextUpTopicId: nextUp(path)?.topicId ?? null };
}

function base(t: { id: string; title: string; week: number | null }, conceptId: string | null): PathTopic {
  return {
    topicId: t.id,
    title: t.title,
    week: t.week,
    conceptId,
    lesson: "not_started",
    fromNotes: false,
    covered: false,
    mastery: "not_started",
    tried: false,
    practice: 0,
  };
}
