import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rankWeakAreas, type MasteryLevel, type TopicEvidence, type WeakArea } from "./weak-areas";

// The student's progress, read only from server-written evidence (attempts, screen_events,
// mastery; guardrail 6) under RLS: weak areas, what they studied last, and practice sets. Practice
// questions leave the server without their answers; /api/sync marks them.

const DAY = 86_400_000;

/** For each concept, one of the student's courses whose outline has it (for links back to the Path). */
async function courseForConcepts(viewer: Viewer, conceptIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!conceptIds.length) return out;
  const supabase = await createClient();
  const { data: enrolled } = await supabase.from("enrollments").select("course_id").eq("user_id", viewer.userId);
  const courseIds = (enrolled ?? []).map((e) => e.course_id);
  if (!courseIds.length) return out;
  const { data: topics } = await supabase
    .from("topics")
    .select("course_id, concept_id")
    .in("course_id", courseIds)
    .in("concept_id", conceptIds)
    .is("archived_at", null);
  for (const t of topics ?? []) if (t.concept_id && !out.has(t.concept_id)) out.set(t.concept_id, t.course_id);
  return out;
}

export type WeakAreaView = WeakArea & { courseId: string | null };

export async function getWeakAreas(viewer: Viewer, limit = 20): Promise<WeakAreaView[]> {
  const supabase = await createClient();
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const since7 = Date.now() - 7 * DAY;
  const { data: attempts } = await supabase
    .from("attempts")
    .select("correct, error_tag, created_at, items(concept_id)")
    .eq("user_id", viewer.userId)
    .gte("created_at", since14)
    .order("created_at", { ascending: false })
    .limit(1000);
  const rows = (attempts ?? []).flatMap((a) => {
    const conceptId = (a.items as { concept_id: string } | null)?.concept_id;
    return conceptId ? [{ ...a, conceptId }] : [];
  });
  const conceptIds = [...new Set(rows.map((r) => r.conceptId))];
  if (!conceptIds.length) return [];

  const tags = [...new Set(rows.flatMap((r) => (r.error_tag && r.error_tag !== "unknown" ? [r.error_tag] : [])))];
  const [{ data: concepts }, { data: mastery }, { data: skills }, { data: items }, courses] = await Promise.all([
    supabase.from("concepts").select("id, title").in("id", conceptIds),
    supabase.from("mastery").select("concept_id, m, level").eq("user_id", viewer.userId).in("concept_id", conceptIds),
    tags.length ? supabase.from("micro_skills").select("code, title").in("code", tags) : Promise.resolve({ data: [] }),
    supabase.from("items").select("concept_id").in("concept_id", conceptIds).in("type", ["mcq", "numeric"]),
    courseForConcepts(viewer, conceptIds),
  ]);
  const titles = new Map((concepts ?? []).map((c) => [c.id, c.title]));
  const levels = new Map((mastery ?? []).map((m) => [m.concept_id, m]));
  const skillTitles = new Map((skills ?? []).map((s) => [s.code, s.title]));
  const practice = new Map<string, number>();
  for (const i of items ?? []) practice.set(i.concept_id, (practice.get(i.concept_id) ?? 0) + 1);

  const evidence: TopicEvidence[] = conceptIds.map((id) => {
    const mine = rows.filter((r) => r.conceptId === id);
    const week = mine.filter((r) => new Date(r.created_at).getTime() >= since7);
    const tagCounts = new Map<string, number>();
    for (const r of mine) {
      if (!r.correct && r.error_tag && r.error_tag !== "unknown")
        tagCounts.set(r.error_tag, (tagCounts.get(r.error_tag) ?? 0) + 1);
    }
    const top = [...tagCounts].sort((a, b) => b[1] - a[1])[0];
    const m = levels.get(id);
    return {
      conceptId: id,
      title: titles.get(id) ?? "Topic",
      m: Number(m?.m ?? 0),
      level: (m?.level ?? "not_started") as MasteryLevel,
      right7: week.filter((r) => r.correct).length,
      total7: week.length,
      wrong14: mine.filter((r) => !r.correct).length,
      mistake: top ? { title: skillTitles.get(top[0]) ?? top[0], count: top[1] } : null,
      practice: practice.get(id) ?? 0,
    };
  });
  return rankWeakAreas(evidence, limit).map((w) => ({ ...w, courseId: courses.get(w.conceptId) ?? null }));
}

export type LastStudied = { conceptId: string; title: string; courseId: string | null };

