"use client";

import { CheckIcon } from "@phosphor-icons/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ActionBar } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openPdf, PdfError, type PdfDoc } from "@/lib/pdf/reader";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";

// The page picker (F3-FR1, 10 MVP-01): the PDF opens on the phone, pages show as small previews,
// and the student picks which to use. Nothing is sent from here: `onConfirm` gets the text of the
// picked pages only, and the caller decides where it goes. Its confirm button is the view's one
// camwood action (pinned above the tab bar on phones).

export type PickedPage = { page: number; text: string };

type Props = {
  file: File;
  maxPages: number;
  /** The confirm button's text for the number of pages picked, e.g. "Add 12 pages". */
  confirmLabel: (picked: number) => string;
  busy?: boolean;
  /** The confirm button's text while the caller works (`busy`). */
  busyLabel?: string;
  onConfirm: (pages: PickedPage[]) => void;
  onCancel: () => void;
};

type TextState = "text" | "empty";

export function PagePicker({
  file,
  maxPages,
  confirmLabel,
  busy = false,
  busyLabel = "Adding…",
  onConfirm,
  onCancel,
}: Props) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [textState, setTextState] = useState<Map<number, TextState>>(new Map());
  const [range, setRange] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const rangeId = useId();

  // Open the file on the device (no network). Closing the picker frees pdf.js's memory.
  useEffect(() => {
    let cancelled = false;
    let opened: PdfDoc | null = null;
    openPdf(file)
      .then((d) => {
        opened = d;
        if (cancelled) void d.destroy();
        else setDoc(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setOpenError(err instanceof PdfError ? err.message : "Ifiok couldn't open that PDF.");
      });
    return () => {
      cancelled = true;
      if (opened) void opened.destroy();
    };
  }, [file]);

  // Stable, so tiles don't redraw their previews whenever the selection changes.
  const noteText = useCallback(
    (page: number, state: TextState) =>
      setTextState((prev) => (prev.get(page) === state ? prev : new Map(prev).set(page, state))),
    [],
  );

  const toggle = (page: number) => {
    setMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(page)) next.delete(page);
      else if (next.size >= maxPages) {
        setMessage(`You can pick up to ${maxPages} pages at a time. Add the rest as a second upload.`);
        return prev;
      } else next.add(page);
      return next;
    });
  };

  const applyRange = () => {
    if (!doc) return;
    const result = parsePageRanges(range, doc.numPages);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    const pages = result.pages.filter((p) => textState.get(p) !== "empty");
    if (pages.length > maxPages) {
      setMessage(`That's ${pages.length} pages. Pick up to ${maxPages} at a time.`);
      return;
    }
    setMessage(null);
    setSelected(new Set(pages));
  };

  const confirm = async () => {
    if (!doc || selected.size === 0) return;
    setReading(true);
    setMessage(null);
    try {
      const pages: PickedPage[] = [];
      for (const page of [...selected].sort((a, b) => a - b)) {
        const text = (await doc.pageText(page)).slice(0, MATERIAL_LIMITS.maxPageChars);
        if (text.length >= MATERIAL_LIMITS.minPageChars) pages.push({ page, text });
        else noteText(page, "empty");
      }
      if (pages.length === 0) {
        setMessage(
          "Those pages have no text Ifiok can read: they look scanned. Pick pages with selectable text, or paste the text instead.",
        );
        return;
      }
      onConfirm(pages);
    } catch {
      setMessage("Ifiok couldn't read those pages. Try again.");
    } finally {
      setReading(false);
    }
  };

  if (openError) {
    return (
      <div className="grid gap-3">
        <p role="alert" className="text-base text-bad">
          {openError}
        </p>
        <div>
          <Button variant="outline" onClick={onCancel}>
            Choose another file
          </Button>
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div
        className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6"
        aria-busy="true"
        aria-label="Opening your PDF"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[3/4] rounded-[var(--radius-input)] bg-line/60" />
        ))}
      </div>
    );
  }

  const emptyPicked = [...selected].filter((p) => textState.get(p) === "empty").length;
  const working = busy || reading;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor={rangeId}>Pages</Label>
          <Input
            id={rangeId}
            value={range}
            onChange={(e) => setRange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyRange();
              }
            }}
            inputMode="numeric"
            placeholder={`e.g. 1-${Math.min(doc.numPages, 12)}`}
          />
        </div>
        <Button variant="outline" onClick={applyRange}>
          Select
        </Button>
        {selected.size > 0 ? (
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-ink-2" aria-live="polite">
        {selected.size} of {Math.min(maxPages, doc.numPages)} pages picked · this PDF has {doc.numPages}{" "}
        {doc.numPages === 1 ? "page" : "pages"}. Only the text of the pages you pick leaves your phone.
      </p>

      <ul
        className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-5 lg:grid-cols-6"
        aria-label="Pages in this PDF"
      >
        {Array.from({ length: doc.numPages }, (_, i) => i + 1).map((page) => (
          <PageTile
            key={page}
            doc={doc}
            page={page}
            selected={selected.has(page)}
            empty={textState.get(page) === "empty"}
            onText={noteText}
            onToggle={toggle}
          />
        ))}
      </ul>

      {message ? (
        <p role="alert" className="text-base text-bad">
          {message}
        </p>
      ) : emptyPicked > 0 ? (
        <p className="text-sm text-ink-2">
          {emptyPicked} picked {emptyPicked === 1 ? "page has" : "pages have"} no readable text and will be skipped.
        </p>
      ) : null}

      <ActionBar>
        <Button variant="outline" onClick={onCancel} disabled={working} className="lg:order-2">
          Cancel
        </Button>
        <Button onClick={confirm} disabled={selected.size === 0 || working} aria-busy={working}>
          {reading ? "Reading pages…" : busy ? busyLabel : confirmLabel(selected.size)}
        </Button>
      </ActionBar>
    </div>
  );
}

