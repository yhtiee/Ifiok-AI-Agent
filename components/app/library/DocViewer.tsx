"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { openPdfUrl, type PdfDoc } from "@/lib/pdf/reader";

// A Library document in Ifiok's own viewer (12 §4 Q59, 08 §2.5: never the browser's native PDF
// viewer from our origin). pdf.js loads only here; each page is drawn when it scrolls into view, at
// the column's width.

export function DocViewer({ url, title }: { url: string; title: string }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let opened: PdfDoc | null = null;
    openPdfUrl(url)
      .then((d) => {
        opened = d;
        if (alive) setDoc(d);
        else void d.destroy();
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "The document didn't open."));
    return () => {
      alive = false;
      void opened?.destroy();
    };
  }, [url]);

  if (error)
    return (
      <p role="alert" className="text-base text-bad">
        {error}
      </p>
    );
  if (!doc)
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Opening the document">
        <Skeleton className="aspect-[1/1.3] w-full max-w-3xl" />
      </div>
    );
  return (
    <ol aria-label={`${title}, ${doc.numPages} ${doc.numPages === 1 ? "page" : "pages"}`} className="grid gap-4">
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} page={i + 1} total={doc.numPages} />
      ))}
    </ol>
  );
}

function PdfPage({ doc, page, total }: { doc: PdfDoc; page: number; total: number }) {
  const box = useRef<HTMLLIElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || !canvas.current) return;
        io.disconnect();
        const width = Math.min(el.clientWidth || 600, 900);
        void doc.renderPreview(page, canvas.current, width).then(() => setDrawn(true));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc, page]);

  return (
    <li ref={box} className="grid max-w-3xl gap-1">
      <div className="overflow-hidden rounded-[var(--radius-input)] border border-line bg-surface">
        {drawn ? null : <Skeleton className="aspect-[1/1.3] w-full" />}
        <canvas
          ref={canvas}
          className={drawn ? "block h-auto w-full" : "hidden"}
          aria-label={`Page ${page} of ${total}`}
        />
      </div>
      <span className="text-center text-sm text-ink-2 tabular-nums">
        {page} / {total}
      </span>
    </li>
  );
}

/** Text documents (pasted text, or material shared as text before PDFs were kept). */
export function TextDocument({ pages }: { pages: { page: number | null; text: string }[] }) {
  return (
    <ol aria-label="Document pages" className="grid gap-4">
      {pages.map((p, i) => (
        <li key={i} className="grid max-w-3xl gap-1">
          <div className="rounded-[var(--radius-input)] border border-line bg-surface px-5 py-6 text-base leading-relaxed whitespace-pre-line sm:px-8">
            {p.text}
          </div>
          <span className="text-center text-sm text-ink-2 tabular-nums">
            {p.page ? `Page ${p.page}` : `${i + 1} / ${pages.length}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