/** The topic the student last worked on (a finished lesson screen or an answer), from the server. */
export async function getLastStudied(viewer: Viewer): Promise<LastStudied | null> {
  const supabase = await createClient();
  const [{ data: screen }, { data: attempt }] = await Promise.all([
    supabase
      .from("screen_events")
      .select("received_at, lessons(concept_id, course_id)")
      .eq("user_id", viewer.userId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attempts")
      .select("created_at, items(concept_id)")
      .eq("user_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const fromScreen = screen?.lessons as { concept_id: string; course_id: string | null } | null;
  const fromAttempt = attempt?.items as { concept_id: string } | null;
  const screenAt = screen ? new Date(screen.received_at).getTime() : 0;
  const attemptAt = attempt ? new Date(attempt.created_at).getTime() : 0;
  const pick =
    fromScreen && screenAt >= attemptAt
      ? { conceptId: fromScreen.concept_id, courseId: fromScreen.course_id }
      : fromAttempt
        ? { conceptId: fromAttempt.concept_id, courseId: null }
        : null;
  if (!pick) return null;
  const [{ data: concept }, courses] = await Promise.all([
    supabase.from("concepts").select("title").eq("id", pick.conceptId).maybeSingle(),
    pick.courseId ? Promise.resolve(new Map<string, string>()) : courseForConcepts(viewer, [pick.conceptId]),
  ]);
  return {
    conceptId: pick.conceptId,
    title: concept?.title ?? "Your last topic",
    courseId: pick.courseId ?? courses.get(pick.conceptId) ?? null,
  };
}

export type PracticeQuestion =
  | { id: string; type: "mcq"; prompt: string; options: { id: string; text: string }[] }
  | { id: string; type: "numeric"; prompt: string; unit: string | null };

export const PRACTICE_SET_SIZE = 10;

/**
 * Up to 10 questions for a topic: ones the student hasn't tried first, then ones they got wrong,
 * then the rest. Answers and explanations never leave the server here.
 */
export async function getPracticeSet(viewer: Viewer, conceptId: string): Promise<PracticeQuestion[]> {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("items")
    .select("id, type, stem, owner_id, origin, created_at")
    .eq("concept_id", conceptId)
    .eq("status", "published")
    .in("type", ["mcq", "numeric"])
    .or(`owner_id.is.null,owner_id.eq.${viewer.userId}`)
    .order("created_at")
    .limit(60);
  if (!items?.length) return [];

  const supabase = await createClient();
  const { data: tried } = await supabase
    .from("attempts")
    .select("item_id, correct, created_at")
    .eq("user_id", viewer.userId)
    .in(
      "item_id",
      items.map((i) => i.id),
    )
    .order("created_at", { ascending: false });
  const last = new Map<string, boolean>();
  for (const t of tried ?? []) if (!last.has(t.item_id)) last.set(t.item_id, t.correct);
  const rank = (id: string) => (!last.has(id) ? 0 : last.get(id) === false ? 1 : 2);

  return [...items]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .slice(0, PRACTICE_SET_SIZE)
    .map((i) => {
      const stem = (i.stem ?? {}) as { prompt?: string; options?: { id: string; text: string }[]; unit?: string };
      return i.type === "mcq"
        ? { id: i.id, type: "mcq" as const, prompt: stem.prompt ?? "", options: stem.options ?? [] }
        : { id: i.id, type: "numeric" as const, prompt: stem.prompt ?? "", unit: stem.unit ?? null };
    });
}

/** Topics in the student's courses and follows that have practice questions, with how many. */
export async function getPracticeTopics(
  viewer: Viewer,
): Promise<{ conceptId: string; title: string; courseId: string | null; count: number }[]> {
  const supabase = await createClient();
  const [{ data: enrolled }, { data: follows }] = await Promise.all([
    supabase.from("enrollments").select("course_id").eq("user_id", viewer.userId),
    supabase.from("concept_follows").select("concept_id").eq("user_id", viewer.userId),
  ]);
  const courseIds = (enrolled ?? []).map((e) => e.course_id);
  const { data: topics } = courseIds.length
    ? await supabase
        .from("topics")
        .select("course_id, concept_id, position")
        .in("course_id", courseIds)
        .is("archived_at", null)
        .order("position")
    : { data: [] };
  const conceptCourse = new Map<string, string | null>();
  for (const t of topics ?? [])
    if (t.concept_id && !conceptCourse.has(t.concept_id)) conceptCourse.set(t.concept_id, t.course_id);
  for (const f of follows ?? []) if (!conceptCourse.has(f.concept_id)) conceptCourse.set(f.concept_id, null);
  const ids = [...conceptCourse.keys()];
  if (!ids.length) return [];

  const [{ data: items }, { data: concepts }] = await Promise.all([
    supabase.from("items").select("concept_id").in("concept_id", ids).in("type", ["mcq", "numeric"]),
    supabase.from("concepts").select("id, title").in("id", ids),
  ]);
  const counts = new Map<string, number>();
  for (const i of items ?? []) counts.set(i.concept_id, (counts.get(i.concept_id) ?? 0) + 1);
  const titles = new Map((concepts ?? []).map((c) => [c.id, c.title]));
  return ids
    .filter((id) => (counts.get(id) ?? 0) > 0)
    .map((id) => ({
      conceptId: id,
      title: titles.get(id) ?? "Topic",
      courseId: conceptCourse.get(id) ?? null,
      count: counts.get(id)!,
    }));
}
