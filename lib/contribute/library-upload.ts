import "server-only";
import { z } from "zod";
import { RouteError } from "@/lib/api/route";
import type { Viewer } from "@/lib/auth/viewer";
import { createMaterial, createMaterialBody } from "@/lib/materials/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { shareMaterial } from "./share";

// Upload to the Library (12 §4 Q58, Q59): the student's own notes, lab manual, worked solutions or
// past questions, for one topic, shared to the contribution pool in one step. The text of the
// picked pages is saved for the checks and search; a PDF upload also keeps those pages as a real
// PDF (built on the phone) and a page-1 thumbnail, in the private `library` bucket.

export const LIBRARY_BUCKET = "library";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export const libraryUploadBody = z.object({
  concept_id: z.string().uuid(),
  kind: z.enum(["notes", "lab_manual", "solutions", "past_questions"]),
  title: z.string().trim().min(1, "Give it a title.").max(120),
  pages: z.array(z.object({ page: z.number().int().min(1).max(10_000).nullable(), text: z.string() })).min(1),
  /** Present for a PDF upload: the size of the picked-pages PDF the phone made. */
  pdf_bytes: z
    .number()
    .int()
    .positive()
    .max(MAX_PDF_BYTES, "The pages you picked are over 20 MB. Pick fewer.")
    .optional(),
  attest: z.literal(true, { error: "Confirm the material is yours to share." }),
});

type Upload = { path: string; token: string };

export async function uploadToLibrary(viewer: Viewer, body: z.infer<typeof libraryUploadBody>) {
  const material = createMaterialBody.parse({
    conceptId: body.concept_id,
    kind: body.kind,
    title: body.title,
    pages: body.pages,
  });
  const created = await createMaterial(viewer, material, { forLibrary: true });
  await shareMaterial(viewer, created.material.id);

  let uploads: { pdf: Upload; thumb: Upload } | null = null;
  if (body.pdf_bytes) {
    const bucket = createAdminClient().storage.from(LIBRARY_BUCKET);
    const folder = `${viewer.userId}/${created.material.id}`;
    const sign = async (path: string) => {
      const { data, error } = await bucket.createSignedUploadUrl(path);
      if (error || !data) throw new RouteError(503, "Ifiok couldn't prepare the upload. Try again.", "upload_failed");
      return { path, token: data.token };
    };
    uploads = { pdf: await sign(`${folder}/doc.pdf`), thumb: await sign(`${folder}/thumb.jpg`) };
  }
  return {
    materialId: created.material.id,
    redacted: created.redacted,
    skippedPages: created.skippedPages,
    uploads,
  };
}

/** The first bytes and size of an uploaded object, through a short-lived signed URL. */
async function head(path: string): Promise<{ size: number; bytes: Uint8Array } | null> {
  const { data } = await createAdminClient().storage.from(LIBRARY_BUCKET).createSignedUrl(path, 60);
  if (!data?.signedUrl) return null;
  const res = await fetch(data.signedUrl, { headers: { range: "bytes=0-7" } });
  if (!res.ok) return null;
  const range = res.headers.get("content-range");
  return {
    size: range ? Number(range.split("/")[1]) : Number(res.headers.get("content-length") ?? 0),
    bytes: new Uint8Array(await res.arrayBuffer()),
  };
}

/**
 * The phone finished uploading: check the files are what they claim (08 §2.5: magic bytes, not
 * names or MIME types) and attach them. A bad file is deleted and the document stays text-only.
 */
export async function completeLibraryUpload(viewer: Viewer, sourceId: string) {
  const admin = createAdminClient();
  const { data: source } = await admin.from("sources").select("owner_id").eq("id", sourceId).maybeSingle();
  if (!source || source.owner_id !== viewer.userId)
    throw new RouteError(404, "That upload doesn't exist.", "not_found");
  const folder = `${viewer.userId}/${sourceId}`;
  const [pdf, thumb] = await Promise.all([head(`${folder}/doc.pdf`), head(`${folder}/thumb.jpg`)]);
  const isPdf = pdf && pdf.size <= MAX_PDF_BYTES && new TextDecoder().decode(pdf.bytes.slice(0, 5)) === "%PDF-";
  const isJpeg = thumb && thumb.bytes[0] === 0xff && thumb.bytes[1] === 0xd8;
  if (!isPdf) {
    await admin.storage.from(LIBRARY_BUCKET).remove([`${folder}/doc.pdf`, `${folder}/thumb.jpg`]);
    throw new RouteError(422, "That file isn't a readable PDF, so your upload is shown as text.", "bad_file");
  }
  await admin
    .from("sources")
    .update({
      storage_path: `${folder}/doc.pdf`,
      thumb_path: isJpeg ? `${folder}/thumb.jpg` : null,
      file_bytes: pdf.size,
    })
    .eq("id", sourceId);
  return { attached: true };
}
