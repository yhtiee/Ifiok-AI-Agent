import "server-only";
import { z } from "zod";
import { getGateway, GatewayError } from "@/lib/ai";
import { embedTexts, EmbeddingError, toVector } from "@/lib/ai/embed";
import type { SchemeExtractOutput, TopicResolveOutput } from "@/lib/ai/skills/courses";
import type { ImageInput } from "@/lib/ai/types";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanTitle, conceptSlug, courseCodeNorm, formatCourseCode, levelBandFor, type LevelBand } from "./normalise";

// Student-created courses, outlines and concepts (F2-FR1–FR3, 08 §2.5b). Every write is checked
// here and done with the service role; clients can't write these tables (03 §8).

const LIMITS = { coursesPerDay: 5, conceptsPerDay: 20, outlineEditsPerDay: 10, topicsPerOutline: 60 } as const;
/** Below this similarity a topic becomes a new concept without asking the model (04 §4.5b). */
const CANDIDATE_MIN_SIMILARITY = 0.8;
const NEAR_DUPLICATE_SCORE = 0.45;

const db = () => createAdminClient();

function startOfLagosDay(): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  return new Date(`${day}T00:00:00+01:00`).toISOString();
}

function aiFailure(err: unknown): never {
  if (err instanceof GatewayError) throw new RouteError(err.status, err.message, err.code);
  if (err instanceof EmbeddingError) {
    throw new RouteError(503, "Ifiok couldn't process that just now. Try again in a minute.", "embedding_failed");
  }
  throw err;
}

// ---------------------------------------------------------------------------
// Moderation of student-written names (08 §2.5b)
// ---------------------------------------------------------------------------

