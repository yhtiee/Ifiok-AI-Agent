import "server-only";
import { z } from "zod";
import { lagosDay } from "@ifiok/core";
import type { WorkedSolutionOutput } from "@ifiok/core/ai/skills/exam";
import { QTYPES } from "@ifiok/core/ai/skills/exam";
import { engineValue } from "@ifiok/core/items/check";
import { numericMatches } from "@ifiok/core/dsl/numeric";
import type { ExamDraft } from "@ifiok/core/jobs/exam-extract";
import { buildPlan, type PlanLevel, type Session, type StudyPlan } from "@/lib/agent/planner";
import { getGateway, GatewayError } from "@/lib/ai";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { privateLessonRepo } from "@/lib/lessons/private";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { examPatterns, type ExamPatterns } from "./patterns";

// Exam prep for a course (10 MVP-04, F8, light F6). Past questions are saved only after the student
// reviews the extraction, and are shared with the course's members (12 §4 Q53); only the questions
// and their statistics, never the file or the student's notes. Every screen speaks in counts and
// shares, never predictions (guardrail 13). Worked solutions are generated once per question and
// shared in the course; their final numbers are checked by the engine or labelled unchecked.

async function requireMember(viewer: Viewer, courseId: string) {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, code, title").eq("id", courseId).maybeSingle();
  if (!course) throw new RouteError(404, "That course doesn't exist any more.", "not_found");
  const { data: enrolled } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("course_id", courseId)
    .eq("user_id", viewer.userId)
    .maybeSingle();
  if (!enrolled) throw new RouteError(403, "Join the course to use its exam prep.", "not_member");
  return course;
}

// ---------------------------------------------------------------------------
// Reading: papers, patterns, pending reviews, the plan
// ---------------------------------------------------------------------------

export type ExamQuestionView = {
  id: string;
  paper: string;
  year: number | null;
  number: string | null;
  sub: string | null;
  text: string;
  marks: number | null;
  qtype: string | null;
  conceptId: string | null;
  itemId: string | null;
  hasSolution: boolean;
};

export type PendingPaper = { sourceId: string; title: string; status: "reading" | "review" | "failed"; found: number };

export type ExamPrep = {
  course: { id: string; code: string; title: string };
  topics: { conceptId: string; title: string }[];
  questions: ExamQuestionView[];
  patterns: ExamPatterns;
  pending: PendingPaper[];
  plan: (StudyPlan & { dailyMinutes: number }) | null;
};

