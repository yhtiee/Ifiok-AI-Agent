import "server-only";
import { mergeChunks } from "@ifiok/core/jobs/exam-extract";
import { MATERIALS_BUCKET } from "@ifiok/core/materials/kinds";
import type { Viewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** The private bucket that earlier Library PDFs (picked pages, 12 §4 Q59) were kept in. */
export const OLD_LIBRARY_BUCKET = "library";

/**
 * Where a material's stored file lives. Every upload since 12 §4 Q60 records its type and goes to
 * `materials`; a stored file with no type is one of the earlier Library PDFs.
 */
export function fileBucket(mime: string | null): string {
  return mime ? MATERIALS_BUCKET : OLD_LIBRARY_BUCKET;
}

/** A stored file's viewer URLs: a PDF or photo is shown as it is; anything else as its text. */
export async function fileUrls(storagePath: string | null, fileMime: string | null) {
  const signed = storagePath
    ? (await createAdminClient().storage.from(fileBucket(fileMime)).createSignedUrl(storagePath, 600)).data
    : null;
  const fileUrl = signed?.signedUrl ?? null;
  const mime = storagePath ? (fileMime ?? "application/pdf") : null;
  return {
    fileUrl,
    fileMime: mime,
    pdfUrl: mime === "application/pdf" ? fileUrl : null,
    imageUrl: mime?.startsWith("image/") ? fileUrl : null,
  };
}

/** A material's text, page by page, from its chunks. */
export async function textPages(sourceId: string): Promise<{ page: number | null; text: string }[]> {
  const { data: chunks } = await createAdminClient()
    .from("chunks")
    .select("page, content")
    .eq("source_id", sourceId)
    .order("id");
  const byPage = new Map<number | null, { page: number | null; content: string }[]>();
  for (const c of chunks ?? []) byPage.set(c.page, [...(byPage.get(c.page) ?? []), c]);
  return [...byPage].map(([page, list]) => ({ page, text: mergeChunks(list) }));
}

/** The viewer's own material, to open (RLS: owner only; someone else's answers as missing). */
export async function ownMaterial(viewer: Viewer, id: string) {
  const { data: s } = await (
    await createClient()
  )
    .from("sources")
    .select("id, title, kind, owner_id, course_id, concept_id, storage_path, file_mime")
    .eq("id", id)
    .eq("owner_id", viewer.userId)
    .maybeSingle();
  if (!s) return null;
  const urls = await fileUrls(s.storage_path, s.file_mime);
  return {
    id: s.id,
    title: s.title,
    kind: s.kind,
    courseId: s.course_id,
    conceptId: s.concept_id,
    ...urls,
    pages: urls.pdfUrl || urls.imageUrl ? [] : await textPages(s.id),
  };
}