export async function moderateNames(
  viewer: Viewer,
  text: string,
  context: "course_name" | "topic" | "outline",
  rejection: string,
) {
  try {
    const { output } = await getGateway().run<{ allowed: boolean }>("moderate", {
      userId: viewer.userId,
      input: { text: text.slice(0, 2000), context },
    });
    if (!output.allowed) throw new RouteError(422, rejection, "name_blocked");
  } catch (err) {
    if (err instanceof RouteError) throw err;
    aiFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Topics → concepts (F2-FR3, 04 §4.5b)
// ---------------------------------------------------------------------------

export type TopicInput = { key: string; title: string; description?: string | null };
export type ResolvedTopic = { key: string; conceptId: string; created: boolean } | { key: string; tooBroad: string[] };

type Candidate = { id: string; title: string; description: string | null; similarity: number; subject: string };

export async function resolveTopics(params: {
  viewer: Viewer;
  topics: TopicInput[];
  subject: string | null;
  levelBand: LevelBand;
  course: { code: string; title: string } | null;
}): Promise<ResolvedTopic[]> {
  const { viewer, topics, subject, levelBand, course } = params;
  if (topics.length === 0) return [];
  const admin = db();

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(topics.map((t) => (t.description ? `${t.title}. ${t.description}` : t.title)));
  } catch (err) {
    aiFailure(err);
  }

  // Candidates: nearest concepts in the same subject and level band (any subject if none given).
  const candidateLists: Candidate[][] = await Promise.all(
    embeddings.map(async (embedding) => {
      const { data, error } = await admin.rpc("match_concepts", {
        p_embedding: toVector(embedding),
        // SQL null = search every subject (free-standing topics); the generated type can't express it.
        p_subject: subject as string,
        p_level_band: levelBand,
        p_limit: 5,
      });
      if (error) throw new Error("Couldn't search concepts");
      return (data ?? []).filter((c) => c.similarity >= CANDIDATE_MIN_SIMILARITY);
    }),
  );

  const results = new Map<string, ResolvedTopic>();
  const needModel: number[] = [];
  topics.forEach((topic, i) => {
    // Free shortcut: an existing concept with exactly this title (same subject and band) is the same idea.
    const exact = candidateLists[i]!.find((c) => c.title.trim().toLowerCase() === topic.title.trim().toLowerCase());
    if (exact) results.set(topic.key, { key: topic.key, conceptId: exact.id, created: false });
    else needModel.push(i);
  });

  if (needModel.length) {
    const { data: subjects } = await admin.from("subjects").select("code, title").order("code");
    const subjectCodes = new Set((subjects ?? []).map((s) => s.code));
    let createdToday = await countConceptsCreatedToday(viewer.userId);

    for (let start = 0; start < needModel.length; start += 15) {
      const batch = needModel.slice(start, start + 15);
      let output: TopicResolveOutput;
      try {
        ({ output } = await getGateway().run<TopicResolveOutput>("topic_resolve", {
          userId: viewer.userId,
          input: {
            level_band: levelBand,
            course,
            subject,
            subjects: subjects ?? [],
            topics: batch.map((i) => ({
              key: topics[i]!.key,
              title: topics[i]!.title,
              description: topics[i]!.description ?? null,
              candidates: candidateLists[i]!.map((c) => ({
                id: c.id,
                title: c.title,
                description: c.description,
                similarity: c.similarity,
              })),
            })),
          },
        }));
      } catch (err) {
        aiFailure(err);
      }

      for (const i of batch) {
        const topic = topics[i]!;
        const result = output.results.find((r) => r.key === topic.key);
        const allowedIds = new Set(candidateLists[i]!.map((c) => c.id));
        if (result?.match && allowedIds.has(result.match)) {
          results.set(topic.key, { key: topic.key, conceptId: result.match, created: false });
        } else if (result?.too_broad?.length) {
          results.set(topic.key, { key: topic.key, tooBroad: result.too_broad.slice(0, 6) });
        } else {
          // New concept (also the safe fallback when the model's reply is unusable for this topic).
          if (createdToday >= LIMITS.conceptsPerDay) {
            throw new RouteError(
              429,
              "You've added the most new topics allowed today. Try again tomorrow.",
              "concept_limit",
            );
          }
          const fresh = result?.new;
          const conceptSubject = subject ?? (fresh && subjectCodes.has(fresh.subject) ? fresh.subject : "other");
          const title = cleanTitle(fresh?.title ?? topic.title, 80);
          const { data: conceptId, error } = await admin.rpc("create_concept", {
            p_slug: conceptSlug(conceptSubject, title),
            p_title: title,
            p_subject: conceptSubject,
            p_level_band: levelBand,
            p_description: fresh?.description ?? topic.description ?? "",
            p_micro_skills: fresh?.micro_skills ?? [],
            p_prerequisite_hints: fresh?.prerequisites ?? [],
            p_embedding: toVector(embeddings[i]!),
            p_created_by: viewer.userId,
          });
          if (error || !conceptId) throw new Error("Couldn't create the concept");
          createdToday++;
          results.set(topic.key, { key: topic.key, conceptId, created: true });
        }
      }
    }
  }

  return topics.map((t) => results.get(t.key)!);
}

async function countConceptsCreatedToday(userId: string) {
  const { count } = await db()
    .from("concepts")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId)
    .gte("created_at", startOfLagosDay());
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Courses (F2-FR1)
// ---------------------------------------------------------------------------

export type CourseSummary = {
  id: string;
  code: string;
  title: string;
  subject: string | null;
  level: number | null;
  members: number;
};

export async function searchCourses(viewer: Viewer, query: string): Promise<CourseSummary[]> {
  if (!viewer.profile.university_id) return [];
  const { data, error } = await db().rpc("search_courses", {
    p_university: viewer.profile.university_id,
    p_query: query.slice(0, 80),
    p_limit: 8,
  });
  if (error) throw new Error("Couldn't search courses");
  return (data ?? []).map(({ id, code, title, subject, level, members }) => ({
    id,
    code,
    title,
    subject,
    level,
    members: Number(members),
  }));
}

export const createCourseInput = z.object({
  code: z.string().min(2).max(20),
  title: z.string().min(3).max(120),
  subject: z.string().min(2).max(40),
  level: z.number().int().min(100).max(900).nullable().optional(),
  /** The student saw the similar courses and still wants a new one. */
  confirmNew: z.boolean().optional(),
});

export type CreateCourseResult =
  | { status: "created"; course: CourseSummary }
  | { status: "exists"; course: CourseSummary }
  | { status: "similar"; candidates: CourseSummary[] };

export async function createCourse(
  viewer: Viewer,
  input: z.infer<typeof createCourseInput>,
): Promise<CreateCourseResult> {
  const universityId = viewer.profile.university_id;
  if (!universityId) {
    throw new RouteError(
      422,
      "Courses belong to a university. Add yours in Me, or learn this as a topic instead.",
      "no_university",
    );
  }
  const code = formatCourseCode(input.code);
  if (!code)
    throw new RouteError(422, "Enter the course code as it appears on your timetable, like MTH 101.", "bad_code");
  const title = cleanTitle(input.title, 120);
  const admin = db();

  const { data: subject } = await admin.from("subjects").select("code").eq("code", input.subject).maybeSingle();
  if (!subject) throw new RouteError(422, "Pick the subject from the list.", "bad_subject");

  // Same code at this university: offer that course instead of a duplicate.
  const { data: existing } = await admin
    .from("courses")
    .select("id, code, title, subject, level")
    .eq("university_id", universityId)
    .eq("code_norm", courseCodeNorm(code))
    .maybeSingle();
  if (existing) return { status: "exists", course: { ...existing, members: await memberCount(existing.id) } };

  // A course with a similar title at this university: show it first (it may be the same course).
  if (!input.confirmNew) {
    const { data: similar } = await admin.rpc("search_courses", {
      p_university: universityId,
      p_query: title,
      p_limit: 5,
    });
    const strong = (similar ?? []).filter((c) => c.score >= NEAR_DUPLICATE_SCORE);
    if (strong.length) {
      return {
        status: "similar",
        candidates: strong.map(({ id, code: c, title: t, subject: s, level, members }) => ({
          id,
          code: c,
          title: t,
          subject: s,
          level,
          members: Number(members),
        })),
      };
    }
  }

  const { count } = await admin
    .from("courses")
    .select("*", { count: "exact", head: true })
    .eq("created_by", viewer.userId)
    .gte("created_at", startOfLagosDay());
  if ((count ?? 0) >= LIMITS.coursesPerDay) {
    throw new RouteError(429, "You've added the most courses allowed today. Try again tomorrow.", "course_limit");
  }

  await moderateNames(
    viewer,
    `${code} ${title}`,
    "course_name",
    "That course name can't be used. Use the code and title as they appear on your timetable.",
  );

  const { data: course, error } = await admin
    .from("courses")
    .insert({
      university_id: universityId,
      code,
      title,
      subject: input.subject,
      level: input.level ?? viewer.profile.level ?? null,
      created_by: viewer.userId,
    })
    .select("id, code, title, subject, level")
    .single();
  if (error) {
    // Someone else created it a moment ago: offer theirs.
    if (error.code === "23505") {
      const { data: theirs } = await admin
        .from("courses")
        .select("id, code, title, subject, level")
        .eq("university_id", universityId)
        .eq("code_norm", courseCodeNorm(code))
        .single();
      if (theirs) return { status: "exists", course: { ...theirs, members: await memberCount(theirs.id) } };
    }
    throw new Error("Couldn't create the course");
  }
  await admin.from("enrollments").insert({ user_id: viewer.userId, course_id: course.id });
  return { status: "created", course: { ...course, members: 1 } };
}

async function memberCount(courseId: string) {
  const { count } = await db()
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);
  return count ?? 0;
}

