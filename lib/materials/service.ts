import "server-only";
import { z } from "zod";
import { redactPersonalData } from "@ifiok/core/ai/redact";
import { chunkPages, cleanText } from "@ifiok/core/materials/chunk";
import {
  FILE_EXT,
  FILE_MIMES,
  MATERIALS_BUCKET,
  MAX_OCR_PAGES,
  MATERIAL_KINDS,
  MATERIAL_LIMITS,
  SHAREABLE_SOURCE_KINDS,
  SOURCE_KIND_OF,
} from "@ifiok/core/materials/kinds";

import { getConfig } from "@/lib/config";
import { retrieveChunks, type RetrievalScope } from "@/lib/ai/retrieve";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// A student's own materials (10 MVP-01, F3, F11-FR1, 12 §4 Q60). The file itself is stored privately
// (signed upload, then completeMaterial checks it); its text, read on the device or by the ocr job,
// has personal details stripped, is chunked into the source and embedded by the `embed` job. Writes use
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
      .max(MATERIAL_LIMITS.maxReadPages, `at most ${MATERIAL_LIMITS.maxReadPages} pages are read`),
    /** The uploaded file itself (12 §4 Q60): stored privately and viewable later. */
    file: z
      .object({
        name: z.string().trim().min(1).max(200),
        mime: z.enum(FILE_MIMES),
        bytes: z.number().int().positive().max(MATERIAL_LIMITS.maxStoredBytes, "Files can be up to 20 MB."),
      })
      .optional(),
    /** Pages with no text layer (scanned) that the phone rendered as images for reading. */
    ocr_pages: z
      .array(z.object({ page: z.number().int().min(1).nullable() }))
      .max(MAX_OCR_PAGES)
      .default([]),
  })
  .refine((b) => b.pages.length > 0 || Boolean(b.file), { message: "add a file or some text" })
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

export type MaterialUploads = {
  file: { path: string; token: string };
  thumb: { path: string; token: string } | null;
  ocr: { page: number | null; path: string; token: string }[];
};