export async function getExamPrep(viewer: Viewer, courseId: string): Promise<ExamPrep> {
  const course = await requireMember(viewer, courseId);
  const supabase = await createClient();
  const [{ data: topicRows }, { data: rows }, { data: jobs }, { data: planRow }] = await Promise.all([
    supabase
      .from("topics")
      .select("concept_id, title, position")
      .eq("course_id", courseId)
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("exam_questions")
      .select(
        "id, source_id, year, number, sub, text_latex, marks, qtype, concept_id, item_id, worked_solution, created_at",
      )
      .eq("course_id", courseId)
      .order("year", { ascending: false })
      .order("number"),
    supabase
      .from("jobs")
      .select("status, result, payload, created_at")
      .eq("queue", "exam_extract")
      .eq("owner_id", viewer.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("exam_plans")
      .select("exam_date")
      .eq("user_id", viewer.userId)
      .eq("course_id", courseId)
      .maybeSingle(),
  ]);
  const topics = (topicRows ?? []).flatMap((t) => (t.concept_id ? [{ conceptId: t.concept_id, title: t.title }] : []));
  const questions: ExamQuestionView[] = (rows ?? []).map((q) => ({
    id: q.id,
    paper: q.source_id,
    year: q.year,
    number: q.number,
    sub: q.sub,
    text: q.text_latex,
    marks: q.marks === null ? null : Number(q.marks),
    qtype: q.qtype,
    conceptId: q.concept_id,
    itemId: q.item_id,
    hasSolution: q.worked_solution !== null,
  }));
  const patterns = examPatterns(
    questions.map((q) => ({ paper: q.paper, year: q.year, conceptId: q.conceptId, marks: q.marks, qtype: q.qtype })),
  );

  // Papers this student uploaded for this course that are being read or wait for review.
  const saved = new Set(questions.map((q) => q.paper));
  const pendingJobs = (jobs ?? []).filter((j) => {
    const p = j.payload as { course_id?: string; source_id?: string } | null;
    return p?.course_id === courseId && p.source_id && !saved.has(p.source_id);
  });
  const sourceIds = [...new Set(pendingJobs.map((j) => (j.payload as { source_id: string }).source_id))];
  const { data: sources } = sourceIds.length
    ? await supabase.from("sources").select("id, title").in("id", sourceIds)
    : { data: [] };
  const titles = new Map((sources ?? []).map((s) => [s.id, s.title]));
  const pending: PendingPaper[] = [];
  for (const id of sourceIds) {
    if (!titles.has(id)) continue; // deleted since
    const j = pendingJobs.find((x) => (x.payload as { source_id: string }).source_id === id)!;
    const draft = (j.result as { draft?: ExamDraft } | null)?.draft;
    pending.push({
      sourceId: id,
      title: titles.get(id)!,
      status: j.status === "failed" ? "failed" : draft ? "review" : "reading",
      found: draft?.questions.length ?? 0,
    });
  }

  const plan = planRow ? await computePlan(viewer, courseId, planRow.exam_date, topics, questions, patterns) : null;
  return { course, topics, questions, patterns, pending, plan };
}

// ---------------------------------------------------------------------------
// Review: the draft and saving it
// ---------------------------------------------------------------------------

export async function getDraft(viewer: Viewer, courseId: string, sourceId: string) {
  const course = await requireMember(viewer, courseId);
  const supabase = await createClient();
  const [{ data: source }, { data: job }, { data: topicRows }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, kind, course_id")
      .eq("id", sourceId)
      .eq("owner_id", viewer.userId)
      .maybeSingle(),
    supabase
      .from("jobs")
      .select("id, status, result")
      .eq("queue", "exam_extract")
      .eq("dedupe_key", `exam:${sourceId}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("topics")
      .select("concept_id, title")
      .eq("course_id", courseId)
      .is("archived_at", null)
      .order("position"),
  ]);
  if (!source || source.kind !== "past_paper" || source.course_id !== courseId) {
    throw new RouteError(404, "Those past questions aren't here any more.", "not_found");
  }
  return {
    course,
    source: { id: source.id, title: source.title },
    jobId: job?.id ?? null,
    status: (job?.status ?? "queued") as string,
    draft: ((job?.result as { draft?: ExamDraft } | null)?.draft ?? null) as ExamDraft | null,
    topics: (topicRows ?? []).flatMap((t) => (t.concept_id ? [{ conceptId: t.concept_id, title: t.title }] : [])),
  };
}

export const savePaperBody = z.object({
  source_id: z.string().uuid(),
  year: z.number().int().min(1950).max(2100).nullable(),
  questions: z
    .array(
      z.object({
        number: z.string().trim().min(1).max(20),
        sub: z.string().trim().max(20).nullable(),
        text: z.string().trim().min(3, "a question needs its text").max(4000),
        marks: z.number().min(0).max(200).nullable(),
        qtype: z.enum(QTYPES),
        concept_id: z.string().uuid().nullable(),
      }),
    )
    .min(1, "keep at least one question")
    .max(80),
});

/**
 * Saves the reviewed questions (replacing this student's earlier save of the same paper). Each
 * question with a topic also becomes a self-marked practice item for the course's members.
 */
export async function savePaper(viewer: Viewer, courseId: string, body: z.infer<typeof savePaperBody>) {
  await requireMember(viewer, courseId);
  const admin = createAdminClient();
  const [{ data: source }, { data: topicRows }] = await Promise.all([
    admin.from("sources").select("owner_id, course_id, kind").eq("id", body.source_id).maybeSingle(),
    admin.from("topics").select("concept_id").eq("course_id", courseId).is("archived_at", null),
  ]);
  if (!source || source.owner_id !== viewer.userId || source.kind !== "past_paper" || source.course_id !== courseId) {
    throw new RouteError(404, "Those past questions aren't here any more.", "not_found");
  }
  const allowed = new Set((topicRows ?? []).flatMap((t) => (t.concept_id ? [t.concept_id] : [])));
  for (const q of body.questions) {
    if (q.concept_id && !allowed.has(q.concept_id)) {
      throw new RouteError(422, "A question is tagged to a topic that isn't in this course's outline.", "bad_topic");
    }
  }

  // Replace an earlier save of this paper (its items go with it).
  const { data: old } = await admin.from("exam_questions").select("item_id").eq("source_id", body.source_id);
  await admin.from("exam_questions").delete().eq("source_id", body.source_id);
  const oldItems = (old ?? []).flatMap((q) => (q.item_id ? [q.item_id] : []));
  if (oldItems.length) await admin.from("items").delete().in("id", oldItems);

  const withTopic = body.questions.filter((q) => q.concept_id);
  const { data: items, error: itemError } = withTopic.length
    ? await admin
        .from("items")
        .insert(
          withTopic.map((q) => ({
            concept_id: q.concept_id!,
            course_id: courseId,
            owner_id: null,
            type: "short_text" as const,
            difficulty: q.marks !== null && q.marks >= 10 ? 3 : 2,
            stem: { prompt: q.text, marks: q.marks, qtype: q.qtype } as Json,
            answer: {} as Json,
            verification: { type: "self_marked" } as Json,
            origin: "past_paper",
            source_id: body.source_id,
            contributor_id: viewer.userId,
            status: "published" as const,
          })),
        )
        .select("id")
    : { data: [], error: null };
  if (itemError)
    throw new RouteError(503, "Ifiok couldn't save these questions. Try again in a minute.", "save_failed");

  let next = 0;
  const { error } = await admin.from("exam_questions").insert(
    body.questions.map((q) => ({
      course_id: courseId,
      source_id: body.source_id,
      year: body.year,
      number: q.number,
      sub: q.sub,
      text_latex: q.text,
      marks: q.marks,
      qtype: q.qtype,
      concept_id: q.concept_id,
      concept_confidence: q.concept_id ? 1 : null,
      item_id: q.concept_id ? (items?.[next++]?.id ?? null) : null,
      added_by: viewer.userId,
    })),
  );
  if (error) throw new RouteError(503, "Ifiok couldn't save these questions. Try again in a minute.", "save_failed");
  return { saved: body.questions.length, unassigned: body.questions.length - withTopic.length };
}

// ---------------------------------------------------------------------------
// The study plan to the exam date
// ---------------------------------------------------------------------------

export const examDateBody = z.object({ exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export async function setExamDate(viewer: Viewer, courseId: string, examDate: string) {
  await requireMember(viewer, courseId);
  const today = lagosDay();
  if (examDate <= today) throw new RouteError(422, "Pick a date after today.", "past_date");
  const admin = createAdminClient();
  const { error } = await admin
    .from("exam_plans")
    .upsert({ user_id: viewer.userId, course_id: courseId, exam_date: examDate, updated_at: new Date().toISOString() });
  if (error) throw new RouteError(503, "Ifiok couldn't save the exam date. Try again in a minute.", "save_failed");
}

/** Recomputed on every read from the student's current mastery (deterministic), then stored. */
/** The stored level, or "getting_started" for a tried topic still below Familiar (12 §4 Q54). */
function planLevel(m: { level: string; attempts_count: number } | undefined): PlanLevel {
  if (!m) return "not_started";
  return m.level === "not_started" && m.attempts_count > 0 ? "getting_started" : (m.level as PlanLevel);
}

async function computePlan(
  viewer: Viewer,
  courseId: string,
  examDate: string,
  topics: { conceptId: string; title: string }[],
  questions: ExamQuestionView[],
  patterns: ExamPatterns,
): Promise<StudyPlan & { dailyMinutes: number }> {
  const supabase = await createClient();
  const conceptIds = topics.map((t) => t.conceptId);
  const [{ data: mastery }, { data: items }] = await Promise.all([
    conceptIds.length
      ? supabase
          .from("mastery")
          .select("concept_id, m, level, attempts_count")
          .eq("user_id", viewer.userId)
          .in("concept_id", conceptIds)
      : Promise.resolve({ data: [] }),
    conceptIds.length
      ? supabase.from("items").select("concept_id").in("concept_id", conceptIds).in("type", ["mcq", "numeric"])
      : Promise.resolve({ data: [] }),
  ]);
  const levels = new Map((mastery ?? []).map((m) => [m.concept_id, m]));
  const practice = new Map<string, number>();
  for (const i of items ?? []) practice.set(i.concept_id, (practice.get(i.concept_id) ?? 0) + 1);
  const past = new Map<string, number>();
  for (const q of questions) if (q.conceptId && q.itemId) past.set(q.conceptId, (past.get(q.conceptId) ?? 0) + 1);
  const shares = new Map(patterns.topics.map((t) => [t.conceptId, t]));

  const dailyMinutes = viewer.profile.daily_minutes ?? 30;
  const plan = buildPlan({
    today: lagosDay(),
    examDate,
    dailyMinutes,
    papers: patterns.papers,
    topics: topics.map((t) => ({
      conceptId: t.conceptId,
      title: t.title,
      share: patterns.papers ? (shares.get(t.conceptId)?.share ?? 0) : null,
      asked: shares.get(t.conceptId)?.asked ?? 0,
      m: Number(levels.get(t.conceptId)?.m ?? 0),
      level: planLevel(levels.get(t.conceptId)),
      practice: practice.get(t.conceptId) ?? 0,
      pastQuestions: past.get(t.conceptId) ?? 0,
    })),
  });
  await createAdminClient()
    .from("exam_plans")
    .update({ plan: plan as unknown as Json, updated_at: new Date().toISOString() })
    .eq("user_id", viewer.userId)
    .eq("course_id", courseId);
  return { ...plan, dailyMinutes };
}

// ---------------------------------------------------------------------------
// Worked solutions (generated once per question, shared in the course)
// ---------------------------------------------------------------------------

export type TodayStudy = {
  courseId: string;
  code: string;
  examDate: string;
  daysLeft: number;
  sessions: Session[];
};

/**
 * Today's study-plan sessions for each course with an upcoming exam (MVP-03 Today, 10 MVP-04),
 * rebuilt from current mastery like the plan itself. At most 2 courses, soonest exam first.
 */
export async function getTodayStudy(viewer: Viewer): Promise<TodayStudy[]> {
  const supabase = await createClient();
  const today = lagosDay();
  const { data: plans } = await supabase
    .from("exam_plans")
    .select("course_id, exam_date")
    .eq("user_id", viewer.userId)
    .gt("exam_date", today)
    .order("exam_date")
    .limit(2);
  const out: TodayStudy[] = [];
  for (const p of plans ?? []) {
    const prep = await getExamPrep(viewer, p.course_id).catch(() => null);
    const day = prep?.plan?.days.find((d) => d.date === today);
    if (!prep?.plan || !day?.sessions.length) continue;
    out.push({
      courseId: p.course_id,
      code: prep.course.code,
      examDate: prep.plan.examDate,
      daysLeft: prep.plan.days.length,
      sessions: day.sessions,
    });
  }
  return out;
}

export type WorkedSolution = {
  steps: { text: string; latex: string | null }[];
  final: { text: string; stated: number | null; unit: string | null };
  /** The engine re-computed the final number and it matched; false = "unchecked". */
  checked: boolean;
};

export async function getWorkedSolution(viewer: Viewer, questionId: string): Promise<WorkedSolution> {
  const admin = createAdminClient();
  const { data: q } = await admin
    .from("exam_questions")
    .select("id, course_id, text_latex, marks, qtype, concept_id, worked_solution")
    .eq("id", questionId)
    .maybeSingle();
  if (!q) throw new RouteError(404, "That question isn't here any more.", "not_found");
  await requireMember(viewer, q.course_id);
  if (q.worked_solution) return q.worked_solution as unknown as WorkedSolution;

  // Ground it in the asking student's notes on the topic when they have them, else shared material.
  let chunks: { id: number; content: string }[] = [];
  let topic: string | null = null;
  if (q.concept_id) {
    const priv = privateLessonRepo();
    const [cfg, { data: concept }] = await Promise.all([
      priv.config(),
      admin.from("concepts").select("title").eq("id", q.concept_id).maybeSingle(),
    ]);
    topic = concept?.title ?? null;
    chunks = (await priv.sources({ userId: viewer.userId, courseId: q.course_id }, q.concept_id, cfg)).slice(0, 6);
    if (!chunks.length) {
      const { data } = await admin.rpc("shared_lesson_sources", { p_concept: q.concept_id, p_limit: 6 });
      chunks = (data ?? []).map((c) => ({ id: Number(c.id), content: c.content }));
    }
  }

  let output: WorkedSolutionOutput;
  try {
    ({ output } = await getGateway().run<WorkedSolutionOutput>("worked_solution", {
      userId: viewer.userId,
      input: {
        question: q.text_latex,
        marks: q.marks === null ? null : Number(q.marks),
        qtype: (q.qtype as (typeof QTYPES)[number] | null) ?? null,
        topic,
        chunks: chunks.map((c) => ({ id: c.id, content: c.content.slice(0, 1500) })),
      },
    }));
  } catch (err) {
    if (err instanceof GatewayError) throw new RouteError(err.status, err.message, err.code);
    throw err;
  }

  // Guardrail 2: the final number counts as checked only when the engine computes the same value.
  const value = output.final.answer_expr ? engineValue(output.final.answer_expr) : null;
  const checked = value !== null && output.final.stated !== null && numericMatches(value, output.final.stated);
  const solution: WorkedSolution = {
    steps: output.steps,
    final: { text: output.final.text, stated: checked ? output.final.stated : null, unit: output.final.unit },
    checked,
  };
  // First one wins (two students asking at once): keep whichever was saved.
  const { data: saved } = await admin
    .from("exam_questions")
    .update({ worked_solution: solution as unknown as Json, worked_solution_at: new Date().toISOString() })
    .eq("id", q.id)
    .is("worked_solution", null)
    .select("worked_solution")
    .maybeSingle();
  if (saved?.worked_solution) return saved.worked_solution as unknown as WorkedSolution;
  const { data: existing } = await admin.from("exam_questions").select("worked_solution").eq("id", q.id).single();
  return (existing?.worked_solution ?? solution) as unknown as WorkedSolution;
}

// ---------------------------------------------------------------------------
// A timed practice paper
// ---------------------------------------------------------------------------

export type PaperQuestion =
  | {
      kind: "past";
      itemId: string;
      questionId: string;
      text: string;
      marks: number | null;
      topic: string | null;
      label: string;
    }
  | { kind: "mcq"; itemId: string; text: string; options: { id: string; text: string }[]; topic: string | null }
  | { kind: "numeric"; itemId: string; text: string; unit: string | null; topic: string | null };

export type PracticePaper = { questions: PaperQuestion[]; minutes: number };

const PAST_IN_PAPER = 6;
const GENERATED_IN_PAPER = 4;

/**
 * Past questions chosen by share of marks × weakness, plus engine-checked practice questions on the
 * weakest topics. Answers never leave the server; time ≈ 1 minute per mark (4 minimum), 2 per item.
 */
export async function buildPracticePaper(viewer: Viewer, courseId: string): Promise<PracticePaper> {
  const prep = await getExamPrep(viewer, courseId);
  const titles = new Map(prep.topics.map((t) => [t.conceptId, t.title]));
  const supabase = await createClient();
  const conceptIds = prep.topics.map((t) => t.conceptId);
  const { data: mastery } = conceptIds.length
    ? await supabase.from("mastery").select("concept_id, m").eq("user_id", viewer.userId).in("concept_id", conceptIds)
    : { data: [] };
  const m = new Map((mastery ?? []).map((r) => [r.concept_id, Number(r.m)]));
  const share = new Map(prep.patterns.topics.map((t) => [t.conceptId, t.share]));
  const weight = (conceptId: string | null) =>
    conceptId ? (share.get(conceptId) ?? 0.01) * (1 - (m.get(conceptId) ?? 0)) : 0;

  const past = prep.questions
    .filter((q) => q.itemId && q.conceptId)
    .sort((a, b) => weight(b.conceptId) - weight(a.conceptId) || a.id.localeCompare(b.id))
    .slice(0, PAST_IN_PAPER);

  const weakest = [...conceptIds].sort((a, b) => (m.get(a) ?? 0) - (m.get(b) ?? 0)).slice(0, 3);
  const { data: items } = weakest.length
    ? await supabase
        .from("items")
        .select("id, type, stem, concept_id")
        .in("concept_id", weakest)
        .in("type", ["mcq", "numeric"])
        .eq("status", "published")
        .limit(GENERATED_IN_PAPER * 3)
    : { data: [] };

  const generated: PaperQuestion[] = (items ?? []).slice(0, GENERATED_IN_PAPER).map((i) => {
    const stem = (i.stem ?? {}) as { prompt?: string; options?: { id: string; text: string }[]; unit?: string };
    return i.type === "mcq"
      ? {
          kind: "mcq",
          itemId: i.id,
          text: stem.prompt ?? "",
          options: stem.options ?? [],
          topic: titles.get(i.concept_id) ?? null,
        }
      : {
          kind: "numeric",
          itemId: i.id,
          text: stem.prompt ?? "",
          unit: stem.unit ?? null,
          topic: titles.get(i.concept_id) ?? null,
        };
  });
  const questions: PaperQuestion[] = [
    ...past.map((q): PaperQuestion => ({
      kind: "past",
      itemId: q.itemId!,
      questionId: q.id,
      text: q.text,
      marks: q.marks,
      topic: q.conceptId ? (titles.get(q.conceptId) ?? null) : null,
      label: [q.year, q.number && `Q${q.number}${q.sub ?? ""}`].filter(Boolean).join(" · "),
    })),
    ...generated,
  ];
  const minutes = questions.reduce(
    (sum, q) => sum + (q.kind === "past" ? Math.max(4, Math.round(q.marks ?? 4)) : 2),
    0,
  );
  return { questions, minutes };
}