export async function joinCourse(viewer: Viewer, courseId: string) {
  // Under RLS: enroll_insert_self allows a student enrolling themselves (03 §8).
  const supabase = await createClient();
  const { error } = await supabase.from("enrollments").insert({ user_id: viewer.userId, course_id: courseId });
  if (error && error.code !== "23505") throw new RouteError(404, "That course doesn't exist any more.", "not_found");
}

export async function leaveCourse(viewer: Viewer, courseId: string) {
  const supabase = await createClient();
  await supabase.from("enrollments").delete().eq("user_id", viewer.userId).eq("course_id", courseId);
}

// ---------------------------------------------------------------------------
// Outlines (F2-FR2, 08 §2.5b)
// ---------------------------------------------------------------------------

export const outlineTopicInput = z.object({
  topic_id: z.uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  week: z.number().int().min(1).max(30).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
});

export const saveOutlineInput = z.object({
  source: z.enum(["upload", "typed", "ai_draft", "edit"]),
  topics: z.array(outlineTopicInput).min(1).max(LIMITS.topicsPerOutline),
});

type OutlineEntry = {
  topic_id?: string | null;
  concept_id: string;
  title: string;
  week?: number | null;
  description?: string | null;
};

export type SaveOutlineResult =
  | { status: "applied" | "pending"; revisionId: number }
  | { status: "too_broad"; topics: { index: number; title: string; suggestions: string[] }[] };

