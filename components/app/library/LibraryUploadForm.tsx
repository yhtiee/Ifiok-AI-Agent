"use client";

import { ClipboardTextIcon, UploadSimpleIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod/mini";
import { ActionBar } from "@/components/app/Page";
import { FilePicked } from "@/components/app/materials/FilePicked";
import { Button } from "@/components/ui/button";
import { Input, fieldClass } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PrepareError, titleOf, uploadPrepared, type PreparedFile } from "@/lib/materials/prepare";
import { fileFields } from "@/lib/queries/materials";
import { apiFetch, ApiError } from "@/lib/query/api";
import { cn } from "@/lib/utils";
import { FILE_ACCEPT, MATERIAL_LIMITS } from "@ifiok/core/materials/kinds";

// Upload to the Library (12 §4 Q58–Q60): one page, one job. Notes, a textbook, a lab manual, worked
// solutions or past questions, for one topic, shared straight to the contribution pool (no course
// in between). The whole file (PDF, Word or photo, up to 20 MB) is uploaded and stored; its text
// is read on the phone, or by Ifiok for photos and scanned pages.

type Kind = "notes" | "textbook" | "lab_manual" | "solutions" | "past_questions";
const KINDS: { value: Kind; label: string }[] = [
  { value: "notes", label: "Notes" },
  { value: "textbook", label: "Textbook" },
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
  uploads: z.nullable(
    z.object({
      file: target,
      thumb: z.nullable(target),
      ocr: z.array(z.object({ page: z.nullable(z.number()), path: z.string(), token: z.string() })),
    }),
  ),
});

type Content = { pages: { page: number | null; text: string }[] } | { prepared: PreparedFile };

export function LibraryUploadForm({ topics }: { topics: UploadTopic[] }) {
  const router = useRouter();
  const ids = { topic: useId(), title: useId(), text: useId(), own: useId() };
  const file = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState(topics[0]?.conceptId ?? "");
  const [kind, setKind] = useState<Kind>("notes");
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"choose" | "file" | "paste">("choose");
  const [picked, setPicked] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [own, setOwn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groups = [...new Set(topics.map((t) => t.group))];

  const send = async (content: Content) => {
    setError(null);
    if (!topic) return setError("Pick the topic it explains.");
    if (!title.trim()) return setError("Give it a title.");
    if (!own) return setError("Tick the box to confirm it's yours to share.");
    setBusy(true);
    try {
      const r = await apiFetch("/api/library/upload", {
        method: "POST",
        body: {
          concept_id: topic,
          kind,
          title: title.trim(),
          attest: true,
          ...("prepared" in content ? fileFields(content.prepared) : { pages: content.pages }),
        },
        schema: uploaded,
      });
      if ("prepared" in content && r.uploads) {
        try {
          await uploadPrepared(r.materialId, content.prepared, r.uploads);
        } catch (err) {
          // Without its file the upload is no use: remove it so trying again starts clean.
          await apiFetch(`/api/materials/${r.materialId}`, { method: "DELETE", schema: z.unknown() }).catch(() => {});
          throw err;
        }
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
      setError(err instanceof ApiError || err instanceof PrepareError ? err.message : "That didn't upload. Try again.");
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
          I have the right to share this, and I let Ifiok share it with students as described in the contributor terms.
          I can withdraw it later.
        </span>
      </label>

      {mode === "choose" ? (
        <div className="flex flex-wrap gap-3">
          <input
            ref={file}
            type="file"
            accept={FILE_ACCEPT}
            className="sr-only"
            aria-label="File to upload"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setPicked(f);
              setMode("file");
              if (!title.trim()) setTitle(titleOf(f));
            }}
          />
          <Button type="button" variant="outline" onClick={() => file.current?.click()}>
            <UploadSimpleIcon size={20} aria-hidden="true" /> Choose a file
          </Button>
          <Button type="button" variant="outline" onClick={() => setMode("paste")}>
            <ClipboardTextIcon size={20} aria-hidden="true" /> Paste text
          </Button>
        </div>
      ) : mode === "file" && picked ? (
        <FilePicked
          file={picked}
          confirmLabel="Share to the library"
          busyLabel="Uploading…"
          busy={busy}
          onConfirm={(prepared) => void send({ prepared })}
          onCancel={() => {
            setPicked(null);
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
              onClick={() => void send({ pages: [{ page: null, text: text.trim() }] })}
              disabled={busy || text.trim().length < MATERIAL_LIMITS.minPageChars}
              aria-busy={busy}
            >
              {busy ? "Sharing…" : "Share to the library"}
            </Button>
          </ActionBar>
        </div>
      )}

      <p className="text-sm text-ink-2">
        PDF, Word or photos, up to 20 MB. Ifiok checks every upload; once approved, students can open it in the Library
        and lessons can quote it. You earn Units when it helps them.
      </p>
      {error ? (
        <p role="alert" className="text-base text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}
