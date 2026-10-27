import "server-only";
import { z } from "zod";
import { redactPersonalData } from "@ifiok/core/ai/redact";
import { chunkPages, cleanText } from "@ifiok/core/materials/chunk";
import { MATERIAL_KINDS, MATERIAL_LIMITS, SHAREABLE_SOURCE_KINDS, SOURCE_KIND_OF } from "@ifiok/core/materials/kinds";
import { getConfig } from "@/lib/config";
import { retrieveChunks, type RetrievalScope } from "@/lib/ai/retrieve";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A student's own materials (10 MVP-01, F3, F11-FR1). PDFs are read on the device; only the text
// of the pages the student picked arrives here. Personal details are stripped, the text is chunked
// into a private source (no file is stored), and the `embed` job fills the embeddings. Writes use
// the service role after the checks below; clients can't write sources' chunks (03 §8).

const CHUNK_INSERT_BATCH = 200;
const SEARCH_SNIPPET_CHARS = 400;

const scopeSchema = z.union([
  z.object({ courseId: z.string().uuid(), conceptId: z.null().optional() }),
  z.object({ conceptId: z.string().uuid(), courseId: z.null().optional() }),
]);

export const createMaterialBody = z
  .object({
    courseId: z.string().uuid().nullish(),
    conceptId: z.string().uuid().nullish(),
    kind: z.enum(MATERIAL_KINDS).exclude(["outline"]),
    title: z.string().trim().min(1, "give the material a name").max(MATERIAL_LIMITS.titleMax),
    pages: z
      .array(
        z.object({
          page: z.number().int().min(1).max(10_000).nullable(),
          text: z.string().max(MATERIAL_LIMITS.maxPasteChars),
        }),
      )
      .min(1, "pick at least one page")
      .max(MATERIAL_LIMITS.maxPages, `pick at most ${MATERIAL_LIMITS.maxPages} pages`),
  })
  .refine((b) => Boolean(b.courseId) !== Boolean(b.conceptId), { message: "choose a course or a topic" })
  .refine(
    (b) =>
      b.pages.every(
        (p) => p.text.length <= (p.page === null ? MATERIAL_LIMITS.maxPasteChars : MATERIAL_LIMITS.maxPageChars),
      ),
    {
      message: "a page has more text than Ifiok can take",
    },
  );
export type CreateMaterialBody = z.infer<typeof createMaterialBody>;

export function parseScope(params: { courseId?: string | null; conceptId?: string | null }): RetrievalScope {
  const parsed = scopeSchema.safeParse({
    ...(params.courseId ? { courseId: params.courseId } : {}),
    ...(params.conceptId ? { conceptId: params.conceptId } : {}),
  });
  if (!parsed.success) throw new RouteError(422, "Choose a course or a topic.", "invalid_scope");
  return parsed.data;
}