async function loadCourseForEdit(viewer: Viewer, courseId: string) {
  const admin = db();
  const [{ data: course }, { data: enrollment }] = await Promise.all([
    admin
      .from("courses")
      .select("id, code, title, subject, level, outline_locked, status")
      .eq("id", courseId)
      .maybeSingle(),
    admin
      .from("enrollments")
      .select("role, verified, created_at")
      .eq("course_id", courseId)
      .eq("user_id", viewer.userId)
      .maybeSingle(),
  ]);
  if (!course || course.status !== "active")
    throw new RouteError(404, "That course doesn't exist any more.", "not_found");
  if (!enrollment) throw new RouteError(403, "Join the course to edit its outline.", "not_member");
  const canLock = (enrollment.role === "lecturer" || enrollment.role === "rep") && enrollment.verified;
  if (course.outline_locked && !canLock) {
    throw new RouteError(403, "This outline is locked by your lecturer or course rep.", "locked");
  }
  return { course, enrollment, canLock };
}

/**
 * Whether an edit applies at once or waits for another member to confirm (08 §2.5b): edits from
 * members enrolled < 3 days or with < 3 study sessions wait, unless the course has no outline yet
 * or the editor is its only member (nothing to vandalise). Lecturers and reps always apply.
 */
async function editNeedsConfirmation(viewer: Viewer, courseId: string, enrolledAt: string, trusted: boolean) {
  if (trusted) return false;
  const admin = db();
  const [{ count: applied }, { count: members }, { data: activity }] = await Promise.all([
    admin
      .from("outline_revisions")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "applied"),
    admin.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", courseId),
    admin.from("daily_activity").select("sessions").eq("user_id", viewer.userId),
  ]);
  if ((applied ?? 0) === 0 || (members ?? 0) <= 1) return false;
  const sessions = (activity ?? []).reduce((sum, r) => sum + r.sessions, 0);
  const enrolledDays = (Date.now() - new Date(enrolledAt).getTime()) / 86_400_000;
  return enrolledDays < 3 || sessions < 3;
}

