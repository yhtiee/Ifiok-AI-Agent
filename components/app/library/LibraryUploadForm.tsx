"use client";

import { ClipboardTextIcon, FilePdfIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/mini";
import { ActionBar } from "@/components/app/Page";
import { PagePicker, type PickedPage } from "@/components/app/materials/PagePicker";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiError } from "@/lib/query/api";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";

// Upload to the Library (12 §4 Q58, Q59): one page, one job. Your own notes, lab manual, worked
// solutions or past questions, for one topic, shared straight to the contribution pool (no course
// in between). PDFs are read on the phone; a new PDF of just the picked pages and a page-1
// thumbnail are made there, so pages you didn't pick never leave it (F3).

type Kind = "notes" | "lab_manual" | "solutions" | "past_questions";
const KINDS: { value: Kind; label: string }[] = [
  { value: "notes", label: "Notes" },
  { value: "lab_manual", label: "Lab manual" },
  { value: "past_questions", label: "Past questions" },
  { value: "solutions", label: "Worked solutions" },
];
export type UploadTopic = { conceptId: string; title: string; group: string };

const target = z.object({ path: z.string(), token: z.string() });
const uploaded = z.object({
  materialId: z.string(),
  redacted: z.number(),
  skippedPages: z.number(),
  uploads: z.nullable(z.object({ pdf: target, thumb: target })),
});

/** The picked pages as a new PDF, and a thumbnail of the first one, made on the phone. */
async function pdfFiles(file: File, pages: number[]) {
  const [{ subsetPdf, pageThumbnail }, { openPdf }] = await Promise.all([
    import("@/lib/pdf/subset"),
    import("@/lib/pdf/reader"),
  ]);
  const bytes = await subsetPdf(file, pages);
  const doc = await openPdf(file);
  try {
    return { bytes, thumb: await pageThumbnail(doc, pages[0]!) };
  } finally {
    await doc.destroy();
  }
}

export function LibraryUploadForm({ topics }: { topics: UploadTopic[] }) {
  const router = useRouter();
  const ids = { topic: useId(), title: useId(), text: useId(), own: useId() };
  const file = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState(topics[0]?.conceptId ?? "");
  const [kind, setKind] = useState<Kind>("notes");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"choose" | "pdf" | "paste">("choose");
  const [pdf, setPdf] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(topics.map((t) => t.group))];

  const send = async (pages: { page: number | null; text: string }[]) => {
    setError(null);
    if (!topic) return setError("Pick the topic it explains.");
    if (!title.trim()) return setError("Give it a title.");
    if (!own) return setError("Tick the box to confirm it's yours to share.");
    setBusy(true);
    try {
      const files = pdf
        ? await pdfFiles(
            pdf,
            pages.flatMap((p) => (p.page ? [p.page] : [])),
          )
        : null;
      const r = await apiFetch("/api/library/upload", {
        method: "POST",
        body: {
          concept_id: topic,
          kind,
          title: title.trim(),
          pages,
          attest: true,
          ...(files ? { pdf_bytes: files.bytes.byteLength } : {}),
        },
        schema: uploaded,
      });
      if (files && r.uploads) {
        const bucket = createClient().storage.from("library");
        const pdfUp = await bucket.uploadToSignedUrl(
          r.uploads.pdf.path,
          r.uploads.pdf.token,
          new Blob([new Uint8Array(files.bytes)], { type: "application/pdf" }),
          { contentType: "application/pdf" },
        );
        if (files.thumb)
          await bucket.uploadToSignedUrl(r.uploads.thumb.path, r.uploads.thumb.token, files.thumb, {
            contentType: "image/jpeg",
          });
        // Attach the file (the server checks it's a real PDF); if anything failed it shows as text.
        if (!pdfUp.error)
          await apiFetch(`/api/library/upload/${r.materialId}/complete`, {
            method: "POST",
            body: {},
            schema: z.object({ attached: z.boolean() }),
          }).catch(() => null);
      }
      toast(
        [
          "Shared. Ifiok is checking it; it appears in the Library once it's approved.",
          r.redacted ? `Ifiok removed ${r.redacted} phone numbers, emails or ID numbers.` : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      router.push("/me/earnings");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That didn't upload. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <label htmlFor={ids.topic} className="grid gap-1.5">
        <span className="text-base font-semibold">Topic</span>
        <select
          id={ids.topic}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={cn(fieldClass, "w-full")}
        >
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {topics
                .filter((t) => t.group === g)
                .map((t) => (
                  <option key={`${g}:${t.conceptId}`} value={t.conceptId}>
                    {t.title}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-base font-semibold">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.value}
              type="button"
              variant={kind === k.value ? "default" : "outline"}
              className={kind === k.value ? "bg-quantity text-paper hover:bg-quantity" : undefined}
              aria-pressed={kind === k.value}
              onClick={() => setKind(k.value)}
            >
              {k.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <label htmlFor={ids.title} className="grid gap-1.5">
        <span className="text-base font-semibold">Title</span>
        <Input
          id={ids.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MATERIAL_LIMITS.titleMax}
          placeholder="Kirchhoff's laws, worked examples"
        />
      </label>

      <label htmlFor={ids.own} className="flex min-h-11 items-start gap-3 text-base">
        <input
          id={ids.own}
          type="checkbox"
          checked={own}
          onChange={(e) => setOwn(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        <span>
          It&apos;s my own work, not pages from a published book, and I let Ifiok share it with students as described in
          the contributor terms. I can withdraw it later.
        </span>
      </label>

      {mode === "choose" ? (
        <div className="flex flex-wrap gap-3">
          <input
            ref={file}
            type="file"
            accept="application/pdf"
            className="sr-only"
            aria-label="PDF to upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MATERIAL_LIMITS.maxFileBytes) return setError("That PDF is too large. Pick a smaller one.");
              setPdf(f);
              setMode("pdf");
              if (!title.trim()) setTitle(f.name.replace(/\.pdf$/i, ""));
            }}
          />
          <Button type="button" variant="outline" onClick={() => file.current?.click()}>
            <FilePdfIcon size={20} aria-hidden="true" /> Choose a PDF
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("paste")}>
            <ClipboardTextIcon size={20} aria-hidden="true" /> Paste text
          </Button>
        </div>
      ) : mode === "pdf" && pdf ? (
        <PagePicker
          file={pdf}
          maxPages={MATERIAL_LIMITS.maxPages}
          confirmLabel={(n) => (n ? `Share ${n} ${n === 1 ? "page" : "pages"}` : "Share pages")}
          busy={busy}
          busyLabel="Sharing…"
          onConfirm={(pages: PickedPage[]) => void send(pages)}
          onCancel={() => {
            setPdf(null);
            setMode("choose");
          }}
        />
      ) : (
        <div className="grid gap-3">
          <label htmlFor={ids.text} className="grid gap-1.5">
            <span className="text-base font-semibold">Text</span>
            <Textarea
              id={ids.text}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              maxLength={MATERIAL_LIMITS.maxPasteChars}
            />
          </label>
          <ActionBar>
            <Button
              type="button"
              onClick={() => void send([{ page: null, text: text.trim() }])}
              disabled={busy || text.trim().length < MATERIAL_LIMITS.minPageChars}
              aria-busy={busy}
            >
              {busy ? "Sharing…" : "Share to the library"}
            </Button>
          </ActionBar>
        </div>
      )}

      <p className="text-sm text-ink-2">
        Ifiok checks every upload. Other students see short quotes in lessons, never your file, and you earn Units when
        it helps them.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
