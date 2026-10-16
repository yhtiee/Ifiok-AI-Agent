"use client";

import {
  ArrowRightIcon,
  CameraIcon,
  ListChecksIcon,
  LockSimpleIcon,
  NotePencilIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { EmptyState, Panel } from "@/components/app/Page";
import { Button, Spinner } from "@/components/ui/Button";
import { useDraftOutline, useExtractOutline, useSaveOutline } from "@/lib/queries/courses";
import { ApiError } from "@/lib/query/api";
import { OutlineEditor, type EditorRow } from "./OutlineEditor";

// The course outline (F2-FR2, 07 §5.1b, §5.2): set up three ways, then edited wiki-style.

type Topic = {
  id: string;
  title: string;
  week: number | null;
  description: string | null;
  conceptId: string | null;
  conceptTitle: string | null;
  hasLesson: boolean;
};

type Props = {
  courseId: string;
  courseCode: string;
  isMember: boolean;
  locked: boolean;
  isDraft: boolean;
  topics: Topic[];
};

type Mode =
  | { kind: "view" }
  | { kind: "edit"; source: "upload" | "typed" | "ai_draft" | "edit"; rows: EditorRow[]; note?: string };

let rowSeq = 0;
const row = (t: Partial<EditorRow> = {}): EditorRow => ({
  key: `r${++rowSeq}`,
  topicId: t.topicId ?? null,
  title: t.title ?? "",
  week: t.week ?? null,
  description: t.description ?? null,
  lowConfidence: t.lowConfidence ?? false,
});

export function OutlineWorkspace({ courseId, courseCode, isMember, locked, isDraft, topics }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draft = useDraftOutline(courseId);
  const extract = useExtractOutline(courseId);
  const save = useSaveOutline(courseId);

  const fail = (err: unknown) => setError(err instanceof ApiError ? err.message : "That didn't work. Try again.");

  const startTyped = () =>
    setMode({ kind: "edit", source: "typed", rows: [row({ week: 1 }), row({ week: 2 }), row({ week: 3 })] });

  const startDraft = () => {
    setError(null);
    draft.mutate(undefined, {
      onSuccess: ({ topics: drafted }) =>
        setMode({
          kind: "edit",
          source: "ai_draft",
          rows: drafted.map((t) => row({ title: t.title, week: t.week, description: t.description })),
          note: "Draft outline. Check it against your course, fix anything that's off, then save.",
        }),
      onError: fail,
    });
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    extract.mutate(file, {
      onSuccess: (result) => {
        if (!result.topics.length) {
          setError(
            "Couldn't find topics in that file. Retake the photo in good light with the whole outline in the frame, or type the topics.",
          );
          return;
        }
        setMode({
          kind: "edit",
          source: "upload",
          rows: result.topics.map((t) =>
            row({ title: t.title, week: t.week, description: t.description, lowConfidence: t.confidence < 0.6 }),
          ),
          note: "Here's what Ifiok read. Check each topic, especially the ones marked, then save.",
        });
      },
      onError: fail,
    });
  };

  const startEdit = () =>
    setMode({
      kind: "edit",
      source: "edit",
      rows: topics.map((t) => row({ topicId: t.id, title: t.title, week: t.week, description: t.description })),
    });

  const confirmDraft = () => {
    setError(null);
    save.mutate(
      {
        source: "edit",
        topics: topics.map((t) => ({ topic_id: t.id, title: t.title, week: t.week, description: t.description })),
      },
      {
        onSuccess: (r) => {
          setNotice(r.status === "pending" ? "Thanks. Another member will confirm it." : null);
          router.refresh();
        },
        onError: fail,
      },
    );
  };

  if (mode.kind === "edit") {
    return (
      <Panel title={`${courseCode} outline`}>
        <OutlineEditor
          courseId={courseId}
          source={mode.source}
          initialRows={mode.rows}
          note={mode.note}
          newRow={() => row()}
          onCancel={() => setMode({ kind: "view" })}
          onSaved={(status) => {
            setMode({ kind: "view" });
            setNotice(
              status === "pending"
                ? "Saved. Your changes go live once another member of the course confirms them."
                : "Outline saved. Topics are matched to shared lessons across universities.",
            );
            router.refresh();
          }}
        />
      </Panel>
    );
  }

  const busy = draft.isPending || extract.isPending;

  return (
    <Panel
      title={`${courseCode} outline`}
      action={
        topics.length && isMember && !locked ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold text-quantity hover:underline"
          >
            <PencilSimpleIcon size={18} aria-hidden="true" /> Edit
          </button>
        ) : locked ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
            <LockSimpleIcon size={18} aria-hidden="true" /> Locked by your lecturer
          </span>
        ) : null
      }
    >
      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-input)] border border-built/30 bg-built-soft px-4 py-3 text-base"
        >
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 text-base text-bad">
          {error}
        </p>
      ) : null}

      {topics.length ? (
        <>
          {isDraft ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-input)] border border-dashed border-change px-4 py-3">
              <p className="text-base">
                <span className="font-semibold">Draft.</span> Check it against your course.
              </p>
              {isMember && !locked ? (
                <Button variant="secondary" onClick={confirmDraft} disabled={save.isPending} aria-busy={save.isPending}>
                  {save.isPending ? "Saving…" : "It matches my course"}
                </Button>
              ) : null}
            </div>
          ) : null}
          <ol className="grid divide-y divide-line">
            {topics.map((t, i) => {
              const rowContent = (
                <>
                  <span className="pt-0.5 text-sm text-ink-2 tabular-nums">
                    {t.week ? `Wk ${t.week}` : `#${i + 1}`}
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-base font-semibold">{t.title}</span>
                    {t.description ? <span className="text-sm text-ink-2">{t.description}</span> : null}
                    <span className="text-xs text-ink-3">
                      {t.hasLesson ? "Lesson ready" : "Lesson builds on first open"}
                    </span>
                  </span>
                  {t.conceptId ? (
                    <ArrowRightIcon size={18} className="mt-1 shrink-0 text-ink-2" aria-hidden="true" />
                  ) : null}
                </>
              );
              return (
                <li key={t.id}>
                  {t.conceptId ? (
                    <Link
                      href={`/learn/${t.conceptId}?course=${courseId}`}
                      className="grid grid-cols-[3.25rem_1fr_auto] items-start gap-3 py-3 hover:underline"
                    >
                      {rowContent}
                    </Link>
                  ) : (
                    <div className="grid grid-cols-[3.25rem_1fr] gap-3 py-3">{rowContent}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      ) : isMember ? (
        <div className="grid gap-4">
          <p className="max-w-[60ch] text-base text-ink-2">
            Add your course outline. Ifiok turns each topic into a lesson you can move, shared with every student
            learning it.
          </p>
          <div className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-3">
            <SetupChoice
              icon={<CameraIcon size={24} />}
              title="Snap or upload outline"
              body="A photo or PDF of your course outline or scheme of work."
              busy={extract.isPending}
              busyText="Reading your outline…"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            />
            <SetupChoice
              icon={<NotePencilIcon size={24} />}
              title="Type topics"
              body="List the topics as your lecturer gave them."
              disabled={busy}
              onClick={startTyped}
            />
            <SetupChoice
              icon={<ListChecksIcon size={24} />}
              title="Draft one for me"
              body="No outline? Ifiok drafts one for you to check."
              busy={draft.isPending}
              busyText="Drafting an outline…"
              disabled={busy}
              onClick={startDraft}
            />
          </div>
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
          <p className="text-xs text-ink-2">
            Photos and PDFs are read by Google&apos;s Gemini AI and not stored by Ifiok. Keep names and matric numbers
            out of the photo.
          </p>
        </div>
      ) : (
        <EmptyState title="No outline yet" body="Join the course to add its outline. It takes a minute." />
      )}
    </Panel>
  );
}

function SetupChoice(props: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  busyText?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-busy={props.busy}
      className="flex min-h-24 items-start gap-3 bg-surface p-4 text-left hover:bg-paper disabled:cursor-wait disabled:opacity-70 sm:flex-col"
    >
      <span
        aria-hidden="true"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-change-soft text-change"
      >
        {props.busy ? <Spinner /> : props.icon}
      </span>
      <span className="grid gap-0.5">
        <span className="text-base font-semibold">{props.busy ? props.busyText : props.title}</span>
        <span className="text-sm text-ink-2">{props.busy ? "This can take up to 30 seconds." : props.body}</span>
      </span>
    </button>
  );
}