export async function saveOutline(
  viewer: Viewer,
  courseId: string,
  input: z.infer<typeof saveOutlineInput>,
): Promise<SaveOutlineResult> {
  const { course, enrollment, canLock } = await loadCourseForEdit(viewer, courseId);
  const admin = db();

  const { count: editsToday } = await admin
    .from("outline_revisions")
    .select("*", { count: "exact", head: true })
    .eq("editor_id", viewer.userId)
    .gte("created_at", startOfLagosDay());
  if ((editsToday ?? 0) >= LIMITS.outlineEditsPerDay) {
    throw new RouteError(429, "You've made the most outline edits allowed today. Try again tomorrow.", "edit_limit");
  }

  const topics = input.topics.map((t) => ({
    ...t,
    title: cleanTitle(t.title),
    description: t.description?.trim() || null,
  }));
  await moderateNames(
    viewer,
    topics.map((t) => t.title).join("\n"),
    "outline",
    "Some topic names can't be used. Keep only real topics from your course.",
  );

  // Keep the concept of topics whose title didn't change; resolve the rest.
  const { data: current } = await admin.from("topics").select("id, title, concept_id").eq("course_id", courseId);
  const byId = new Map((current ?? []).map((t) => [t.id, t]));
  const toResolve: TopicInput[] = [];
  const entries: (OutlineEntry | null)[] = topics.map((t, i) => {
    const existing = t.topic_id ? byId.get(t.topic_id) : undefined;
    if (existing && existing.title.toLowerCase() === t.title.toLowerCase()) {
      return {
        topic_id: existing.id,
        concept_id: existing.concept_id,
        title: t.title,
        week: t.week ?? null,
        description: t.description,
      };
    }
    toResolve.push({ key: String(i), title: t.title, description: t.description });
    return null;
  });

  const { data: bands } = await admin.from("app_config").select("value").eq("key", "level_bands").maybeSingle();
  const resolved = await resolveTopics({
    viewer,
    topics: toResolve,
    subject: course.subject,
    levelBand: levelBandFor(course.level, (bands?.value ?? {}) as Record<string, string>),
    course: { code: course.code, title: course.title },
  });

  const tooBroad = resolved.filter((r): r is Extract<ResolvedTopic, { tooBroad: string[] }> => "tooBroad" in r);
  if (tooBroad.length) {
    return {
      status: "too_broad",
      topics: tooBroad.map((r) => ({
        index: Number(r.key),
        title: topics[Number(r.key)]!.title,
        suggestions: r.tooBroad,
      })),
    };
  }
  for (const r of resolved) {
    if ("conceptId" in r) {
      const t = topics[Number(r.key)]!;
      entries[Number(r.key)] = {
        topic_id: t.topic_id && byId.has(t.topic_id) ? t.topic_id : null,
        concept_id: r.conceptId,
        title: t.title,
        week: t.week ?? null,
        description: t.description,
      };
    }
  }

  const outline = entries as OutlineEntry[];
  const pending = await editNeedsConfirmation(viewer, courseId, enrollment.created_at, canLock);
  const { data: revision, error } = await admin
    .from("outline_revisions")
    .insert({
      course_id: courseId,
      editor_id: viewer.userId,
      source: input.source,
      outline,
      status: pending ? "pending" : "applied",
    })
    .select("id")
    .single();
  if (error || !revision) throw new Error("Couldn't save the outline");

  if (!pending) {
    const { error: applyError } = await admin.rpc("apply_outline", { p_course: courseId, p_topics: outline });
    if (applyError) throw new Error("Couldn't apply the outline");
  }
  return { status: pending ? "pending" : "applied", revisionId: revision.id };
}

