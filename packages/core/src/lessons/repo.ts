import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../db/types";
import type { LessonSpec } from "../dsl/schema";
import type { SourceChunk } from "./pipeline";

// Database side of shared lessons (service role), used by the lesson_gen handler in the worker and
// by curator edits in Next. Shared lessons read sources only through shared_lesson_sources.

export type ConceptForLesson = {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  level_band: string | null;
  micro_skills: string[];
};

export type CourseContext = { code: string; title: string; wording: string };

export type PublishArgs = {
  conceptId: string;
  kind: string;
  spec: LessonSpec;
  status: "published" | "review";
  trust: "new" | "trusted";
  sourceRefs: number[];
  sourcesUsed: number;
  model?: string | null;
  courseId?: string | null;
  requestedBy?: string | null;
  verifiedBy?: string | null;
  supersede?: string | null;
};

export interface LessonRepo {
  loadConcept(conceptId: string): Promise<ConceptForLesson | null>;
  sharedSources(conceptId: string): Promise<SourceChunk[]>;
  isSensitive(subject: string): Promise<boolean>;
  /** The requesting course's wording and outline, only if the user is enrolled (guardrail 7). */
  courseContext(courseId: string, userId: string, conceptId: string): Promise<CourseContext | null>;
  publish(args: PublishArgs): Promise<string>;
  materializeCheckpoints(lessonId: string, conceptId: string, spec: LessonSpec): Promise<void>;
  refundNewLesson(userId: string): Promise<void>;
}

export function createSupabaseLessonRepo(db: SupabaseClient<Database>): LessonRepo {
  return {
    async loadConcept(conceptId) {
      const { data, error } = await db
        .from("concepts")
        .select("id, title, description, subject, level_band, micro_skills")
        .eq("id", conceptId)
        .maybeSingle();
      if (error) throw new Error("Couldn't load the concept");
      return data ? { ...data, micro_skills: data.micro_skills ?? [] } : null;
    },

    async sharedSources(conceptId) {
      const { data, error } = await db.rpc("shared_lesson_sources", { p_concept: conceptId, p_limit: 40 });
      if (error) throw new Error("Couldn't load approved sources");
      return (data ?? []).map((c) => ({ id: Number(c.id), content: c.content, page: c.page }));
    },

    async isSensitive(subject) {
      const { data } = await db.from("subjects").select("sensitive").eq("code", subject).maybeSingle();
      return data?.sensitive ?? false;
    },

    async courseContext(courseId, userId, conceptId) {
      const { data: enrolled } = await db
        .from("enrollments")
        .select("course_id")
        .eq("course_id", courseId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!enrolled) return null;
      const [{ data: course }, { data: topics }] = await Promise.all([
        db.from("courses").select("code, title").eq("id", courseId).maybeSingle(),
        db
          .from("topics")
          .select("title, concept_id")
          .eq("course_id", courseId)
          .is("archived_at", null)
          .order("position")
          .limit(20),
      ]);
      if (!course) return null;
      const here = topics?.find((t) => t.concept_id === conceptId);
      const outline = (topics ?? []).map((t) => t.title).join("; ");
      return {
        code: course.code,
        title: course.title,
        wording: [
          here ? `This topic is called "${here.title}" in the course.` : "",
          outline ? `Outline: ${outline}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      };
    },

    async publish(a) {
      const { data, error } = await db.rpc("publish_lesson_version", {
        p_concept: a.conceptId,
        p_kind: a.kind,
        p_spec: a.spec as unknown as Json,
        p_status: a.status,
        p_trust: a.trust,
        p_source_refs: a.sourceRefs,
        p_sources_used: a.sourcesUsed,
        p_model: a.model ?? undefined,
        p_course: a.courseId ?? undefined,
        p_requested_by: a.requestedBy ?? undefined,
        p_verified_by: a.verifiedBy ?? undefined,
        p_supersede: a.supersede ?? undefined,
      });
      if (error || !data) throw new Error("Couldn't publish the lesson");
      return data;
    },

    async materializeCheckpoints(lessonId, conceptId, spec) {
      const rows = checkpointItems(lessonId, conceptId, spec);
      if (rows.length === 0) return;
      // A new lesson version has no items yet, so a plain insert (items_checkpoint is a partial
      // index, which PostgREST upserts can't target).
      const { error } = await db.from("items").insert(rows);
      if (error) throw new Error("Couldn't save the lesson's checkpoint items");
    },

    async refundNewLesson(userId) {
      const { error } = await db.rpc("refund_quota", { p_user: userId, p_feature: "new_lesson" });
      if (error) throw new Error("Couldn't refund the new-lesson allowance");
    },
  };
}

/** A published lesson's checkpoint blocks as `items` rows (05 §4). */
export function checkpointItems(
  lessonId: string,
  conceptId: string,
  spec: LessonSpec,
): Database["public"]["Tables"]["items"]["Insert"][] {
  const rows: Database["public"]["Tables"]["items"]["Insert"][] = [];
  const base = {
    concept_id: conceptId,
    lesson_id: lessonId,
    difficulty: 2,
    origin: "checkpoint",
    status: "published",
  } as const;
  for (const screen of spec.screens) {
    for (const block of screen.blocks) {
      if (block.type !== "checkpoint") continue;
      const item = block.item;
      if (item.type === "mcq") {
        rows.push({
          ...base,
          block_id: block.id,
          type: "mcq",
          stem: { prompt: item.stem_md, options: item.options.map((o) => ({ id: o.id, text: o.md })) } as Json,
          answer: {
            correct_option_id: item.correct,
            feedback: Object.fromEntries(item.options.map((o) => [o.id, o.why])),
          } as Json,
          verification: { type: "mcq" } as Json,
        });
      } else if (item.type === "numeric") {
        rows.push({
          ...base,
          block_id: block.id,
          type: "numeric",
          stem: { prompt: item.stem_md } as Json,
          answer: { expected: item.stated, answer_expr: item.answer_expr, why: item.why } as Json,
          verification: {
            type: "numeric",
            answer_expr: item.answer_expr,
            stated: item.stated,
            tolerance: item.tolerance ?? null,
          } as Json,
        });
      } else if (item.type === "expression") {
        rows.push({
          ...base,
          block_id: block.id,
          type: "expression",
          stem: { prompt: item.stem_md } as Json,
          answer: { answer_expr: item.answer_expr, vars: item.vars, why: item.why } as Json,
          verification: { type: "expression", answer_expr: item.answer_expr, vars: item.vars } as Json,
        });
      }
    }
  }
  return rows;
}
