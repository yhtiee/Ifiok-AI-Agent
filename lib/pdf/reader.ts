// PDFs read on the device with pdf.js (F3-FR1, 10 MVP-01). The file never leaves the phone: pages
// are rendered as small previews and only the text of pages the student picks is sent. pdf.js is
// imported lazily (it is large) and parses in a Web Worker so the page stays responsive. The legacy
// build carries the polyfills older Android browsers need.
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfErrorCode = "too_big" | "password" | "invalid" | "failed";

export class PdfError extends Error {
  constructor(
    readonly code: PdfErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfError";
  }
}

const MESSAGES: Record<PdfErrorCode, string> = {
  too_big: "That PDF is over 100 MB. Split it into smaller files and add the part you need.",
  password: "That PDF is password-protected. Remove the password, then add it again.",
  invalid: "That file isn't a readable PDF. Check it opens on your phone, then try again.",
  failed: "Ifiok couldn't open that PDF. Try again, or paste the text instead.",
};

export type PdfDoc = {
  numPages: number;
  /** The page's text layer, lines joined with newlines. Empty for scanned pages. */
  pageText(pageNumber: number): Promise<string>;
  /** Draws a preview of the page into the canvas at the given CSS width. */
  renderPreview(pageNumber: number, canvas: HTMLCanvasElement, cssWidth: number): Promise<void>;
  destroy(): Promise<void>;
};

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((mod) => {
    const pdfjs = mod as unknown as PdfJs;
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
    return pdfjs;
  });
  return pdfjsPromise;
}

export async function openPdf(file: File): Promise<PdfDoc> {
  if (file.size > MATERIAL_LIMITS.maxFileBytes) throw new PdfError("too_big", MESSAGES.too_big);
  const pdfjs = await loadPdfJs();
  let doc: PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "PasswordException") throw new PdfError("password", MESSAGES.password);
    if (name === "InvalidPDFException") throw new PdfError("invalid", MESSAGES.invalid);
    throw new PdfError("failed", MESSAGES.failed);
  }

  const textCache = new Map<number, Promise<string>>();

  return {
    numPages: doc.numPages,

    pageText(pageNumber) {
      let cached = textCache.get(pageNumber);
      if (!cached) {
        cached = doc.getPage(pageNumber).then(async (page) => {
          const content = await page.getTextContent();
          let out = "";
          for (const item of content.items) {
            if (!("str" in item)) continue;
            out += item.str;
            out += item.hasEOL ? "\n" : " ";
          }
          return out.trim();
        });
        textCache.set(pageNumber, cached);
      }
      return cached;
    },

    async renderPreview(pageNumber, canvas, cssWidth) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (cssWidth * ratio) / base.width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
    },

    async destroy() {
      await doc.loadingTask.destroy();
    },
  };
}
