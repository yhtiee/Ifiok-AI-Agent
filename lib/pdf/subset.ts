// Library uploads (12 §4 Q59): a new PDF made on the phone from just the pages the student picked,
// so the pages they didn't pick never leave the device (F3), plus a small page-1 thumbnail for the
// Library grid. pdf-lib is imported only here, when someone uploads.
import type { PdfDoc } from "./reader";

/** A PDF of only `pages` (1-based, in order), from the original file. */
export async function subsetPdf(file: File, pages: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: false });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    source,
    pages.map((p) => p - 1),
  );
  for (const page of copied) out.addPage(page);
  // A clean producer line: the original's metadata (author names, software) isn't carried over.
  out.setProducer("Ifiok");
  out.setCreator("Ifiok");
  return out.save();
}

/** A JPEG of the page at 360 px wide for the Library grid (≈ 20–40 KB). */
export async function pageThumbnail(doc: PdfDoc, page: number): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  await doc.renderPreview(page, canvas, 360);
  return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.72));
}
