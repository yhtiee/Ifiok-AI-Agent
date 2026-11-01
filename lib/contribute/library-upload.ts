import "server-only";
import { z } from "zod";
import type { Viewer } from "@/lib/auth/viewer";
import { createMaterial, createMaterialBody } from "@/lib/materials/service";
import { shareMaterial } from "./share";

// Upload to the Library (12 §4 Q58–Q60): the student's own notes, textbook, lab manual, worked
// solutions or past questions, for one topic, shared to the contribution pool in one step. The file
// itself is stored like any material (private `materials` bucket, signed upload URLs, then
// /api/materials/:id/complete); its text is what the checks and search read.

export const libraryUploadBody = z.object({
  concept_id: z.string().uuid(),
  kind: z.enum(["notes", "textbook", "lab_manual", "solutions", "past_questions"]),
  title: z.string().trim().min(1, "Give it a title.").max(120),
  pages: createMaterialBody.shape.pages,
  file: createMaterialBody.shape.file,
  ocr_pages: createMaterialBody.shape.ocr_pages,
  attest: z.literal(true, { error: "Confirm the material is yours to share." }),
});

export async function uploadToLibrary(viewer: Viewer, body: z.infer<typeof libraryUploadBody>) {
  const material = createMaterialBody.parse({
    conceptId: body.concept_id,
    kind: body.kind,
    title: body.title,
    pages: body.pages,
    file: body.file,
    ocr_pages: body.ocr_pages,
  });
  const created = await createMaterial(viewer, material, { forLibrary: true });
  // Curate waits for the text (embeddings, and OCR for photos and scans) before it judges.
  await shareMaterial(viewer, created.material.id);
  return {
    materialId: created.material.id,
    redacted: created.redacted,
    skippedPages: created.skippedPages,
    uploads: created.uploads,
  };
}