/** Confirm or reject a pending edit (another member), or revert to an earlier applied version. */
export async function decideRevision(
  viewer: Viewer,
  courseId: string,
  revisionId: number,
  action: "confirm" | "reject" | "revert",
): Promise<{ status: "applied" | "pending" | "rejected"; revisionId: number }> {
  const { enrollment, canLock } = await loadCourseForEdit(viewer, courseId);
  const admin = db();
  const { data: revision } = await admin
    .from("outline_revisions")
    .select("id, editor_id, status, outline")
    .eq("id", revisionId)
    .eq("course_id", courseId)
    .maybeSingle();
  if (!revision) throw new RouteError(404, "That version doesn't exist.", "not_found");

  if (action === "revert") {
    if (revision.status !== "applied")
      throw new RouteError(422, "Only versions that were in use can be restored.", "bad_state");
    const pending = await editNeedsConfirmation(viewer, courseId, enrollment.created_at, canLock);
    const { data: created, error } = await admin
      .from("outline_revisions")
      .insert({
        course_id: courseId,
        editor_id: viewer.userId,
        source: "revert",
        outline: revision.outline,
        status: pending ? "pending" : "applied",
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("Couldn't restore the outline");
    if (!pending) await admin.rpc("apply_outline", { p_course: courseId, p_topics: revision.outline });
    return { status: pending ? "pending" : "applied", revisionId: created.id };
  }

  if (revision.status !== "pending") throw new RouteError(422, "That edit was already decided.", "bad_state");
  if (revision.editor_id === viewer.userId) {
    throw new RouteError(403, "Another member of the course needs to check your edit.", "own_edit");
  }
  const status = action === "confirm" ? "applied" : "rejected";
  const { error } = await admin
    .from("outline_revisions")
    .update({ status, decided_by: viewer.userId, decided_at: new Date().toISOString() })
    .eq("id", revisionId)
    .eq("status", "pending");
  if (error) throw new Error("Couldn't update the edit");
  if (status === "applied") await admin.rpc("apply_outline", { p_course: courseId, p_topics: revision.outline });
  return { status, revisionId };
}

// ---------------------------------------------------------------------------
// Outline from an AI draft or a photo/PDF: returned for the student to check, not saved
// ---------------------------------------------------------------------------

export async function draftOutline(viewer: Viewer, courseId: string) {
  const { course } = await loadCourseForEdit(viewer, courseId);
  const admin = db();
  const [{ data: university }, { data: subject }] = await Promise.all([
    viewer.profile.university_id
      ? admin.from("universities").select("name").eq("id", viewer.profile.university_id).maybeSingle()
      : Promise.resolve({ data: null }),
    course.subject
      ? admin.from("subjects").select("title").eq("code", course.subject).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  try {
    const { output } = await getGateway().run<{ topics: { week: number; title: string; description: string }[] }>(
      "outline_draft",
      {
        userId: viewer.userId,
        input: {
          course_code: course.code,
          course_title: course.title,
          level: course.level,
          university: university?.name ?? null,
          subject: subject?.title ?? null,
        },
      },
    );
    return output.topics;
  } catch (err) {
    aiFailure(err);
  }
}

export const OUTLINE_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const OUTLINE_FILE_MAX_BYTES = 8 * 1024 * 1024;

export async function extractOutline(viewer: Viewer, courseId: string, file: ImageInput) {
  const { course } = await loadCourseForEdit(viewer, courseId);
  try {
    const { output } = await getGateway().run<SchemeExtractOutput>("scheme_extract", {
      userId: viewer.userId,
      input: { course_code: course.code, course_title: course.title },
      images: [file],
    });
    return output;
  } catch (err) {
    aiFailure(err);
  }
}

// ---------------------------------------------------------------------------
// Free-standing topics (F2-FR1 "a topic", /api/learn)
// ---------------------------------------------------------------------------

export type LearnResult =
  | { status: "following"; concept: { id: string; title: string; subject: string } }
  | { status: "too_broad"; suggestions: string[] };

export async function learnTopic(viewer: Viewer, rawTopic: string): Promise<LearnResult> {
  const title = cleanTitle(rawTopic, 120);
  if (title.length < 2) throw new RouteError(422, "Type the topic you want to learn.", "empty");
  await moderateNames(
    viewer,
    title,
    "topic",
    "That topic can't be used. Try the name of a real topic you're studying.",
  );

  const admin = db();
  const { data: bands } = await admin.from("app_config").select("value").eq("key", "level_bands").maybeSingle();
  const [resolved] = await resolveTopics({
    viewer,
    topics: [{ key: "0", title }],
    subject: null,
    levelBand: levelBandFor(viewer.profile.level, (bands?.value ?? {}) as Record<string, string>),
    course: null,
  });
  if (!resolved) throw new Error("Topic resolution returned nothing");
  if ("tooBroad" in resolved) return { status: "too_broad", suggestions: resolved.tooBroad };

  const supabase = await createClient();
  const { error } = await supabase
    .from("concept_follows")
    .insert({ user_id: viewer.userId, concept_id: resolved.conceptId });
  if (error && error.code !== "23505") throw new Error("Couldn't follow the topic");
  const { data: concept } = await admin
    .from("concepts")
    .select("id, title, subject")
    .eq("id", resolved.conceptId)
    .single();
  return { status: "following", concept: concept! };
}
