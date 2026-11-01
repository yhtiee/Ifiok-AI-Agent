// Uploading a material (12 §4 Q60): the file itself is stored, privately. Before it goes up, the
// phone reads what it can so the material is searchable at once: a PDF's text layer (pdf.js), a
// Word document's text (mammoth). Scanned PDF pages are drawn to JPEGs and photos go up as they are;
// both are read on the server by the ocr job. pdf.js and mammoth load only when a file is picked.
import { z } from "zod/mini";
import {
  FILE_MIMES,
  MATERIAL_LIMITS,
  MATERIALS_BUCKET,
  MAX_OCR_PAGES,
  type FileMime,
} from "@ifiok/core/materials/kinds";
import { apiFetch } from "@/lib/query/api";
import { openPdf, PdfError, type PdfDoc } from "@/lib/pdf/reader";

export type PreparedFile = {
  original: File;
  file: { name: string; mime: FileMime; bytes: number };
  /** Text read on the phone, page by page. */
  pages: { page: number | null; text: string }[];
  /** Pages with no text layer, drawn for the server to read. */
  ocr: { page: number | null; image: Blob }[];
  thumb: Blob | null;
  /** Pages past the reading limit: stored and viewable, not read. */
  unreadPages: number;
};

export type MaterialUploads = {
  file: { path: string; token: string };
  thumb: { path: string; token: string } | null;
  ocr: { page: number | null; path: string; token: string }[];
};

export class PrepareError extends Error {}

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const BY_EXT: Record<string, FileMime> = {
  pdf: "application/pdf",
  docx: DOCX,
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heic",
  webp: "image/webp",
};
/** Characters per "page" when a Word document's text is split up (it has no pages of its own). */
const WORD_PAGE_CHARS = 3_000;

/** The file's type from its name, then what the browser says; null when Ifiok can't take it. */
export function fileMimeOf(file: File): FileMime | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (BY_EXT[ext]) return BY_EXT[ext];
  return (FILE_MIMES as readonly string[]).includes(file.type) ? (file.type as FileMime) : null;
}

export const titleOf = (file: File) => file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, MATERIAL_LIMITS.titleMax);

async function jpeg(doc: PdfDoc, page: number, width: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  await doc.renderPreview(page, canvas, width);
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", quality));
}

/** Splits text into pages of about WORD_PAGE_CHARS, at paragraph breaks where it can. */
export function splitText(text: string, size = WORD_PAGE_CHARS): string[] {
  const out: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    const p = para.trim();
    if (!p) continue;
    if (current && current.length + p.length + 2 > size) {
      out.push(current);
      current = "";
    }
    if (p.length > size) {
      for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
      continue;
    }
    current = current ? `${current}\n\n${p}` : p;
  }
  if (current) out.push(current);
  return out;
}

export async function prepareFile(original: File): Promise<PreparedFile> {
  const mime = fileMimeOf(original);
  if (!mime) throw new PrepareError("Choose a PDF, a Word document (.docx) or a photo.");
  if (original.size > MATERIAL_LIMITS.maxStoredBytes)
    throw new PrepareError("That file is over 20 MB. Split it, or add the chapters you need as separate files.");
  const file = { name: original.name.slice(0, 200), mime, bytes: original.size };

  if (mime.startsWith("image/")) return { original, file, pages: [], ocr: [], thumb: null, unreadPages: 0 };

  if (mime === DOCX) {
    const mammoth = await import("mammoth");
    let text: string;
    try {
      text = (await mammoth.extractRawText({ arrayBuffer: await original.arrayBuffer() })).value;
    } catch {
      throw new PrepareError("That Word document didn't open. Save it again as .docx, or as a PDF.");
    }
    const parts = splitText(text);
    const read = parts.slice(0, MATERIAL_LIMITS.maxReadPages);
    if (!read.length) throw new PrepareError("That Word document has no text. Add it as a PDF or photos instead.");
    return {
      original,
      file,
      pages: read.map((t, i) => ({ page: i + 1, text: t.slice(0, MATERIAL_LIMITS.maxPageChars) })),
      ocr: [],
      thumb: null,
      unreadPages: parts.length - read.length,
    };
  }

  let doc: PdfDoc;
  try {
    doc = await openPdf(original);
  } catch (err) {
    throw new PrepareError(err instanceof PdfError ? err.message : "Ifiok couldn't open that PDF.");
  }
  try {
    const last = Math.min(doc.numPages, MATERIAL_LIMITS.maxReadPages);
    const pages: PreparedFile["pages"] = [];
    const ocr: PreparedFile["ocr"] = [];
    for (let n = 1; n <= last; n++) {
      const text = (await doc.pageText(n)).slice(0, MATERIAL_LIMITS.maxPageChars);
      if (text.length >= MATERIAL_LIMITS.minPageChars) pages.push({ page: n, text });
      else if (ocr.length < MAX_OCR_PAGES) {
        const image = await jpeg(doc, n, 800, 0.8);
        if (image) ocr.push({ page: n, image });
      }
    }
    const thumb = await jpeg(doc, 1, 360, 0.72);
    return { original, file, pages, ocr, thumb, unreadPages: doc.numPages - last };
  } finally {
    void doc.destroy();
  }
}

/** Uploads the file, thumbnail and page images to the signed URLs, then has the server check them. */
export async function uploadPrepared(sourceId: string, prepared: PreparedFile, uploads: MaterialUploads) {
  const { createClient } = await import("@/lib/supabase/client");
  const bucket = createClient().storage.from(MATERIALS_BUCKET);
  const put = async (u: { path: string; token: string }, body: Blob, contentType: string) => {
    const { error } = await bucket.uploadToSignedUrl(u.path, u.token, body, { contentType });
    if (error) throw new PrepareError("The upload didn't finish. Check your connection and add the file again.");
  };
  await put(uploads.file, prepared.original, prepared.file.mime);
  if (uploads.thumb && prepared.thumb) await put(uploads.thumb, prepared.thumb, "image/jpeg");
  for (const [i, u] of uploads.ocr.entries()) {
    const image = prepared.ocr[i]?.image;
    if (image) await put(u, image, "image/jpeg");
  }
  await apiFetch(`/api/materials/${sourceId}/complete`, {
    method: "POST",
    schema: z.object({ attached: z.boolean(), reading: z.number() }),
  });
}
