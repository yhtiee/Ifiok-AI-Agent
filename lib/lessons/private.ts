import "server-only";
import {
  createSupabasePrivateLessonRepo,
  privateLessonDedupe,
  type PrivateLessonRepo,
} from "@ifiok/core/lessons/private";
import type { Viewer } from "@/lib/auth/viewer";
import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { LessonSpec } from "@ifiok/core";
import type { Database } from "@/lib/supabase/types";
import type { LessonRow, LessonStatus, LessonTrust } from "./types";

// A student's private lessons in Next (10 MVP-02): their own lesson for a topic, its citations
// ("From your notes, p. 12"), and starting one when their materials cover the topic. Reads of
// lessons and chunks run as the student under RLS; queueing uses the shared core repo.

let repo: PrivateLessonRepo | null = null;
export function privateLessonRepo(): PrivateLessonRepo {
  repo ??= createSupabasePrivateLessonRepo(createAdminClient(), getConfig);
  return repo;
}

function toRow(data: Database["public"]["Tables"]["lessons"]["Row"]): LessonRow {
  return {
    ...data,
    status: data.status as LessonStatus,
    trust: data.trust as LessonTrust,
    spec: data.spec as unknown as LessonSpec,
    source_refs: (data.source_refs as number[]) ?? [],
    hidden_blocks: data.hidden_blocks ?? [],
  };
}

/** The student's latest published private lesson for a topic, in a course or on its own. */
export async function findPrivateLesson(
  viewer: Viewer,
  conceptId: string,
  courseId: string | null,
): Promise<LessonRow | null> {
  const supabase = await createClient();
  let q = supabase
    .from("lessons")
    .select("*")
    .eq("owner_id", viewer.userId)
    .eq("concept_id", conceptId)
    .eq("status", "published");
  q = courseId ? q.eq("course_id", courseId) : q.is("course_id", null);
  const { data } = await q.order("version", { ascending: false }).limit(1).maybeSingle();
  return data ? toRow(data) : null;
}

/** A private lesson job for this student and topic that is still queued or running. */
export async function activePrivateJob(viewer: Viewer, conceptId: string, courseId: string | null) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("dedupe_key", privateLessonDedupe(viewer.userId, conceptId, courseId))
    .in("status", ["queued", "running"])
    .maybeSingle();
  return data?.id ?? null;
}

const KIND_LABEL: Record<string, string> = {
  notes: "your notes",
  textbook_private: "your textbook",
  lab_manual: "your lab manual",
  solution: "your worked solutions",
  past_paper: "your past questions",
};

/** "From your notes, p. 12" per cited chunk id. Only the viewer's own chunks are readable (RLS). */
export async function citationLabels(refs: number[]): Promise<Record<string, string>> {
  if (refs.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("chunks").select("id, page, sources(kind)").in("id", refs);
  const out: Record<string, string> = {};
  for (const c of data ?? []) {
    const kind = (c.sources as { kind: string } | null)?.kind ?? "notes";
    out[String(c.id)] = `From ${KIND_LABEL[kind] ?? "your materials"}${c.page ? `, p. ${c.page}` : ""}`;
  }
  return out;
}

/**
 * Starts the student's private lesson when their materials cover the topic and they have none:
 * one allowance, refunded if the job already existed. Null when not covered or the allowance is used up.
 */
export async function startPrivateLesson(
  viewer: Viewer,
  conceptId: string,
  courseId: string | null,
): Promise<string | null> {
  const priv = privateLessonRepo();
  const scope = { userId: viewer.userId, courseId };
  const cfg = await priv.config();
  const coverage = await priv.coverage(scope, conceptId, cfg);
  if ((coverage.get(conceptId) ?? 0) < cfg.min_chunks) return null;
  if (!(await priv.reserve(viewer.userId))) return null;
  const { jobId, created } = await priv.enqueueLesson(scope, conceptId);
  if (!created) await priv.refund(viewer.userId);
  return jobId;
}