export type CreateMaterialResult = {
  material: { id: string; title: string; pageCount: number; chunks: number };
  /** The embed job, when text was read in the browser (photos and scans are read by the ocr job). */
  jobId: string | null;
  uploads: MaterialUploads | null;
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
  // Photos and scanned pages are read on the server (OCR), so a file may arrive with no text yet.
  const awaitingOcr = Boolean(body.file) && (body.file!.mime.startsWith("image/") || body.ocr_pages.length > 0);
  if (usable.length === 0 && !awaitingOcr) {
    throw new RouteError(
      422,
      "Ifiok found no text in that file. Try a PDF or Word document with text, a clear photo, or paste the text.",
      "no_text",
    );
  }
  const chunks = chunkPages(usable);
  const sha256 = await sha256Hex(
    usable.length
      ? usable.map((p) => `${p.page ?? ""}\n${p.text}`).join("\n\f")
      : `file:${body.file?.name}:${body.file?.bytes}:${body.file?.mime}`,
  );

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
        page_count: Math.max(usable.length + body.ocr_pages.length, body.file?.mime.startsWith("image/") ? 1 : 0),
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

    // Text read in the browser is indexed now; text read by OCR is indexed by the ocr job.
    let jobId: string | null = null;
    if (chunks.length) {
      const { data: jobs, error: jobError } = await admin.rpc("enqueue_job_once", {
        p_queue: "embed",
        p_payload: { source_id: source.id },
        p_dedupe: `embed:${source.id}`,
        p_owner: viewer.userId,
      });
      if (jobError || !jobs?.[0]) throw new Error("Couldn't queue the embed job");
      jobId = jobs[0].job_id;
    }

    // Past questions filed under a course: read the questions out for the student to review (MVP-04).
    let examJobId: string | null = null;
    if (body.kind === "past_questions" && scope.courseId && !options.forLibrary && chunks.length) {
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
    if (body.kind === "lab_manual" && !options.forLibrary && chunks.length) {
      const { data: lab, error: labError } = await admin.rpc("enqueue_job_once", {
        p_queue: "lab_extract",
        p_payload: { mode: "manual", source_id: source.id, course_id: scope.courseId ?? null, user_id: viewer.userId },
        p_dedupe: `lab:${source.id}`,
        p_owner: viewer.userId,
      });
      if (labError || !lab?.[0]) throw new Error("Couldn't queue the lab extraction");
      labJobId = lab[0].job_id;
    }

    // Signed upload URLs for the file, its thumbnail and any pages to read (owner's own folder).
    let uploads: MaterialUploads | null = null;
    if (body.file) {
      const bucket = admin.storage.from(MATERIALS_BUCKET);
      const folder = `${viewer.userId}/${source.id}`;
      const sign = async (path: string) => {
        const { data, error: e } = await bucket.createSignedUploadUrl(path);
        if (e || !data) throw new Error("Couldn't sign the upload");
        return { path, token: data.token };
      };
      uploads = {
        file: await sign(`${folder}/file.${FILE_EXT[body.file.mime]}`),
        thumb: body.file.mime === "application/pdf" ? await sign(`${folder}/thumb.jpg`) : null,
        ocr: await Promise.all(
          body.ocr_pages.map(async (o, i) => ({
            page: o.page,
            ...(await sign(`${folder}/ocr-${o.page ?? i + 1}.jpg`)),
          })),
        ),
      };
    }

    return {
      material: { id: source.id, title: body.title, pageCount: usable.length, chunks: chunks.length },
      jobId,
      uploads,
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

  // Still indexing, or (photos and scans, 12 §4 Q60) no text yet because the ocr job is reading it.
  const unsettled = rows.filter((r) => r.pending_chunks > 0 || r.chunks === 0).map((r) => r.id);
  const failed = new Set<string>();
  const reading = new Set<string>();
  if (unsettled.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("queue, payload, status")
      .in("queue", ["embed", "ocr"])
      .eq("owner_id", viewer.userId)
      .in("payload->>source_id", unsettled);
    for (const j of jobs ?? []) {
      const id = (j.payload as { source_id?: unknown } | null)?.source_id;
      if (typeof id !== "string") continue;
      if (j.status === "failed") failed.add(id);
      else if (j.queue === "ocr" && j.status !== "done") reading.add(id);
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
      status: failed.has(r.id) ? "failed" : r.pending_chunks > 0 || reading.has(r.id) ? "processing" : "ready",
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
  // The stored file, thumbnail and page images go with it (12 §4 Q60).
  const bucket = admin.storage.from(MATERIALS_BUCKET);
  const folder = `${viewer.userId}/${sourceId}`;
  const { data: files } = await bucket.list(folder);
  if (files?.length) await bucket.remove(files.map((f) => `${folder}/${f.name}`));
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

// ---------------------------------------------------------------------------
// Files (12 §4 Q60): the phone uploads through signed URLs, then calls complete.
// ---------------------------------------------------------------------------

/** Magic bytes (08 §2.5): what the file really is, whatever its name says. */
function sniff(bytes: Uint8Array): string | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["heic", "heix", "mif1", "msf1"].includes(ascii(8, 12))) return "image/heic";
  return null;
}

async function head(path: string): Promise<{ size: number; bytes: Uint8Array } | null> {
  const { data } = await createAdminClient().storage.from(MATERIALS_BUCKET).createSignedUrl(path, 60);
  if (!data?.signedUrl) return null;
  const res = await fetch(data.signedUrl, { headers: { range: "bytes=0-15" } });
  if (!res.ok) return null;
  const range = res.headers.get("content-range");
  return {
    size: range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length") ?? 0),
    bytes: new Uint8Array(await res.arrayBuffer()),
  };
}

/**
 * The upload finished: check the file is what it claims, attach it to the material, and queue
 * reading for a photo or the scanned pages (the ocr job). A file that fails the check is deleted.
 */
export async function completeMaterial(viewer: Viewer, sourceId: string) {
  const admin = createAdminClient();
  const { data: source } = await admin.from("sources").select("owner_id").eq("id", sourceId).maybeSingle();
  if (!source || source.owner_id !== viewer.userId)
    throw new RouteError(404, "Those materials don't exist any more.", "not_found");
  const folder = `${viewer.userId}/${sourceId}`;
  const bucket = admin.storage.from(MATERIALS_BUCKET);
  const { data: files } = await bucket.list(folder);
  const names = new Set((files ?? []).map((f) => f.name));
  const fileName = [...names].find((n) => n.startsWith("file."));
  if (!fileName) throw new RouteError(409, "The file didn't finish uploading. Add it again.", "upload_missing");
  const file = await head(`${folder}/${fileName}`);
  const mime = file ? sniff(file.bytes) : null;
  if (!file || !mime || file.size > MATERIAL_LIMITS.maxStoredBytes) {
    await bucket.remove([...names].map((n) => `${folder}/${n}`));
    throw new RouteError(
      422,
      "That file isn't a PDF, Word document or photo Ifiok can read. Add it again.",
      "bad_file",
    );
  }
  const thumb = names.has("thumb.jpg") ? await head(`${folder}/thumb.jpg`) : null;
  const thumbOk = thumb && sniff(thumb.bytes) === "image/jpeg";
  await admin
    .from("sources")
    .update({
      storage_path: `${folder}/${fileName}`,
      file_mime: mime,
      file_bytes: file.size,
      thumb_path: thumbOk ? `${folder}/thumb.jpg` : mime.startsWith("image/") ? `${folder}/${fileName}` : null,
    })
    .eq("id", sourceId);

  // Photos, and scanned PDF pages rendered on the phone, are read by OCR.
  const ocr = mime.startsWith("image/")
    ? [{ path: `${folder}/${fileName}`, page: 1 }]
    : [...names]
        .filter((n) => /^ocr-\d+\.jpg$/.test(n))
        .sort((a, b) => Number(a.slice(4, -4)) - Number(b.slice(4, -4)))
        .map((n) => ({ path: `${folder}/${n}`, page: Number(n.slice(4, -4)) as number | null }));
  if (ocr.length) {
    const { error } = await admin.rpc("enqueue_job_once", {
      p_queue: "ocr",
      p_payload: { source_id: sourceId, user_id: viewer.userId, pages: ocr.slice(0, MAX_OCR_PAGES) },
      p_dedupe: `ocr:${sourceId}`,
      p_owner: viewer.userId,
    });
    if (error) throw new RouteError(503, "Ifiok couldn't start reading the pages. Try again.", "queue_failed");
  }
  return { attached: true, reading: ocr.length };
}
