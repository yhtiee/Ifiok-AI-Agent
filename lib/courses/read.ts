import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextUp, type MasteryLevel } from "./path-rules";

// Reads for the Courses pages. User-scoped reads go through RLS; aggregate counts (members) use
// the service role and expose only numbers.

export async function getSubjects() {
  const supabase = await createClient();
  const { data } = await supabase.from("subjects").select("code, title").order("title");
  return data ?? [];
}

export async function getMyCourses(viewer: Viewer) {
  const supabase = await createClient();
  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("course_id, created_at, courses(id, code, title, subject, level)")
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: false });
  const courses = (enrolled ?? []).flatMap((e) => (e.courses ? [e.courses] : []));
  if (!courses.length) return [];
  const { data: topics } = await supabase
    .from("topics")
    .select("course_id")
    .in(
      "course_id",
      courses.map((c) => c.id),
    )
    .is("archived_at", null);
  const counts = new Map<string, number>();
  for (const t of topics ?? []) counts.set(t.course_id, (counts.get(t.course_id) ?? 0) + 1);
  return courses.map((c) => ({ ...c, topics: counts.get(c.id) ?? 0 }));
}

export async function getFollowedTopics(viewer: Viewer) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("concept_follows")
    .select("created_at, concepts(id, title, subject, description)")
    .eq("user_id", viewer.userId)
    .order("created_at", { ascending: false });
  return (data ?? []).flatMap((f) => (f.concepts ? [f.concepts] : []));
}

export type CourseView = NonNullable<Awaited<ReturnType<typeof getCourseView>>>;

export async function getCourseView(viewer: Viewer, courseId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title, subject, level, outline_locked, status, university_id, universities(name, short_name)")
    .eq("id", courseId)
    .maybeSingle();
  if (!course || course.status !== "active") return null;

  const [{ data: enrollment }, { count: members }, { data: topics }, { data: subject }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("role, verified")
      .eq("course_id", courseId)
      .eq("user_id", viewer.userId)
      .maybeSingle(),
    admin.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", courseId),
    supabase
      .from("topics")
      .select("id, title, week, description, position, concept_id, concepts(title, current_lesson_id)")
      .eq("course_id", courseId)
      .is("archived_at", null)
      .order("position"),
    course.subject
      ? supabase.from("subjects").select("title").eq("code", course.subject).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // History is visible to members (outline_rev_read uses is_member).
  const { data: revisions } = enrollment
    ? await supabase
        .from("outline_revisions")
        .select("id, editor_id, source, status, created_at, decided_at")
        .eq("course_id", courseId)
        .order("id", { ascending: false })
        .limit(15)
    : {
        data: [] as {
          id: number;
          editor_id: string | null;
          source: string;
          status: string;
          created_at: string;
          decided_at: string | null;
        }[],
      };

  const editorIds = [...new Set((revisions ?? []).map((r) => r.editor_id).filter((id): id is string => Boolean(id)))];
  const { data: names } = editorIds.length
    ? await supabase.from("public_profiles").select("id, display_name").in("id", editorIds)
    : { data: [] as { id: string | null; display_name: string | null }[] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.display_name]));

  const lastApplied = (revisions ?? []).find((r) => r.status === "applied");
  return {
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      level: course.level,
      subject: subject?.title ?? null,
      locked: course.outline_locked,
      university: course.universities?.name ?? null,
    },
    members: members ?? 0,
    membership: enrollment ? { role: enrollment.role, verified: enrollment.verified } : null,
    topics: (topics ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      week: t.week,
      description: t.description,
      conceptId: t.concept_id,
      conceptTitle: t.concepts?.title ?? null,
      hasLesson: Boolean(t.concepts?.current_lesson_id),
    })),
    isDraft: lastApplied?.source === "ai_draft",
    revisions: (revisions ?? []).map((r) => ({
      id: r.id,
      source: r.source,
      status: r.status,
      createdAt: r.created_at,
      editor: r.editor_id === viewer.userId ? "You" : nameOf.get(r.editor_id) || "A classmate",
      isMine: r.editor_id === viewer.userId,
    })),
  };
}

export type CourseNextUp = { conceptIds: string[]; next: { conceptId: string; title: string } | null };

/**
 * For Today (app-overhaul §5.1): each course's topic concepts and its Next up (the first topic in
 * outline order that isn't Proficient yet, the Path's rule), without the Path's lesson states.
 */
export async function getCourseNextUps(viewer: Viewer, courseIds: string[]): Promise<Map<string, CourseNextUp>> {
  const result = new Map<string, CourseNextUp>();
  if (!courseIds.length) return result;
  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("id, course_id, title, week, position, concept_id")
    .in("course_id", courseIds)
    .is("archived_at", null)
    .order("position");
  const conceptIds = [...new Set((topics ?? []).flatMap((t) => (t.concept_id ? [t.concept_id] : [])))];
  const { data: mastery } = conceptIds.length
    ? await supabase
        .from("mastery")
        .select("concept_id, level")
        .eq("user_id", viewer.userId)
        .in("concept_id", conceptIds)
    : { data: [] as { concept_id: string; level: string }[] };
  const levels = new Map((mastery ?? []).map((m) => [m.concept_id, m.level as MasteryLevel]));

  for (const id of courseIds) {
    const own = (topics ?? []).filter((t) => t.course_id === id);
    const next = nextUp(
      own.map((t) => ({
        topicId: t.id,
        title: t.title,
        week: t.week,
        conceptId: t.concept_id,
        lesson: "not_started" as const,
        fromNotes: false,
        covered: false,
        mastery: (t.concept_id && levels.get(t.concept_id)) || "not_started",
        tried: false, // "Next up" needs only the level
        practice: 0,
      })),
    );
    result.set(id, {
      conceptIds: own.flatMap((t) => (t.concept_id ? [t.concept_id] : [])),
      next: next?.conceptId ? { conceptId: next.conceptId, title: next.title } : null,
    });
  }
  return result;
}

/** The topic after `conceptId` in a course's outline order, for the lesson's finish screen. */
export async function getNextTopicInCourse(courseId: string, conceptId: string) {
  const supabase = await createClient();
  const { data: topics } = await supabase
    .from("topics")
    .select("title, concept_id")
    .eq("course_id", courseId)
    .is("archived_at", null)
    .order("position");
  const list = topics ?? [];
  const at = list.findIndex((t) => t.concept_id === conceptId);
  if (at === -1) return null;
  const next = list.slice(at + 1).find((t) => t.concept_id);
  return next?.concept_id ? { conceptId: next.concept_id, title: next.title } : null;
}

/** Whether the student follows a free-standing topic. */
export async function isFollowing(viewer: Viewer, conceptId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("concept_follows")
    .select("concept_id", { count: "exact", head: true })
    .eq("user_id", viewer.userId)
    .eq("concept_id", conceptId);
  return (count ?? 0) > 0;
}