/** The student may add materials to a course they've joined, or to any topic (concept) that exists. */
async function checkScope(viewer: Viewer, scope: RetrievalScope) {
  const admin = createAdminClient();
  if (scope.courseId) {
    const [{ data: course }, { data: enrollment }] = await Promise.all([
      admin.from("courses").select("id, status").eq("id", scope.courseId).maybeSingle(),
      admin
        .from("enrollments")
        .select("user_id")
        .eq("course_id", scope.courseId)
        .eq("user_id", viewer.userId)
        .maybeSingle(),
    ]);
    if (!course || course.status !== "active")
      throw new RouteError(404, "That course doesn't exist any more.", "not_found");
    if (!enrollment) throw new RouteError(403, "Join the course to add materials to it.", "not_member");
    return;
  }
  const { data: concept } = await admin.from("concepts").select("id").eq("id", scope.conceptId!).maybeSingle();
  if (!concept) throw new RouteError(404, "That topic doesn't exist any more.", "not_found");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type CreateMaterialResult = {
  material: { id: string; title: string; pageCount: number; chunks: number };
  jobId: string;
  /** Past questions in a course: the extraction to review (MVP-04). */
  examJobId: string | null;
  /** A lab manual: the labs being built from it (MVP-05). */
  labJobId: string | null;
  redacted: number;
  skippedPages: number;
};

/**
 * `forLibrary`: an upload straight to the Library (12 §4 Q58) is shared, not studied from a course,
 * so it doesn't start the course's exam or lab extraction.
 */
export async function createMaterial(
  viewer: Viewer,
  body: CreateMaterialBody,
  options: { forLibrary?: boolean } = {},
): Promise<CreateMaterialResult> {
  const scope = parseScope(body);
  await checkScope(viewer, scope);

  // Strip personal details first: nothing below sees the original text.
  let redacted = 0;
  const pages = body.pages.map(({ page, text }) => {
    const r = redactPersonalData(text);
    redacted += r.redacted;
    return { page, text: cleanText(r.text) };
  });
  const usable = pages.filter((p) => p.text.length >= MATERIAL_LIMITS.minPageChars);
  if (usable.length === 0) {
    throw new RouteError(
      422,
      "Ifiok found no text on those pages. Scanned pages can't be read yet: pick pages with selectable text, or paste the text.",
      "no_text",
    );
  }
  const chunks = chunkPages(usable);
  const sha256 = await sha256Hex(usable.map((p) => `${p.page ?? ""}\n${p.text}`).join("\n\f"));

  const admin = createAdminClient();
  const duplicate = await admin
    .from("sources")
    .select("id")
    .eq("owner_id", viewer.userId)
    .eq("sha256", sha256)
    .eq(scope.courseId ? "course_id" : "concept_id", (scope.courseId ?? scope.conceptId)!)
    .limit(1)
    .maybeSingle();
  if (duplicate.data) {
    throw new RouteError(409, "You've already added these pages here. They're in your materials list.", "duplicate");
  }

  const limit = (await getConfig("ai_quotas")).materials_upload?.limit ?? MATERIAL_LIMITS.uploadsPerDay;
  const { data: reserved } = await admin.rpc("consume_quota", {
    p_user: viewer.userId,
    p_feature: "materials_upload",
    p_limit: limit,
  });
  if (!reserved) {
    throw new RouteError(
      429,
      `You've added materials ${limit} times today, the most for one day. Your allowance resets at midnight.`,
      "quota_exhausted",
    );
  }

  let sourceId: string | null = null;
  try {
    const { data: source, error } = await admin
      .from("sources")
      .insert({
        owner_id: viewer.userId,
        course_id: scope.courseId ?? null,
        concept_id: scope.conceptId ?? null,
        kind: SOURCE_KIND_OF[body.kind],
        visibility: "private",
        title: body.title,
        storage_path: null,
        sha256,
        page_count: usable.length,
      })
      .select("id")
      .single();
    if (error || !source) throw new Error("Couldn't save the source");
    sourceId = source.id;

    const rows = chunks.map((c) => ({
      source_id: source.id,
      owner_id: viewer.userId,
      course_id: scope.courseId ?? null,
      concept_id: scope.conceptId ?? null,
      visibility: "private" as const,
      page: c.page,
      content: c.content,
    }));
    for (let i = 0; i < rows.length; i += CHUNK_INSERT_BATCH) {
      const { error: chunkError } = await admin.from("chunks").insert(rows.slice(i, i + CHUNK_INSERT_BATCH));
      if (chunkError) throw new Error("Couldn't save the chunks");
    }

    const { data: jobs, error: jobError } = await admin.rpc("enqueue_job_once", {
      p_queue: "embed",
      p_payload: { source_id: source.id },
      p_dedupe: `embed:${source.id}`,
      p_owner: viewer.userId,
    });
    const job = jobs?.[0];
    if (jobError || !job) throw new Error("Couldn't queue the embed job");

    // Past questions filed under a course: read the questions out for the student to review (MVP-04).
    let examJobId: string | null = null;
    if (body.kind === "past_questions" && scope.courseId && !options.forLibrary) {
      const { data: exam, error: examError } = await admin.rpc("enqueue_job_once", {
        p_queue: "exam_extract",
        p_payload: { source_id: source.id, course_id: scope.courseId, user_id: viewer.userId },
        p_dedupe: `exam:${source.id}`,
        p_owner: viewer.userId,
      });
      if (examError || !exam?.[0]) throw new Error("Couldn't queue the exam extraction");
      examJobId = exam[0].job_id;
    }

    // A lab manual: turn its practicals into virtual labs (MVP-05, 04 §4.8).
    let labJobId: string | null = null;
    if (body.kind === "lab_manual" && !options.forLibrary) {
      const { data: lab, error: labError } = await admin.rpc("enqueue_job_once", {
        p_queue: "lab_extract",
        p_payload: { mode: "manual", source_id: source.id, course_id: scope.courseId ?? null, user_id: viewer.userId },
        p_dedupe: `lab:${source.id}`,
        p_owner: viewer.userId,
      });
      if (labError || !lab?.[0]) throw new Error("Couldn't queue the lab extraction");
      labJobId = lab[0].job_id;
    }

    return {
      material: { id: source.id, title: body.title, pageCount: usable.length, chunks: chunks.length },
      jobId: job.job_id,
      examJobId,
      labJobId,
      redacted,
      skippedPages: pages.length - usable.length,
    };
  } catch {
    if (sourceId) await admin.from("sources").delete().eq("id", sourceId);
    await admin.rpc("refund_quota", { p_user: viewer.userId, p_feature: "materials_upload" });
    throw new RouteError(503, "Ifiok couldn't save these materials. Try again in a minute.", "save_failed");
  }
}

export type MaterialStatus = "processing" | "ready" | "failed";
export type MaterialSummary = {
  id: string;
  kind: string;
  title: string;
  pageCount: number;
  createdAt: string;
  status: MaterialStatus;
  /** Sharing to the contribution pool (MVP-06): never shared, being checked, or the outcome. */
  share: { state: "none" | "checking" | "approved" | "held" | "rejected"; reason: string | null; shareable: boolean };
};

/** The viewer's own materials for a course or topic (RLS: owner only). */
export async function listMaterials(viewer: Viewer, scope: RetrievalScope): Promise<MaterialSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("material_summaries", {
    p_course: (scope.courseId ?? null) as unknown as string,
    p_concept: (scope.conceptId ?? null) as unknown as string,
  });
  if (error) throw new Error("Couldn't load materials");
  const rows = data ?? [];

  const processing = rows.filter((r) => r.pending_chunks > 0).map((r) => r.id);
  const failed = new Set<string>();
  if (processing.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("payload, status")
      .eq("queue", "embed")
      .eq("owner_id", viewer.userId)
      .eq("status", "failed")
      .in("payload->>source_id", processing);
    for (const j of jobs ?? []) {
      const id = (j.payload as { source_id?: unknown } | null)?.source_id;
      if (typeof id === "string") failed.add(id);
    }
  }

  const { data: shared } = rows.length
    ? await supabase
        .from("sources")
        .select("id, shared_at, review, review_reason")
        .in(
          "id",
          rows.map((r) => r.id),
        )
    : { data: [] };
  const shareOf = new Map((shared ?? []).map((s) => [s.id, s]));

  return rows.map((r) => {
    const s = shareOf.get(r.id);
    const state: MaterialSummary["share"]["state"] = !s?.shared_at
      ? "none"
      : s.review === "approved"
        ? "approved"
        : s.review === "needs_review"
          ? "held"
          : s.review === "rejected"
            ? "rejected"
            : "checking";
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      pageCount: r.page_count ?? 0,
      createdAt: r.created_at,
      status: r.pending_chunks === 0 ? "ready" : failed.has(r.id) ? "failed" : "processing",
      share: {
        state,
        reason: state === "held" || state === "rejected" ? (s?.review_reason ?? null) : null,
        shareable: (SHAREABLE_SOURCE_KINDS as readonly string[]).includes(r.kind),
      },
    };
  });
}