function PageTile(props: {
  doc: PdfDoc;
  page: number;
  selected: boolean;
  empty: boolean;
  onText: (page: number, state: TextState) => void;
  onToggle: (page: number) => void;
}) {
  const { doc, page, selected, empty, onText, onToggle } = props;
  const ref = useRef<HTMLLIElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(false);

  // Render the preview and check for a text layer only when the tile scrolls into view.
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  useEffect(() => {
    if (!shown || !canvasRef.current) return;
    const canvas = canvasRef.current;
    void doc.renderPreview(page, canvas, canvas.clientWidth || 110).catch(() => {});
    void doc
      .pageText(page)
      .then((t) => onText(page, t.length >= MATERIAL_LIMITS.minPageChars ? "text" : "empty"))
      .catch(() => {});
  }, [shown, doc, page, onText]);

  return (
    <li ref={ref}>
      <button
        type="button"
        onClick={() => onToggle(page)}
        disabled={empty && !selected}
        aria-pressed={selected}
        aria-label={`Page ${page}${empty ? ", no readable text" : ""}`}
        className={`relative grid w-full gap-1 rounded-[var(--radius-input)] border-2 p-1 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          selected ? "border-quantity bg-quantity-soft" : "border-line bg-surface hover:border-ink/40"
        }`}
      >
        <canvas ref={canvasRef} className="aspect-[3/4] w-full rounded-sm bg-paper object-contain" aria-hidden="true" />
        <span className="flex min-h-6 items-center justify-between gap-1 px-1 text-sm">
          <span className="tabular-nums">p. {page}</span>
          {selected ? <CheckIcon size={16} weight="bold" className="text-quantity" aria-hidden="true" /> : null}
        </span>
        {empty ? <span className="px-1 text-xs text-ink-2">No text found</span> : null}
      </button>
    </li>
  );
}
