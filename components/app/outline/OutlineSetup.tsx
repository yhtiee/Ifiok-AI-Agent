"use client";

import { CameraIcon, ListChecksIcon, NotePencilIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { PagePicker } from "@/components/app/materials/PagePicker";
import { ActionBar, Row, RowList } from "@/components/app/Page";
import { Button } from "@/components/ui/button";
import { useDraftOutline, useExtractOutline } from "@/lib/queries/courses";
import { useExtractOutlineText, type OutlineExtract } from "@/lib/queries/materials";
import { MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";
import { ApiError } from "@/lib/query/api";
import { NO_TOPICS_FOUND, draftedMode, extractedMode, typedMode, type EditMode } from "./outline-modes";

// "Add your course outline" (app-overhaul §4a step 4): snap or upload it (the camwood action),
// type the topics, or let Ifiok draft one. A PDF outline is read on the device: the student picks
// its pages and only their text is sent (MVP-01). The result opens in the outline editor (`onReady`).

type Props = {
  courseId: string;
  onReady: (mode: EditMode) => void;
  /** "Upload a new version" on the outline page: only the photo/PDF action, as an outline button. */
  uploadOnly?: boolean;
  /** The page picker is open (it brings its own camwood button). */
  onPickingChange?: (picking: boolean) => void;
};

const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

export function OutlineSetup({ courseId, onReady, uploadOnly = false, onPickingChange }: Props) {
  const [pdf, setPdfState] = useState<File | null>(null);
  const setPdf = (file: File | null) => {
    setPdfState(file);
    onPickingChange?.(Boolean(file));
  };
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = useDraftOutline(courseId);
  const extract = useExtractOutline(courseId);
  const extractText = useExtractOutlineText(courseId);
  const busy = draft.isPending || extract.isPending;

  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");

  const onExtracted = (result: OutlineExtract) => {
    setPdf(null);
    if (!result.topics.length) {
      setError(NO_TOPICS_FOUND);
      return;
    }
    onReady(extractedMode(result));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // PDFs are read on the device; only the picked pages' text is sent (F3).
    if (isPdf(file)) setPdf(file);
    else extract.mutate(file, { onSuccess: onExtracted, onError: fail });
  };

  const startDraft = () => {
    setError(null);
    draft.mutate(undefined, { onSuccess: ({ topics }) => onReady(draftedMode(topics)), onError: fail });
  };

  if (pdf) {
    return (
      <section aria-label="Pick the outline pages" className="grid gap-4">
        <p className="text-base text-ink-2">
          Pick the pages that list the topics, up to {MATERIAL_LIMITS.maxOutlinePages}.
        </p>
        <PagePicker
          file={pdf}
          maxPages={MATERIAL_LIMITS.maxOutlinePages}
          confirmLabel={() => "Read topics"}
          busy={extractText.isPending}
          busyLabel="Reading your outline…"
          onCancel={() => setPdf(null)}
          onConfirm={(pages) => {
            setError(null);
            extractText.mutate(
              pages
                .map((p) => `[page ${p.page}]\n${p.text}`)
                .join("\n\n")
                .slice(0, MATERIAL_LIMITS.maxOutlineChars),
              { onSuccess: onExtracted, onError: fail },
            );
          }}
        />
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,application/pdf"
      className="sr-only"
      tabIndex={-1}
      aria-label="Photo or PDF of the course outline"
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const privacyNote = (
    <p className="text-xs text-ink-2">
      Photos, and the text of the PDF pages you pick, are read by Google&apos;s Gemini AI and not stored by Ifiok. Keep
      names and matric numbers out of the photo.
    </p>
  );

  if (uploadOnly) {
    return (
      <div className="grid gap-2">
        {error ? (
          <p role="alert" className="text-base text-bad">
            {error}
          </p>
        ) : null}
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-busy={extract.isPending}
        >
          <CameraIcon size={20} aria-hidden="true" />
          {extract.isPending ? "Reading your outline…" : "Upload a new version"}
        </Button>
        {extract.isPending ? <p className="text-sm text-ink-2">This can take up to 30 seconds.</p> : null}
        {fileInput}
        {privacyNote}
      </div>
    );
  }

  return (
    <section aria-labelledby="setup-title" className="grid gap-4">
      <div className="grid gap-1">
        <h2 id="setup-title" className="text-lg font-semibold">
          Add your course outline
        </h2>
        <p className="max-w-[60ch] text-base text-ink-2">
          Ifiok turns each topic into a lesson you can move, shared with every student learning it.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2">
        <ActionBar>
          <Button onClick={() => fileRef.current?.click()} disabled={busy} aria-busy={extract.isPending}>
            <CameraIcon size={20} aria-hidden="true" />
            {extract.isPending ? "Reading your outline…" : "Snap or upload outline"}
          </Button>
        </ActionBar>
        {extract.isPending ? <p className="text-sm text-ink-2">This can take up to 30 seconds.</p> : null}
      </div>
      <RowList label="Other ways to add the outline">
        <Row
          icon={<NotePencilIcon size={22} />}
          tone="plain"
          title="Type the topics"
          meta="List them as your lecturer gave them."
          onClick={() => onReady(typedMode())}
          disabled={busy}
        />
        <Row
          icon={<ListChecksIcon size={22} />}
          tone="plain"
          title={draft.isPending ? "Drafting an outline…" : "Draft one for me"}
          meta={draft.isPending ? "This can take up to 30 seconds." : "No outline? Ifiok drafts one for you to check."}
          onClick={startDraft}
          busy={draft.isPending}
          disabled={busy}
        />
      </RowList>
      {fileInput}
      {privacyNote}
    </section>
  );
}