export async function deleteMaterial(viewer: Viewer, sourceId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: source } = await admin
    .from("sources")
    .select("id, owner_id, visibility")
    .eq("id", sourceId)
    .maybeSingle();
  // Someone else's source answers exactly like a missing one.
  if (!source || source.owner_id !== viewer.userId) {
    throw new RouteError(404, "Those materials don't exist any more.", "not_found");
  }
  if (source.visibility !== "private") {
    throw new RouteError(409, "Shared materials are withdrawn from the library, not deleted here.", "shared");
  }
  const { error } = await admin.from("sources").delete().eq("id", sourceId).eq("owner_id", viewer.userId);
  if (error)
    throw new RouteError(503, "Ifiok couldn't delete these materials. Try again in a minute.", "delete_failed");
}

export type MaterialHit = { sourceId: string; title: string; page: number | null; snippet: string };

/** "Find in your materials": the viewer's own chunks only (crowd chunks are shown as citations, later). */
export async function searchMaterials(viewer: Viewer, scope: RetrievalScope, query: string): Promise<MaterialHit[]> {
  const chunks = await retrieveChunks(viewer, scope, query, 12);
  if (chunks.length === 0) return [];
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("sources")
    .select("id, title")
    .eq("owner_id", viewer.userId)
    .in("id", [...new Set(chunks.map((c) => c.sourceId))]);
  const titles = new Map((sources ?? []).map((s) => [s.id, s.title]));
  return chunks
    .filter((c) => titles.has(c.sourceId))
    .slice(0, 6)
    .map((c) => ({
      sourceId: c.sourceId,
      title: titles.get(c.sourceId)!,
      page: c.page,
      snippet: c.content.length > SEARCH_SNIPPET_CHARS ? `${c.content.slice(0, SEARCH_SNIPPET_CHARS)}…` : c.content,
    }));
}
